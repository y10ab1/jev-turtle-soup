import { test, expect, type Page } from "@playwright/test";
import { stories } from "../../src/data/stories";
import type { GameSession, LeaderboardEntry } from "../../src/lib/types";

async function mockApi(page: Page, options: { failFirst?: boolean; delay?: number } = {}) {
  const sessions = new Map<string, GameSession>();
  const entries: LeaderboardEntry[] = [];
  const requestIds: string[] = [];
  let failed = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = method === "POST" ? request.postDataJSON() : {};
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
    const reply = (data: unknown, status = 200) => route.fulfill({ status, headers, json: structuredClone(data) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/api/leaderboard" && method === "GET") return reply({ entries });
    if (url.pathname === "/api/session" && method === "POST") {
      const story = stories.find((s) => s.id === body.storyId)!;
      const id = crypto.randomUUID();
      const session: GameSession = { version: 1, storyId: story.id, turns: [], revealed: false, hintUsed: false, assessment: { discoveredFactIds: [], totalFacts: story.facts.length, readyToReveal: false } };
      sessions.set(id, session);
      return reply({ sessionId: id, session }, 201);
    }
    const id = request.headers().authorization?.replace("Bearer ", "") ?? "";
    const session = sessions.get(id)!;
    if (!session) return reply({ code: "UNAUTHORIZED" }, 401);
    if (url.pathname === "/api/judge") {
      requestIds.push(body.requestId);
      if (options.failFirst && !failed) { failed = true; return reply({ code: "JUDGE_UNAVAILABLE" }, 503); }
      if (options.delay) await new Promise((resolve) => setTimeout(resolve, options.delay));
      const story = stories.find((s) => s.id === session.storyId)!;
      session.turns.push({ id: body.requestId, question: body.question, verdict: "yes", createdAt: new Date().toISOString(), latencyMs: 30 });
      const solved = body.question.includes("完整推理");
      session.assessment = { discoveredFactIds: story.facts.slice(0, solved ? story.facts.length : 1).map((f) => f.id), totalFacts: story.facts.length, readyToReveal: solved };
    } else if (url.pathname === "/api/hint") session.hintUsed = true;
    else if (url.pathname === "/api/reveal") session.revealed = true;
    else if (url.pathname === "/api/leaderboard") {
      session.leaderboardName = body.nickname;
      entries.push({ rank: 1, nickname: body.nickname, turns: session.turns.length, hintUsed: session.hintUsed, completedAt: new Date().toISOString() });
    }
    await reply({ sessionId: id, session });
  });
  return { requestIds, sessions };
}

async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "來一碗入門湯" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(stories[0].title);
}

test("six-story menu, responsive layout, filters and keyboard-accessible help", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await expect(page.locator(".story-card")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "進階", exact: true }).click();
  await expect(page.locator(".story-card")).toHaveCount(2);
  await page.getByRole("button", { name: "怎麼玩", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "湯客榜", exact: true }).click();
  await expect(page.getByText("第一張位子，還空著。")).toBeVisible();
});

test("Jev readiness asks consent; declining, reload, reveal and leaderboard submission work", async ({ page }) => {
  await mockApi(page);
  await start(page);
  await page.getByLabel("你的下一個問題").fill("完整推理對嗎？");
  await page.getByRole("button", { name: "送出提問" }).click();
  await expect(page.getByRole("dialog", { name: "是否揭開湯底？" })).toBeVisible();
  await expect(page.locator(".solution-panel")).toHaveCount(0);
  await expect(page.getByText(stories[0].solution, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "我想再問問" }).click();
  await page.reload();
  await page.getByRole("button", { name: "繼續閱讀" }).click();
  await expect(page.locator(".turn-list > li")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "揭開湯底", exact: true }).click();
  await page.getByRole("button", { name: "是，揭開湯底" }).click();
  await expect(page.locator(".solution-text")).toHaveText(stories[0].solution);
  await page.getByLabel("你的暱稱").fill("好奇的湯匙");
  await page.getByRole("button", { name: "送上湯客榜" }).click();
  await expect(page.getByText("成績已儲存，謝謝你，")).toBeVisible();
  await page.getByRole("button", { name: "看看本題湯客榜" }).click();
  await expect(page.getByRole("table")).toContainText("好奇的湯匙");
  await expect(page.locator(".leaderboard-turns strong")).toHaveText("1");
});

test("failed requests preserve the question and reuse the same idempotency ID", async ({ page }) => {
  const api = await mockApi(page, { failFirst: true });
  await start(page);
  const input = page.getByLabel("你的下一個問題");
  await input.fill("他個子矮嗎？");
  await page.getByRole("button", { name: "送出提問" }).click();
  await expect(page.locator(".error-notice")).toBeVisible();
  await expect(input).toHaveValue("他個子矮嗎？");
  await expect(page.locator(".turn-list > li")).toHaveCount(0);
  await page.getByRole("button", { name: "重試提問" }).click();
  await expect(page.locator(".turn-list > li")).toHaveCount(1);
  expect(api.requestIds).toHaveLength(2);
  expect(api.requestIds[0]).toBe(api.requestIds[1]);
});

test("IME Enter does not submit, and giving up cannot display score submission", async ({ page }) => {
  const api = await mockApi(page);
  await start(page);
  const input = page.getByLabel("你的下一個問題");
  await input.fill("他個子矮嗎？");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  expect(api.requestIds).toHaveLength(0);
  await input.dispatchEvent("compositionend");
  await page.getByRole("button", { name: "提前看湯底", exact: true }).click();
  await expect(page.locator(".solution-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "確認結束推理並揭曉" }).click();
  await expect(page.locator(".solution-panel")).toBeVisible();
  await expect(page.locator(".score-form")).toHaveCount(0);
  await expect(page.locator(".score-ineligible")).toContainText("不列入湯客榜");
});

test("leaving mid-request cannot write a turn into another story", async ({ page }) => {
  await mockApi(page, { delay: 500 });
  await start(page);
  await page.getByLabel("你的下一個問題").fill("他個子矮嗎？");
  await page.getByRole("button", { name: "送出提問" }).click();
  await expect(page.getByRole("button", { name: "Jev 正在判斷" })).toBeVisible();
  await page.getByRole("button", { name: "回到湯單", exact: true }).click();
  await page.locator(".story-card").filter({ hasText: stories[1].title }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(stories[1].title);
  await page.waitForTimeout(650);
  await expect(page.locator(".turn-list > li")).toHaveCount(0);
  await expect(page.locator(".error-notice")).toHaveCount(0);
});
