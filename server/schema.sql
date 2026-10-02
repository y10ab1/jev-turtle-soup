-- Apply with: wrangler d1 execute <database-name> --remote --file=server/schema.sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  state TEXT NOT NULL CHECK (json_valid(state)),
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  last_request_id TEXT,
  last_result TEXT CHECK (last_result IS NULL OR json_valid(last_result))
);
CREATE INDEX IF NOT EXISTS sessions_created_at ON sessions(created_at);

-- Deliberately independent of session lifetime: cleanup must preserve scores.
CREATE TABLE IF NOT EXISTS leaderboard (
  session_id TEXT PRIMARY KEY NOT NULL,
  story_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  turns INTEGER NOT NULL CHECK (turns BETWEEN 1 AND 50),
  hint_used INTEGER NOT NULL CHECK (hint_used IN (0, 1)),
  completed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS leaderboard_ranking
  ON leaderboard(story_id, turns, completed_at, session_id);
