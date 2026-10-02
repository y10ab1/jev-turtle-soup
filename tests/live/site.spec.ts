import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("real browser → Worker → Jev → D1: solve, consent, reveal, publish and read leaderboard", async ({ page }, info) => {
  const sessions: string[] = [];
  page.on("response", async (response) => {
    if (response.url().endsWith("/api/session") && response.request().method() === "POST" && response.ok()) {
      const result = await response.json();
      sessions.push(result.sessionId);
    }
  });
  const nickname = `E2E-${Date.now().toString(36)}`;
  try {
    await page.goto(process.env.LIVE_SITE_URL!);
    await expect(page.locator(".story-card")).toHaveCount(6);
    await page.screenshot({ path: info.outputPath("home.png"), fullPage: true });
    await page.getByRole("button", { name: "來一碗入門湯" }).click();
    const q = page.getByLabel("你的下一個問題");
    const ask = async (question: string, expected: string) => {
      await q.fill(question);
      await page.getByRole("button", { name: "送出提問" }).click();
      await expect(page.locator(".turn-list > li").last().locator(".verdict")).toHaveText(expected, { timeout: 40000 });
    };
    await ask("他必須在七樓下電梯，是因為電梯故障嗎？", "錯誤");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await ask("他的名字是不是小明？", "無關");
    await ask("他個子矮，手只能按到一樓至七樓；雨天帶雨傘，便用傘尖按下十樓的按鈕，所以直接到家，對嗎？", "正確");
    await expect(page.getByRole("dialog", { name: "是否揭開湯底？" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".solution-text")).toHaveCount(0);
    await page.getByRole("button", { name: "是，揭開湯底" }).click();
    await expect(page.locator(".solution-text")).toContainText("雨傘");
    await page.getByLabel("你的暱稱").fill(nickname);
    await page.getByRole("button", { name: "送上湯客榜" }).click();
    await expect(page.locator(".score-success")).toContainText(nickname);
    await page.getByRole("button", { name: "看看本題湯客榜" }).click();
    const row = page.getByRole("row").filter({ hasText: nickname });
    await expect(row).toBeVisible();
    await expect(row.locator(".leaderboard-turns strong")).toHaveText("3");
    await page.screenshot({ path: info.outputPath("leaderboard.png"), fullPage: true });
  } finally {
    if (process.env.LIVE_CLEANUP === "1") {
      for (const id of sessions) {
        if (!/^[0-9a-f-]{36}$/.test(id)) continue;
        await promisify(execFile)("npx", ["wrangler", "d1", "execute", "jev-turtle-soup", "--remote", "--command", `DELETE FROM leaderboard WHERE session_id='${id}'; DELETE FROM sessions WHERE id='${id}';`], { timeout: 30000 });
      }
    }
  }
});
