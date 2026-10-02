import type { GameSession, LeaderboardEntry, SessionResponse, Story } from "./types";

export const DEFAULT_API_ENDPOINT = import.meta.env.VITE_JEV_API_ENDPOINT ||
  (typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://127.0.0.1:8787/api/judge" : "");

export class ApiError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) { super(message); }
}

const messages: Record<string, string> = {
  UNAUTHORIZED: "這局已過期或已失效，請按「重新開始」開一局新的湯。",
  SESSION_CONFLICT: "另一個分頁更新了這局，已嘗試同步最新進度，請再確認一次。",
  SESSION_REVEALED: "這局已揭開湯底。想再玩一次，請重新開始。",
  TURN_LIMIT: "這局已達 50 次提問。可以先看湯底，或重新開始挑戰。",
  QUESTION_FORMAT: "請改成能用「是／否」回答的問題，也可以提出你的完整推理。",
  QUESTION_AMBIGUOUS: "這個問題有點模糊，試著一次確認一件事，或說清楚你指的是誰。",
  CONTEXT_LIMIT: "這局的對話已經太長，請重新開始一局。",
  RATE_LIMITED: "提問有點密集，請稍等一分鐘再試。",
  JUDGE_UNAVAILABLE: "Jev 暫時沒有回應，問題已保留，請稍後重試。",
  INVALID_JUDGE_RESPONSE: "Jev 的回應不完整，請稍後重試。",
  LEADERBOARD_INELIGIBLE: "掌握關鍵線索並確認揭曉後，才能把成績送上湯客榜。",
  INVALID_REQUEST: "資料格式不正確。問題限 240 字，暱稱限 1～16 字，請確認後再試。",
};

export function emptySession(story: Story): GameSession {
  return { version: 1, storyId: story.id, turns: [], assessment: { discoveredFactIds: [], totalFacts: story.facts.length, readyToReveal: false }, revealed: false, hintUsed: false };
}

export async function api<T>(endpoint: string, path: string, options: { sessionId?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (!endpoint) throw new ApiError("請先設定後端連線。", "NO_ENDPOINT", 0);
  const url = new URL(endpoint);
  if (!url.pathname.endsWith("/api/judge") || !["https:", "http:"].includes(url.protocol)) {
    throw new ApiError("後端網址應以 /api/judge 結尾。", "NO_ENDPOINT", 0);
  }
  const target = new URL(url.href);
  target.pathname = url.pathname.replace(/\/api\/judge$/, `/api/${path.split("?")[0]}`);
  target.search = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  target.hash = "";
  const timeout = AbortSignal.timeout(45000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const response = await fetch(target, {
      method: options.body === undefined ? "GET" : "POST",
      headers: { ...(options.body === undefined ? {} : { "Content-Type": "application/json" }), ...(options.sessionId ? { Authorization: `Bearer ${options.sessionId}` } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body), signal,
      credentials: "omit", cache: "no-store",
    });
    const value = await response.json() as { code?: string };
    if (!response.ok) throw new ApiError(messages[value.code ?? ""] ?? "服務暫時無法使用，請稍後重試。", value.code ?? "API_ERROR", response.status);
    return value as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw error;
    throw new ApiError(timeout.aborted ? "回應超時，請重試；同一筆提問不會重複計次。" : "連線沒有完成。請確認網路或後端網址，再重試同一筆提問。", "NETWORK_ERROR", 0);
  }
}

export function isSessionResponse(value: unknown, story: Story): value is SessionResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<SessionResponse>;
  const s = record.session;
  return typeof record.sessionId === "string" && !!s && s.version === 1 && s.storyId === story.id
    && Array.isArray(s.turns) && s.turns.length <= 50
    && s.turns.every((t) => typeof t.id === "string" && typeof t.question === "string" && ["yes", "no", "irrelevant"].includes(t.verdict))
    && !!s.assessment && Array.isArray(s.assessment.discoveredFactIds)
    && s.assessment.discoveredFactIds.every((id) => story.facts.some((fact) => fact.id === id))
    && s.assessment.totalFacts === story.facts.length && typeof s.assessment.readyToReveal === "boolean"
    && typeof s.revealed === "boolean" && typeof s.hintUsed === "boolean";
}

export async function fetchLeaderboard(endpoint: string, storyId: string, signal?: AbortSignal) {
  const result = await api<{ entries: LeaderboardEntry[] }>(endpoint, `leaderboard?storyId=${encodeURIComponent(storyId)}`, { signal });
  if (!Array.isArray(result.entries) || result.entries.some((e) => typeof e.nickname !== "string" || !Number.isInteger(e.turns) || e.turns < 1 || !Number.isInteger(e.rank))) {
    throw new Error("榜單回應格式不正確，請稍後重試。");
  }
  return result.entries;
}
