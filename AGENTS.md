# Repository guidance

- Use TypeScript / npm. Required checks: `npm run check` and relevant Playwright flows.
- Keep real Jev tests opt-in (`npm run test:live -- --live`); never replace production Jev with mock/keyword answers on failure.
- Verdict and understanding assessment are sequential calls. Only actually revealed evidence counts toward understanding.
- Preserve explicit reveal consent; never render solution or source links before reveal.
- Server-side sessions are authoritative for turns, hints, readiness, and leaderboard eligibility. Keep retries idempotent and writes revision-guarded.
- The frontend is on GitHub Pages; CORS-capable Worker and D1 are deployed separately. Keep API credentials and game session tokens out of Git.
- Story prose is independently rewritten; preserve citations and document source changes.
- Live browser tests may create leaderboard records. Cleanup must target only the exact session IDs created by the test.
