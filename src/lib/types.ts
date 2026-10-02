export type Verdict = "yes" | "no" | "irrelevant";

export interface Story {
  id: string;
  title: string;
  premise: string;
  solution: string;
  difficulty: "入門" | "進階" | "燒腦";
  mood: "日常" | "懸疑";
  minutes: number;
  motif: "elevator" | "glass" | "ice" | "music" | "letter" | "match";
  tags: string[];
  facts: { id: string; text: string }[];
  hint: string;
  sources: { title: string; url: string }[];
}

export interface Turn {
  id: string;
  question: string;
  verdict: Verdict;
  createdAt: string;
  latencyMs: number;
}

export interface Assessment {
  discoveredFactIds: string[];
  totalFacts: number;
  readyToReveal: boolean;
}

export interface GameSession {
  version: 1;
  storyId: string;
  turns: Turn[];
  assessment: Assessment;
  revealed: boolean;
  hintUsed: boolean;
  leaderboardName?: string;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  turns: number;
  hintUsed: boolean;
  completedAt: string;
}

export interface SessionResponse {
  sessionId: string;
  session: GameSession;
}

export interface JudgeResult {
  verdict: Verdict;
  assessment: Assessment;
  model: string;
}

export interface JudgeRequest {
  storyId: string;
  question: string;
  history: Pick<Turn, "question" | "verdict">[];
  hintUsed: boolean;
}
