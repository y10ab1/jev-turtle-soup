import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_API_ENDPOINT, fetchLeaderboard } from "./game-service";
import type { LeaderboardEntry } from "./types";

export function useLeaderboard(storyId: string, endpoint = DEFAULT_API_ENDPOINT) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  const refresh = useCallback(async () => {
    current.current?.abort();
    const active = new AbortController();
    current.current = active;
    setLoading(true); setError(null);
    try { const data = await fetchLeaderboard(endpoint, storyId, active.signal); if (!active.signal.aborted) setEntries(data); }
    catch (failure) { if (!active.signal.aborted) setError(failure instanceof Error ? failure.message : "無法取得榜單。"); }
    finally { if (!active.signal.aborted) setLoading(false); }
  }, [storyId, endpoint]);
  return { entries, loading, error, refresh };
}
