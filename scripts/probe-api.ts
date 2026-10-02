import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const endpoint = process.env.API_ORIGIN || "https://jev-turtle-soup-api.gamania-occ.workers.dev";
const tail = spawn("npx", ["wrangler", "tail", "--format", "pretty"], { stdio: ["ignore", "pipe", "pipe"] });
tail.stdout.on("data", (data: Buffer) => {
  for (const line of data.toString().split("\n")) {
    if (line.includes("jev_http_status") || line.includes("jev_transport_error")) console.log(line);
  }
});
let id = "";
try {
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const created = await fetch(`${endpoint}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId: "elevator" }) });
  if (!created.ok) throw new Error(`session HTTP ${created.status}`);
  id = ((await created.json()) as { sessionId: string }).sessionId;
  const response = await fetch(`${endpoint}/api/judge`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${id}` },
    body: JSON.stringify({ question: "電梯故障了嗎？", requestId: crypto.randomUUID(), expectedTurnCount: 0 }),
  });
  const data = await response.json() as { code?: string; session?: { turns: { verdict: string }[] } };
  console.log({ status: response.status, code: data.code, verdict: data.session?.turns.at(-1)?.verdict });
  await new Promise((resolve) => setTimeout(resolve, 2000));
} finally {
  tail.kill("SIGTERM");
  if (/^[0-9a-f-]{36}$/.test(id)) await promisify(execFile)("npx", ["wrangler", "d1", "execute", "jev-turtle-soup", "--remote", "--command", `DELETE FROM sessions WHERE id='${id}';`], { timeout: 30000 });
}
