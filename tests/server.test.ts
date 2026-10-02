import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { stories } from "../src/data/stories";
import type { GameSession, JudgeResult, LeaderboardEntry, SessionResponse } from "../src/lib/types";
import { GameError, type JudgeTurn } from "../server/contracts";
import worker, { createHandler, type Env } from "../server/worker";

// These tests exercise the HTTP boundary and real SQLite/D1, without calling Jev.
vi.mock("../server/judge", () => ({ judgeTurn: vi.fn() }));

const story = stories[0];
const origin = "https://example.github.io";
const answer = (readyToReveal = false, discoveredFactIds: string[] = readyToReveal ? story.facts.map((f) => f.id) : []): JudgeResult => ({
  verdict: "yes", model: "test-jev",
  assessment: { discoveredFactIds, totalFacts: story.facts.length, readyToReveal },
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("Worker session and leaderboard API (real D1)", () => {
  let mf: Miniflare;
  let env: Env;
  let judge: ReturnType<typeof vi.fn<JudgeTurn>>;
  let handler: ReturnType<typeof createHandler>;

  beforeAll(async () => {
    mf = new Miniflare(convertV4MiniflareOptions({
      workers: [{
        name: "backend-test",
        modules: true,
        script: "export default { fetch() { return new Response('test'); } }",
        compatibilityDate: "2025-01-01",
        d1Databases: ["DB"],
      }],
    }));
    env = { DB: await mf.getD1Database("DB"), ALLOWED_ORIGINS: `${origin}, http://localhost:5173` };
    const schema = await readFile(new URL("../server/schema.sql", import.meta.url), "utf8");
    await env.DB.batch(schema.split(";").filter((sql) => sql.trim()).map((sql) => env.DB.prepare(sql)));
  }, 30_000);

  afterAll(async () => { await mf?.dispose(); });

  beforeEach(async () => {
    await env.DB.batch([env.DB.prepare("DELETE FROM sessions"), env.DB.prepare("DELETE FROM leaderboard")]);
    delete env.RATE_LIMITER;
    delete env.OPENCODE_API_KEY;
    judge = vi.fn<JudgeTurn>().mockResolvedValue(answer());
    handler = createHandler(judge);
  });

  function request(path: string, options: { token?: string; body?: unknown; method?: string; headers?: HeadersInit } = {}) {
    const headers = new Headers(options.headers);
    if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    return handler(new Request(`https://worker.example${path}`, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }), env);
  }

  async function create(): Promise<SessionResponse> {
    const response = await request("/api/session", { body: { storyId: story.id } });
    expect(response.status).toBe(201);
    return response.json() as Promise<SessionResponse>;
  }

  function ask(token: string, expectedTurnCount = 0, requestId: string = crypto.randomUUID(), question = "他個子很矮嗎？") {
    return request("/api/judge", { token, body: { question, requestId, expectedTurnCount } });
  }

  async function sessionFor(token: string): Promise<GameSession> {
    const response = await request("/api/session", { token });
    expect(response.status).toBe(200);
    return ((await response.json()) as SessionResponse).session;
  }

  async function board(): Promise<LeaderboardEntry[]> {
    const response = await request(`/api/leaderboard?storyId=${story.id}`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { entries: LeaderboardEntry[] }).entries;
  }

  async function solve(): Promise<string> {
    const { sessionId } = await create();
    judge.mockResolvedValue(answer(true, story.facts.map((fact) => fact.id)));
    expect((await ask(sessionId)).status).toBe(200);
    expect((await request("/api/reveal", { token: sessionId, body: {} })).status).toBe(200);
    return sessionId;
  }

  it("issues isolated opaque UUID sessions and requires Bearer authentication", async () => {
    const created = await create();
    const other = await create();
    expect(created.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.sessionId).not.toBe(other.sessionId);
    expect(created.session).toEqual({
      version: 1, storyId: story.id, turns: [], revealed: false, hintUsed: false,
      assessment: { discoveredFactIds: [], totalFacts: story.facts.length, readyToReveal: false },
    });
    for (const token of [undefined, "bad-token", crypto.randomUUID()]) {
      const response = await request("/api/session", { token });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
    }
    expect((await request(`/api/session?sessionId=${created.sessionId}`)).status).toBe(401);
    for (const path of ["/api/judge", "/api/hint", "/api/reveal", "/api/leaderboard"]) {
      expect((await request(path, { body: {} })).status).toBe(401);
    }
    await request("/api/hint", { token: created.sessionId, body: {} });
    expect((await sessionFor(other.sessionId)).hintUsed).toBe(false);
    const response = await request("/api/session", { token: created.sessionId });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects client-authoritative history, score, readiness and story injection", async () => {
    expect((await request("/api/session", { body: { storyId: story.id, readyToReveal: true } })).status).toBe(400);
    const { sessionId } = await create();
    for (const extra of [{ history: [] }, { storyId: stories[1].id }, { hintUsed: false }, { assessment: { readyToReveal: true } }, { turns: 1 }]) {
      expect((await request("/api/judge", { token: sessionId, body: {
        question: "真的嗎？", requestId: crypto.randomUUID(), expectedTurnCount: 0, ...extra,
      } })).status).toBe(400);
    }
    expect((await request("/api/reveal", { token: sessionId, body: { readyToReveal: true } })).status).toBe(400);
    expect(judge).not.toHaveBeenCalled();
    expect((await sessionFor(sessionId)).turns).toHaveLength(0);
  });

  it("passes the Worker secret only to the provider adapter, never into player responses", async () => {
    env.OPENCODE_API_KEY = "test-only-private-key";
    const { sessionId } = await create();
    const response = await ask(sessionId);
    expect(judge.mock.calls[0][4]).toEqual({ apiKey: "test-only-private-key" });
    expect(await response.text()).not.toContain("test-only-private-key");
  });

  it("uses stored history and hints, keeps progress monotonic, and requires explicit Jev readiness", async () => {
    const { sessionId } = await create();
    await request("/api/hint", { token: sessionId, body: {} });
    judge.mockResolvedValueOnce(answer(false, [...story.facts.map((fact) => fact.id), "invented-fact"]));
    expect((await ask(sessionId)).status).toBe(200);
    expect(judge.mock.calls[0]).toEqual([story, [], "他個子很矮嗎？", true]);
    let saved = await sessionFor(sessionId);
    expect(saved.assessment.discoveredFactIds).toEqual(story.facts.map((fact) => fact.id));
    expect(saved.assessment.readyToReveal).toBe(false);
    judge.mockResolvedValueOnce(answer(true));
    expect((await ask(sessionId, 1)).status).toBe(200);
    expect(judge.mock.calls[1][1]).toEqual([{ question: "他個子很矮嗎？", verdict: "yes" }]);
    judge.mockResolvedValueOnce(answer(false));
    expect((await ask(sessionId, 2)).status).toBe(200);
    saved = await sessionFor(sessionId);
    expect(saved.assessment.readyToReveal).toBe(true);
    expect(saved.assessment.discoveredFactIds).toHaveLength(story.facts.length);
  });

  it("retries without recounting, and returns current state so hint/reveal cannot regress", async () => {
    const { sessionId } = await create();
    const requestId = crypto.randomUUID();
    const first = await ask(sessionId, 0, requestId);
    const original = await first.json();
    const retry = await ask(sessionId, 0, requestId);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(original);
    await request("/api/hint", { token: sessionId, body: {} });
    await request("/api/reveal", { token: sessionId, body: {} });
    expect(await (await ask(sessionId, 0, requestId)).json()).toMatchObject({ session: { turns: original.session.turns, hintUsed: true, revealed: true } });
    expect(judge).toHaveBeenCalledTimes(1);
    const saved = await sessionFor(sessionId);
    expect(saved.turns).toHaveLength(1);
    expect(saved.hintUsed).toBe(true);
    expect(saved.revealed).toBe(true);
  });

  it("rejects stale expected counts before invoking Jev", async () => {
    const { sessionId } = await create();
    expect((await ask(sessionId, 1)).status).toBe(409);
    expect(judge).not.toHaveBeenCalled();
    await ask(sessionId);
    expect((await ask(sessionId, 0)).status).toBe(409);
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("requires the essential fact closure and refuses reuse of a request ID for a different question", async () => {
    const { sessionId } = await create();
    judge.mockResolvedValueOnce(answer(true, []));
    const requestId = crypto.randomUUID();
    expect((await ask(sessionId, 0, requestId)).status).toBe(200);
    expect((await sessionFor(sessionId)).assessment.readyToReveal).toBe(false);
    expect((await ask(sessionId, 0, requestId, "他很高嗎？")).status).toBe(409);
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("commits exactly one of two simultaneous turns without overwriting history", async () => {
    const { sessionId } = await create();
    const entered = deferred<void>();
    const release = deferred<JudgeResult>();
    let calls = 0;
    judge.mockImplementation(() => {
      if (++calls === 2) entered.resolve();
      return release.promise;
    });
    const firstId = crypto.randomUUID();
    const secondId = crypto.randomUUID();
    const pending = [ask(sessionId, 0, firstId, "第一題？"), ask(sessionId, 0, secondId, "第二題？")];
    await entered.promise;
    release.resolve(answer());
    const responses = await Promise.all(pending);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = (await responses.find((response) => response.status === 200)!.json()) as SessionResponse;
    expect(await sessionFor(sessionId)).toEqual(winner.session);
    expect(winner.session.turns).toHaveLength(1);
    expect([firstId, secondId]).toContain(winner.session.turns[0].id);
  });

  it.each(["hint", "reveal"])("rejects in-flight judge results when %s changes the internal revision", async (action) => {
    const { sessionId } = await create();
    const entered = deferred<void>();
    const release = deferred<JudgeResult>();
    judge.mockImplementation(() => { entered.resolve(); return release.promise; });
    const pending = ask(sessionId);
    await entered.promise;
    expect((await request(`/api/${action}`, { token: sessionId, body: {} })).status).toBe(200);
    release.resolve(answer(true));
    expect((await pending).status).toBe(409);
    const saved = await sessionFor(sessionId);
    expect(saved.turns).toHaveLength(0);
    expect(saved.assessment.readyToReveal).toBe(false);
    expect(action === "hint" ? saved.hintUsed : saved.revealed).toBe(true);
  });

  it("does not persist a partial turn or expose provider errors when judgment fails", async () => {
    const { sessionId } = await create();
    const requestId = crypto.randomUUID();
    judge.mockRejectedValueOnce(new GameError("secret-provider-token upstream assessment failed", 502, "JUDGE_UNAVAILABLE"));
    const failed = await ask(sessionId, 0, requestId);
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("secret-provider-token");
    expect((await sessionFor(sessionId)).turns).toHaveLength(0);
    judge.mockRejectedValueOnce(new Error("internal-provider-secret"));
    const unexpected = await ask(sessionId, 0, requestId);
    expect(unexpected.status).toBe(502);
    expect(await unexpected.text()).not.toContain("internal-provider-secret");
    expect((await ask(sessionId, 0, requestId)).status).toBe(200);
    expect((await sessionFor(sessionId)).turns).toHaveLength(1);
  });

  it("rejects malformed assessments without persisting the otherwise valid verdict", async () => {
    const { sessionId } = await create();
    judge.mockResolvedValueOnce({ ...answer(), assessment: undefined } as unknown as JudgeResult);
    const response = await ask(sessionId);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "INVALID_JUDGE_RESPONSE" });
    expect((await sessionFor(sessionId)).turns).toHaveLength(0);
  });

  it("locks hints and new questions after surrender without granting leaderboard eligibility", async () => {
    const { sessionId } = await create();
    expect((await request("/api/reveal", { token: sessionId, body: {} })).status).toBe(200);
    expect((await request("/api/reveal", { token: sessionId, body: {} })).status).toBe(200);
    expect((await request("/api/hint", { token: sessionId, body: {} })).status).toBe(409);
    expect((await ask(sessionId)).status).toBe(409);
    expect((await request("/api/leaderboard", { token: sessionId, body: { nickname: "玩家" } })).status).toBe(403);
    expect((await sessionFor(sessionId)).assessment.readyToReveal).toBe(false);
    expect(judge).not.toHaveBeenCalled();
  });

  it("requires a solved, nonempty and revealed session to submit", async () => {
    const { sessionId } = await create();
    const submit = () => request("/api/leaderboard", { token: sessionId, body: { nickname: "玩家" } });
    expect((await submit()).status).toBe(403);
    judge.mockResolvedValue(answer(true));
    await ask(sessionId);
    expect((await submit()).status).toBe(403);
    await request("/api/reveal", { token: sessionId, body: {} });
    expect((await submit()).status).toBe(200);
  });

  it("stores authoritative scores and NFC nicknames; rename preserves score, flags and reveal timestamp", async () => {
    const { sessionId } = await create();
    await request("/api/hint", { token: sessionId, body: {} });
    judge.mockResolvedValue(answer(true));
    await ask(sessionId);
    await ask(sessionId, 1);
    await request("/api/reveal", { token: sessionId, body: {} });
    for (const forged of [{ turns: 0 }, { hintUsed: false }, { completedAt: "2000-01-01" }, { sessionId: "another-player" }]) {
      expect((await request("/api/leaderboard", { token: sessionId, body: { nickname: "玩家", ...forged } })).status).toBe(400);
    }
    const submitted = await request("/api/leaderboard", { token: sessionId, body: { nickname: "  Cafe\u0301  " } });
    expect(submitted.status).toBe(200);
    expect(((await submitted.json()) as SessionResponse).session.leaderboardName).toBe("Café");
    const initial = await board();
    const completion = await env.DB.prepare("SELECT completed_at FROM sessions WHERE id = ?").bind(sessionId).first<{ completed_at: string }>();
    expect(initial).toEqual([{ rank: 1, nickname: "Café", turns: 2, hintUsed: true, completedAt: completion!.completed_at }]);
    expect((await request("/api/leaderboard", { token: sessionId, body: { nickname: "新名字" } })).status).toBe(200);
    expect(await board()).toEqual([{ ...initial[0], nickname: "新名字" }]);
    expect((await sessionFor(sessionId)).leaderboardName).toBe("新名字");
    expect(JSON.stringify(await board())).not.toContain(sessionId);
  });

  it("validates nickname codepoints and rejects controls", async () => {
    const token = await solve();
    for (const nickname of ["", "   ", "a".repeat(17), "玩家\n", "\t玩家", "a\u0000b", "a\u202Eb", "a\uD800b"]) {
      expect((await request("/api/leaderboard", { token, body: { nickname } })).status).toBe(400);
    }
    expect((await request("/api/leaderboard", { token, body: { nickname: "🐢".repeat(16) } })).status).toBe(200);
    expect((await request("/api/leaderboard", { token, body: { nickname: "🐢".repeat(17) } })).status).toBe(400);
  });

  it("rolls back the session name if leaderboard persistence fails within the D1 transaction", async () => {
    const token = await solve();
    await env.DB.prepare(`CREATE TRIGGER reject_test_score BEFORE INSERT ON leaderboard
      BEGIN SELECT RAISE(ABORT, 'test persistence failure'); END`).run();
    try {
      const response = await request("/api/leaderboard", { token, body: { nickname: "玩家" } });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("test persistence failure");
      expect((await sessionFor(token)).leaderboardName).toBeUndefined();
      expect(await board()).toEqual([]);
    } finally {
      await env.DB.prepare("DROP TRIGGER reject_test_score").run();
    }
  });

  it("returns only the top 20 public entries sorted by turns then completion time", async () => {
    await env.DB.batch(Array.from({ length: 25 }, (_, index) => env.DB.prepare(
      "INSERT INTO leaderboard (session_id, story_id, nickname, turns, hint_used, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(`private-${index}`, story.id, `Player ${index}`, index % 3 + 1, index % 2, new Date(1_700_000_000_000 + index * 1000).toISOString())));
    await env.DB.prepare("INSERT INTO leaderboard VALUES (?, ?, ?, ?, ?, ?)")
      .bind("other-story-private", stories[1].id, "Other story", 1, 0, "2000-01-01T00:00:00.000Z").run();
    const entries = await board();
    expect(entries).toHaveLength(20);
    expect(entries.map((entry) => entry.nickname)).toEqual(
      Array.from({ length: 25 }, (_, index) => index).sort((a, b) => a % 3 - b % 3 || a - b).slice(0, 20).map((index) => `Player ${index}`),
    );
    expect(entries.map((entry) => entry.rank)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    for (const entry of entries) expect(Object.keys(entry).sort()).toEqual(["completedAt", "hintUsed", "nickname", "rank", "turns"]);
  });

  it("handles allowed CORS preflight, rejects unallowed origins, and supports CLI requests", async () => {
    const options = await request("/api/judge", { method: "OPTIONS", headers: {
      Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization, Content-Type",
    } });
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(options.headers.get("Access-Control-Allow-Headers")).toBe("Authorization, Content-Type");
    expect(options.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    for (const badOrigin of ["https://attacker.example", "null", `${origin}.attacker.example`]) {
      const response = await request("/api/session", { body: { storyId: story.id }, headers: { Origin: badOrigin } });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "ORIGIN_NOT_ALLOWED" });
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
    const rejected = await request("/api/judge", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Headers": "X-Evil" } });
    expect(rejected.status).toBe(403);
    const unauthorized = await request("/api/session", { headers: { Origin: origin } });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(unauthorized.headers.get("Vary")).toBe("Origin");
    const health = await request("/health");
    expect(await health.json()).toEqual({ ok: true });
    expect((await request("/health", { headers: { Origin: "http://localhost:5173" } })).status).toBe(200);
  });

  it("rate limits POST by Cloudflare client IP without trusting forwarded headers", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    env.RATE_LIMITER = { limit };
    const limited = await request("/api/session", { body: { storyId: story.id }, headers: {
      "CF-Connecting-IP": "192.0.2.1", "X-Forwarded-For": "spoofed", Origin: origin,
    } });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ code: "RATE_LIMITED" });
    expect(limit).toHaveBeenCalledWith({ key: "192.0.2.1" });
    expect((await request("/health")).status).toBe(200);
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it("enforces JSON and byte size limits including bodies without Content-Length", async () => {
    const raw = (body: string, headers: HeadersInit = {}) => handler(new Request("https://worker.example/api/session", {
      method: "POST", body, headers,
    }), env);
    expect((await raw('{"storyId":"elevator"}')).status).toBe(415);
    expect((await raw("{", { "Content-Type": "application/json" })).status).toBe(400);
    expect((await raw("null", { "Content-Type": "application/json" })).status).toBe(400);
    expect((await raw("[]", { "Content-Type": "application/json" })).status).toBe(400);
    expect((await raw(JSON.stringify({ storyId: "🐢".repeat(1100) }), { "Content-Type": "application/json" })).status).toBe(413);
    expect((await raw("{}", { "Content-Type": "application/json", "Content-Length": "4097" })).status).toBe(413);
    expect((await raw(JSON.stringify({ storyId: story.id }), { "Content-Type": "application/json; charset=utf-8" })).status).toBe(201);
  });

  it("enforces 240 Unicode codepoints, UUID request IDs and a server-side 50-turn limit", async () => {
    const { sessionId } = await create();
    expect((await ask(sessionId, 0, crypto.randomUUID(), "🐢".repeat(241))).status).toBe(400);
    expect((await ask(sessionId, 0, "not-uuid")).status).toBe(400);
    expect((await ask(sessionId, 0, crypto.randomUUID(), " ")).status).toBe(400);
    expect((await ask(sessionId, 0, crypto.randomUUID(), "🐢".repeat(240))).status).toBe(200);
    const saved = await sessionFor(sessionId);
    saved.turns = Array.from({ length: 50 }, () => ({ ...saved.turns[0], id: crypto.randomUUID() }));
    await env.DB.prepare("UPDATE sessions SET state = ?, revision = revision + 1 WHERE id = ?")
      .bind(JSON.stringify(saved), sessionId).run();
    expect((await ask(sessionId, 0)).status).toBe(409);
    const atLimit = await ask(sessionId, 50);
    expect(atLimit.status).toBe(409);
    expect(await atLimit.json()).toMatchObject({ code: "TURN_LIMIT" });
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("expires sessions after 14 days and scheduled cleanup preserves leaderboard scores", async () => {
    const token = await solve();
    await request("/api/leaderboard", { token, body: { nickname: "永久紀錄" } });
    const fresh = await create();
    await env.DB.prepare("UPDATE sessions SET created_at = ? WHERE id = ?")
      .bind(new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), token).run();
    expect((await request("/api/session", { token })).status).toBe(401);
    await worker.scheduled({ cron: "0 3 * * *", scheduledTime: Date.now(), noRetry() {} }, env);
    expect(await env.DB.prepare("SELECT id FROM sessions WHERE id = ?").bind(token).first()).toBeNull();
    expect((await request("/api/session", { token: fresh.sessionId })).status).toBe(200);
    expect(await board()).toHaveLength(1);
  });
});
