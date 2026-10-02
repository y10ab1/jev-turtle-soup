import type { D1Database, ScheduledController } from "@cloudflare/workers-types";
import { stories } from "../src/data/stories";
import type { GameSession, JudgeResult, LeaderboardEntry, SessionResponse, Story } from "../src/lib/types";
import { GameError, MAX_QUESTION_LENGTH, MAX_TURNS, type JudgeTurn } from "./contracts";
import { judgeTurn } from "./judge";

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  OPENCODE_API_KEY?: string;
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

interface SessionRow {
  id: string;
  state: string;
  revision: number;
  created_at: string;
  completed_at: string | null;
  last_request_id: string | null;
  last_result: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BODY_LIMIT = 4096;
const SESSION_LIFETIME = 14 * 24 * 60 * 60 * 1000;
const conflict = () => new GameError("Session changed. Reload and try again.", 409, "SESSION_CONFLICT");
const badRequest = () => new GameError("Invalid request body.", 400, "INVALID_REQUEST");

function storyFor(id: unknown): Story {
  const story = stories.find((candidate) => candidate.id === id);
  if (!story) throw new GameError("Story not found.", 404, "STORY_NOT_FOUND");
  return story;
}

async function readBody(request: Request, keys: string[]): Promise<Record<string, unknown>> {
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new GameError("Content-Type must be application/json.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }
  const tooLarge = () => new GameError("Request body is too large.", 413, "BODY_TOO_LARGE");
  if (Number(request.headers.get("Content-Length")) > BODY_LIMIT) throw tooLarge();
  if (!request.body) throw badRequest();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > BODY_LIMIT) {
        void reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw badRequest();
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest();
  if (Object.keys(body).some((key) => !keys.includes(key))) throw badRequest();
  return body as Record<string, unknown>;
}

async function authorized(request: Request, env: Env): Promise<{ row: SessionRow; session: GameSession }> {
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  const unauthorized = () => new GameError("Invalid or expired session.", 401, "UNAUTHORIZED");
  if (!token || !UUID.test(token)) throw unauthorized();
  const row = await env.DB.prepare("SELECT * FROM sessions WHERE id = ? AND created_at >= ?")
    .bind(token, new Date(Date.now() - SESSION_LIFETIME).toISOString()).first<SessionRow>();
  if (!row) throw unauthorized();
  return { row, session: JSON.parse(row.state) as GameSession };
}

function assertOpen(session: GameSession): void {
  if (session.revealed) throw new GameError("This session has been revealed.", 409, "SESSION_REVEALED");
}

async function save(env: Env, row: SessionRow, session: GameSession, requestId?: string): Promise<void> {
  const response: SessionResponse = { sessionId: row.id, session };
  const result = await env.DB.prepare(`
    UPDATE sessions SET state = ?, revision = revision + 1, completed_at = ?,
      last_request_id = ?, last_result = ? WHERE id = ? AND revision = ?
  `).bind(
    JSON.stringify(session), row.completed_at,
    requestId ?? row.last_request_id,
    requestId ? JSON.stringify(response) : row.last_result,
    row.id, row.revision,
  ).run();
  if (result.meta.changes !== 1) throw conflict();
}

function applyAssessment(session: GameSession, story: Story, result: JudgeResult): void {
  // Reject malformed upstream output before making any persistent change.
  if (!result || !["yes", "no", "irrelevant"].includes(result.verdict)
    || !result.assessment || !Array.isArray(result.assessment.discoveredFactIds)
    || result.assessment.discoveredFactIds.some((id) => typeof id !== "string")
    || typeof result.assessment.readyToReveal !== "boolean") {
    throw new GameError("Judge is temporarily unavailable.", 502, "INVALID_JUDGE_RESPONSE");
  }
  const discovered = new Set([...session.assessment.discoveredFactIds, ...result.assessment.discoveredFactIds]);
  session.assessment = {
    discoveredFactIds: story.facts.filter((fact) => discovered.has(fact.id)).map((fact) => fact.id),
    totalFacts: story.facts.length,
    // Completing the fact set locally is insufficient: Jev must explicitly approve readiness.
    readyToReveal: session.assessment.readyToReveal || (result.assessment.readyToReveal && story.facts.every((fact) => discovered.has(fact.id))),
  };
}

function nicknameFor(value: unknown): string {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)) throw badRequest();
  const nickname = value.trim().normalize("NFC");
  if ([...nickname].length < 1 || [...nickname].length > 16) throw badRequest();
  return nickname;
}

