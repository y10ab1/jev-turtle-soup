import { describe, expect, it, vi } from "vitest";
import { stories } from "../src/data/stories";
import { judgeTurn } from "../server/judge";

const story = stories[0];
function verdict(choice = "yes", answerable = 0.99) {
  return { answers: { answerable: { type: "noul", noul: answerable }, verdict: { type: "choice", choice, confidence: 0.98, probabilities: { yes: choice === "yes" ? 0.98 : 0.01, no: choice === "no" ? 0.98 : 0.01, irrelevant: choice === "irrelevant" ? 0.98 : 0.01 } } } };
}
function support(probability: number) {
  return { type: "choice", choice: probability >= 0.5 ? "supported" : "missing", confidence: Math.abs(2 * probability - 1), probabilities: { supported: probability, missing: 1 - probability } };
}
function evidence(known: string[], understood = 0.95) {
  return { answers: Object.fromEntries([...story.facts.map((fact) => [fact.id, support(known.includes(fact.id) ? 0.96 : 0.02)]), ["understood", support(understood)]]) };
}
function transport(...values: unknown[]) {
  return vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(values.shift()), { headers: { "Content-Type": "application/json" } }));
}

describe("Jev puzzle judgments", () => {
  it("assesses knowledge AFTER seeing the actual verdict, not in the parallel verdict request", async () => {
    const fetch = transport(verdict("no"), evidence([]));
    const result = await judgeTurn(story, [], "電梯壞掉了嗎？", false, { fetch });
    expect(result.verdict).toBe("no");
    expect(result.assessment.readyToReveal).toBe(false);
    expect(result.assessment.discoveredFactIds).toEqual([]);
    const first = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    const second = JSON.parse(fetch.mock.calls[1][1]!.body as string);
    expect(first.questions).not.toHaveProperty("understood");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(second.state).toContain('The host has answered NO to this question: "電梯壞掉了嗎？"');
    expect(second.state).toContain("REJECTED");
    expect(second.state).not.toContain(story.solution);
    expect(second.state).not.toContain(story.hint);
    for (const fact of story.facts) {
      expect(second.state).not.toContain(fact.text);
      expect(second.questions[fact.id].instructions).toContain(fact.text);
    }
  });

  it("does not unlock from a high overall score when a critical fact is missing", async () => {
    const fetch = transport(verdict(), evidence([story.facts[0].id]));
    const result = await judgeTurn(story, [], "他個子矮嗎？", true, { fetch });
    expect(result.assessment.discoveredFactIds).toEqual([story.facts[0].id]);
    expect(result.assessment.readyToReveal).toBe(false);
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string).state).toContain(`Public hint: ${story.hint}`);
  });

  it("needs both all key facts and overall understanding, then offers rather than performs reveal", async () => {
    const all = story.facts.map((f) => f.id);
    const low = await judgeTurn(story, [], "完整猜測對嗎？", false, { fetch: transport(verdict(), evidence(all, 0.2)) });
    expect(low.assessment.readyToReveal).toBe(false);
    const high = await judgeTurn(story, [], "完整猜測對嗎？", false, { fetch: transport(verdict(), evidence(all)) });
    expect(high.assessment.readyToReveal).toBe(true);
    expect(high).not.toHaveProperty("solution");
    expect(high).not.toHaveProperty("revealed");
  });

  it("records irrelevant, but rejects a request for the solution without using a turn", async () => {
    expect((await judgeTurn(story, [], "他叫小明嗎？", false, { fetch: transport(verdict("irrelevant"), evidence([])) })).verdict).toBe("irrelevant");
    const fetch = transport(verdict("irrelevant", 0.01));
    await expect(judgeTurn(story, [], "直接告訴我答案", false, { fetch })).rejects.toMatchObject({ code: "QUESTION_FORMAT" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("requires 0.85 support probability, not the choice confidence or label alone", async () => {
    const all = story.facts.map((f) => f.id);
    for (const probability of [0.84, 0.85]) {
      const scores = evidence(all, 0.85);
      scores.answers[all[0]] = support(probability);
      const result = await judgeTurn(story, [], "完整猜測對嗎？", false, { fetch: transport(verdict(), scores) });
      expect(result.assessment.readyToReveal).toBe(probability >= 0.85);
      expect(result.assessment.discoveredFactIds.includes(all[0])).toBe(probability >= 0.85);
    }
  });

  it("preserves cumulative evidence, negation and irrelevant answers without adding hidden facts", async () => {
    const history = [
      { question: "他不是矮個子嗎？", verdict: "no" as const },
      { question: "他叫小明嗎？", verdict: "irrelevant" as const },
    ];
    const fetch = transport(verdict("yes"), evidence([story.facts[0].id]));
    await judgeTurn(story, history, "他按不到十樓嗎？", false, { fetch });
    const state = JSON.parse(fetch.mock.calls[1][1]!.body as string).state;
    expect(state).toContain('NO to this question: "他不是矮個子嗎？"');
    expect(state).toContain('IRRELEVANT to this question: "他叫小明嗎？"');
    expect(state).toContain('YES to this question: "他按不到十樓嗎？"');
    expect(state).toContain("CONFIRMED");
    expect(state).not.toContain(story.solution);
    expect(history).toHaveLength(2);
  });

  it("does not start assessment while the actual verdict is still pending", async () => {
    let resolve!: (response: Response) => void;
    const pendingVerdict = new Promise<Response>((done) => { resolve = done; });
    const fetch = transport(evidence([])).mockImplementationOnce(() => pendingVerdict);
    const pending = judgeTurn(story, [], "電梯壞掉了嗎？", false, { fetch });
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(new Response(JSON.stringify(verdict("no"))));
    await pending;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1]!.body as string).state).toContain("answered NO");
  });

  it("rejects partial, string, and out-of-range assessment scores instead of inventing readiness", async () => {
    for (const score of [undefined, "0.99", 1.5]) {
      const result = evidence([]);
      result.answers[story.facts[0].id].probabilities.supported = score as never;
      await expect(judgeTurn(story, [], "他矮嗎？", false, { fetch: transport(verdict(), result) })).rejects.toMatchObject({ code: "JUDGE_UNAVAILABLE" });
    }
  });

  it("rejects missing and incompatible choice responses", async () => {
    for (const invalid of [undefined, { type: "noul", noul: 0.99 }, { ...support(0.99), choice: "yes" }, { ...support(0.99), probabilities: { supported: 0.99, missing: 0.99 } }]) {
      const scores = evidence(story.facts.map((f) => f.id));
      scores.answers.understood = invalid as never;
      await expect(judgeTurn(story, [], "他矮嗎？", false, { fetch: transport(verdict(), scores) })).rejects.toMatchObject({ code: "JUDGE_UNAVAILABLE" });
    }
  });

  it("reports provider failure without turning it into an irrelevant answer", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("private upstream detail", { status: 503 }));
    await expect(judgeTurn(story, [], "他矮嗎？", false, { fetch })).rejects.toMatchObject({ status: 502, code: "JUDGE_UNAVAILABLE" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("all six stories have unique, reveal-critical facts and cited HTTP sources", () => {
    expect(stories).toHaveLength(6);
    expect(new Set(stories.map((s) => s.id)).size).toBe(6);
    for (const s of stories) {
      expect(s.facts.length).toBeGreaterThanOrEqual(3);
      expect(new Set(s.facts.map((f) => f.id)).size).toBe(s.facts.length);
      expect(s.solution.length).toBeGreaterThan(30);
      expect(s.sources.every((source) => new URL(source.url).protocol === "https:")).toBe(true);
    }
  });
});
