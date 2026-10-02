import type { JudgeResult, Story, Turn } from "../src/lib/types";

export type JudgeTurn = (
  story: Story,
  history: Pick<Turn, "question" | "verdict">[],
  question: string,
  hintUsed: boolean,
  options?: { fetch?: typeof fetch; signal?: AbortSignal; apiKey?: string },
) => Promise<JudgeResult>;

export const MAX_QUESTION_LENGTH = 240;
export const MAX_TURNS = 50;

export class GameError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "GAME_ERROR") {
    super(message);
    this.name = "GameError";
  }
}