export function createHandler(judge: JudgeTurn = judgeTurn) {
  return async (request: Request, env: Env): Promise<Response> => {
    const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
    const json = (value: unknown, status = 200) => {
      headers.set("Content-Type", "application/json; charset=utf-8");
      return new Response(JSON.stringify(value), { status, headers });
    };
    try {
      const origin = request.headers.get("Origin");
      const allowedOrigins = (env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
      if (origin !== null) {
        if (!allowedOrigins.includes(origin) || origin === "null") {
          throw new GameError("Origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED");
        }
        headers.set("Access-Control-Allow-Origin", origin);
      }
      if (request.method === "OPTIONS") {
        const method = request.headers.get("Access-Control-Request-Method");
        const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "")
          .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
        if ((method && !["GET", "POST", "OPTIONS"].includes(method))
          || requestedHeaders.some((value) => !["authorization", "content-type"].includes(value))) {
          throw new GameError("CORS request is not allowed.", 403, "CORS_NOT_ALLOWED");
        }
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        return new Response(null, { status: 204, headers });
      }

      const url = new URL(request.url);
      if (request.method === "POST" && env.RATE_LIMITER) {
        const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") ?? "unknown" });
        if (!success) throw new GameError("Too many requests. Try again shortly.", 429, "RATE_LIMITED");
      }
      if (request.method === "GET" && url.pathname === "/health") return json({ ok: true });
      if (request.method === "GET" && url.pathname === "/api/leaderboard") {
        const story = storyFor(url.searchParams.get("storyId"));
        const { results } = await env.DB.prepare(`
          SELECT nickname, turns, hint_used, completed_at FROM leaderboard
          WHERE story_id = ? ORDER BY turns ASC, completed_at ASC, session_id ASC LIMIT 20
        `).bind(story.id).all<{ nickname: string; turns: number; hint_used: number; completed_at: string }>();
        const entries: LeaderboardEntry[] = results.map((entry, index) => ({
          rank: index + 1, nickname: entry.nickname, turns: entry.turns,
          hintUsed: Boolean(entry.hint_used), completedAt: entry.completed_at,
        }));
        return json({ entries });
      }
      if (request.method === "POST" && url.pathname === "/api/session") {
        const body = await readBody(request, ["storyId"]);
        const story = storyFor(body.storyId);
        const session: GameSession = {
          version: 1, storyId: story.id, turns: [], revealed: false, hintUsed: false,
          assessment: { discoveredFactIds: [], totalFacts: story.facts.length, readyToReveal: false },
        };
        const sessionId = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO sessions (id, state, created_at) VALUES (?, ?, ?)")
          .bind(sessionId, JSON.stringify(session), new Date().toISOString()).run();
        return json({ sessionId, session }, 201);
      }

      const privatePaths = ["/api/session", "/api/judge", "/api/hint", "/api/reveal", "/api/leaderboard"];
      if (!privatePaths.includes(url.pathname)) throw new GameError("Not found.", 404, "NOT_FOUND");
      if (request.method !== "POST" && !(request.method === "GET" && url.pathname === "/api/session")) {
        throw new GameError("Method not allowed.", 405, "METHOD_NOT_ALLOWED");
      }
      const { row, session } = await authorized(request, env);
      if (request.method === "GET") return json({ sessionId: row.id, session });

      if (url.pathname === "/api/judge") {
        const body = await readBody(request, ["question", "requestId", "expectedTurnCount"]);
        if (typeof body.requestId !== "string" || !UUID.test(body.requestId)
          || typeof body.question !== "string" || !body.question.trim()
          || [...body.question].length > MAX_QUESTION_LENGTH
          || !Number.isInteger(body.expectedTurnCount) || (body.expectedTurnCount as number) < 0) throw badRequest();
        if (row.last_request_id === body.requestId && row.last_result) {
          const original = session.turns.find((turn) => turn.id === body.requestId);
          if (!original || original.question !== body.question.trim()) throw conflict();
          return json({ sessionId: row.id, session });
        }
        assertOpen(session);
        if (session.turns.length !== body.expectedTurnCount) throw conflict();
        if (session.turns.length >= MAX_TURNS) throw new GameError("Turn limit reached.", 409, "TURN_LIMIT");
        const story = storyFor(session.storyId);
        const startedAt = Date.now();
        const question = body.question.trim();
        let result: JudgeResult;
        try {
          const args = [story, session.turns.map(({ question, verdict }) => ({ question, verdict })), question, session.hintUsed] as const;
          result = env.OPENCODE_API_KEY ? await judge(...args, { apiKey: env.OPENCODE_API_KEY }) : await judge(...args);
        } catch (error) {
          // Preserve the judge's status/code contract, never its provider error text.
          throw new GameError("Judge is temporarily unavailable. Try again.",
            error instanceof GameError ? error.status : 502,
            error instanceof GameError ? error.code : "JUDGE_UNAVAILABLE");
        }
        applyAssessment(session, story, result);
        session.turns.push({
          id: body.requestId, question, verdict: result.verdict,
          createdAt: new Date().toISOString(), latencyMs: Math.max(0, Date.now() - startedAt),
        });
        await save(env, row, session, body.requestId);
      } else if (url.pathname === "/api/hint") {
        await readBody(request, []);
        assertOpen(session);
        session.hintUsed = true;
        await save(env, row, session);
      } else if (url.pathname === "/api/reveal") {
        await readBody(request, []);
        if (!session.revealed) {
          session.revealed = true;
          row.completed_at = new Date().toISOString();
          await save(env, row, session);
        }
      } else if (url.pathname === "/api/leaderboard") {
        const body = await readBody(request, ["nickname"]);
        const nickname = nicknameFor(body.nickname);
        if (!session.revealed || !session.assessment.readyToReveal || session.turns.length === 0 || !row.completed_at) {
          throw new GameError("Solve and reveal the story before submitting a score.", 403, "LEADERBOARD_INELIGIBLE");
        }
        session.leaderboardName = nickname;
        // D1 batches are transactions. changes() gates the insert on the immediately
        // preceding CAS, so a losing writer cannot rename or insert a leaderboard row.
        const [updated] = await env.DB.batch([
          env.DB.prepare("UPDATE sessions SET state = ?, revision = revision + 1 WHERE id = ? AND revision = ?")
            .bind(JSON.stringify(session), row.id, row.revision),
          env.DB.prepare(`
            INSERT INTO leaderboard (session_id, story_id, nickname, turns, hint_used, completed_at)
            SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1
            ON CONFLICT(session_id) DO UPDATE SET nickname = excluded.nickname
          `).bind(row.id, session.storyId, nickname, session.turns.length, Number(session.hintUsed), row.completed_at),
        ]);
        if (updated.meta.changes !== 1) throw conflict();
      }
      return json({ sessionId: row.id, session });
    } catch (error) {
      if (error instanceof GameError) {
        return json({ error: error.status >= 500 ? "Service temporarily unavailable. Try again." : error.message, code: error.code }, error.status);
      }
      return json({ error: "Service temporarily unavailable. Try again.", code: "INTERNAL_ERROR" }, 500);
    }
  };
}

export default {
  fetch: createHandler(),
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await env.DB.prepare("DELETE FROM sessions WHERE created_at < ?")
      .bind(new Date(Date.now() - SESSION_LIFETIME).toISOString()).run();
  },
};
