import { useEffect, useRef, useState } from "react";
import { api, ApiError, DEFAULT_API_ENDPOINT, emptySession, isSessionResponse } from "./game-service";
import type { GameSession, SessionResponse, Story } from "./types";

export function useGame(story: Story, endpoint = DEFAULT_API_ENDPOINT) {
  const storageKey = `before-the-truth.game.v1:${endpoint}:${story.id}`;
  const [stored] = useState<SessionResponse | null>(() => {
    try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null"); return isSessionResponse(value, story) ? value : null; } catch { return null; }
  });
  const [session, setSession] = useState<GameSession>(stored?.session ?? emptySession(story));
  const current = useRef<SessionResponse | null>(stored);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef<{ question: string; count: number; id: string } | null>(null);
  const mounted = useRef(true);

  function accept(value: unknown) {
    if (!isSessionResponse(value, story)) throw new Error("遊戲回應格式不正確，請重試。");
    if (!mounted.current) return;
    current.current = value;
    setSession(value.session);
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Keep in-memory play available. */ }
  }

  useEffect(() => {
    mounted.current = true;
    // Persisted state is a display cache; the server remains authoritative.
    if (current.current && endpoint) {
      const active = new AbortController();
      controller.current = active;
      setBusy(true);
      void api(endpoint, "session", { sessionId: current.current.sessionId, signal: active.signal })
        .then((value) => { if (!active.signal.aborted) accept(value); })
        .catch((failure) => { if (!active.signal.aborted && mounted.current) setError(failure instanceof Error ? failure.message : "無法同步進度。"); })
        .finally(() => { if (controller.current === active) { controller.current = null; if (mounted.current) setBusy(false); } });
    }
    return () => { mounted.current = false; controller.current?.abort(); controller.current = null; };
  }, []);

  async function ensureSession(signal: AbortSignal) {
    if (current.current) return current.current;
    const response = await api<SessionResponse>(endpoint, "session", { body: { storyId: story.id }, signal });
    signal.throwIfAborted();
    accept(response);
    return response;
  }

  async function operate(action: (value: SessionResponse, signal: AbortSignal) => Promise<SessionResponse>, scoring = false) {
    if (controller.current) return false;
    const active = new AbortController();
    controller.current = active;
    (scoring ? setScoreBusy : setBusy)(true);
    (scoring ? setScoreError : setError)(null);
    try {
      const value = await ensureSession(active.signal);
      active.signal.throwIfAborted();
      const result = await action(value, active.signal);
      if (active.signal.aborted || !mounted.current) return false;
      accept(result);
      return true;
    } catch (failure) {
      if (!active.signal.aborted && mounted.current) {
        if (failure instanceof ApiError && failure.code === "SESSION_CONFLICT" && current.current) {
          try { accept(await api(endpoint, "session", { sessionId: current.current.sessionId, signal: active.signal })); pending.current = null; } catch { /* Keep original conflict visible. */ }
        }
        (scoring ? setScoreError : setError)(failure instanceof Error ? failure.message : "這次連線沒有完成，請重試。");
      }
      return false;
    } finally {
      if (controller.current === active) {
        controller.current = null;
        if (mounted.current) (scoring ? setScoreBusy : setBusy)(false);
      }
    }
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || [...q].length > 240) { setError("請輸入 1～240 字的問題。"); return false; }
    const success = await operate(async (value, signal) => {
      if (pending.current?.question !== q || pending.current.count !== value.session.turns.length) {
        pending.current = { question: q, count: value.session.turns.length, id: crypto.randomUUID() };
      }
      return api(endpoint, "judge", { sessionId: value.sessionId, signal, body: { question: q, requestId: pending.current.id, expectedTurnCount: pending.current.count } });
    });
    if (success) pending.current = null;
    return success;
  }

  const action = (path: string) => { void operate((value, signal) => api(endpoint, path, { sessionId: value.sessionId, signal, body: {} })); };
  function reset() {
    controller.current?.abort(); controller.current = null; pending.current = null; current.current = null;
    setSession(emptySession(story)); setBusy(false); setScoreBusy(false); setError(null); setScoreError(null);
    try { localStorage.removeItem(storageKey); } catch { /* Storage optional. */ }
  }

  return {
    session, busy, error, ask, reveal: () => action("reveal"), useHint: () => action("hint"), reset,
    clearError: () => setError(null), scoreBusy, scoreError,
    saveScore: (nickname: string) => operate((value, signal) => api(endpoint, "leaderboard", { sessionId: value.sessionId, signal, body: { nickname } }), true),
  };
}
