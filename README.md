# 湯底之前 · Before the Truth

**一碗海龜湯，一個不尋常的真相。** 用 Jev 當主持人，透過是非問題拼出故事，再決定何時揭開湯底。

🎮 **[開始玩](https://y10ab1.github.io/jev-turtle-soup/)**

## 玩法

1. 從六個經典情節的繁中獨立重述中挑一碗湯。
2. 提出能用是／否回答的問題。Jev 判斷為 **正確、錯誤或無關**。
3. Jev 同時評估已確認問答透露了哪些關鍵資訊。關鍵事實與整體理解都達標，才邀請你揭底。
4. 點「是，揭開湯底」才顯示完整故事；也可以選擇繼續推理。
5. 解出後留下暱稱，看看自己用了幾次提問。每題各有 **TOP 20 湯客榜**。

有小提示、瀏覽器進度保留、重新開始、提前揭曉、手機版與鍵盤／中文輸入法支援。提前揭曉的局不列入榜單；使用提示會在榜上標記。

## 架構

```text
GitHub Pages · React / TypeScript / Vite
                 │ 問題 + session token
                 ▼
Cloudflare Worker ───────── Cloudflare D1
    │                         伺服器計次 / 遊戲進度 / 排行榜
    ├─ Jev request 1：判定當前問題
    └─ Jev request 2：根據實際回答評估累積證據
```

Jev 的 Zen endpoint 沒有瀏覽器 CORS 支援，因此由 Worker 呼叫固定的 `https://opencode.ai/zen/v1/systemone`。目前選用限時免費的 `jev-1.13-free`。正式部署的 Zen key 存在 Worker secret `OPENCODE_API_KEY`，不放進網頁或 Git。匿名呼叫在本機曾成功，但 Cloudflare 出站實測遭遇上游 429，因此不把匿名可用當成正式站的可靠性保證。

### 理解度不是「問滿幾題」

每題有 3–4 個必要事實。第二次 Jev 呼叫只收到玩家已看見的湯面、已使用的提示，以及配有實際判定的問答紀錄。每個必要事實與整體理解均使用 `supported / missing` entailment 判斷；全部 `supported` 機率至少 **0.85**，才開放揭曉邀請。

兩次呼叫有先後順序：同一個 Jev request 內的 questions 彼此獨立，不能讓理解度題目假裝已讀到另一題尚未產生的判定。任一階段失敗時不寫入半筆問答，也不以離線關鍵字猜測替代 Jev。

### 榜單規則

- 後端保存問答與判定，**不採信前端上傳的分數、歷史或解題資格**。
- 每個有效提問計一次，含「錯誤」與「無關」；無法判定／格式錯誤不計次。
- 同一 request ID 重試不重複計次；revision CAS 避免多分頁互相覆寫。
- 揭曉後鎖定這局；只有已達標且確認揭曉的局才能提交。
- 依提問次數、完成時間排序；暱稱 1–16 字，一局一筆。
- 這是休閒推理榜，不是防作弊競賽。故事與程式碼公開，玩家可能事先知道答案；模型判定也不是形式證明。

## 本機開發

Node.js 22+、npm、Cloudflare 帳號。

```sh
npm ci
npm run db:local
npm run dev:api
```

另一個終端：

```sh
npm run dev
```

開啟 `http://127.0.0.1:18730`。本機預設連到 `http://127.0.0.1:8787/api/judge`。可用 `.env` 的 `VITE_JEV_API_ENDPOINT` 指定別的後端，或在遊戲的連線設定中修改。

## 部署

### Worker + D1

```sh
npx wrangler login
npx wrangler d1 create jev-turtle-soup
```

將自己的 database ID 寫入 `wrangler.jsonc`，並將 `ALLOWED_ORIGINS` 設為自己的 Pages origin（例如 `https://your-name.github.io`，不要含 repo 路徑）。

```sh
npm run db:remote
npx wrangler secret put OPENCODE_API_KEY
npm run deploy:api
```

目前 API：`https://jev-turtle-soup-api.gamania-occ.workers.dev`。部署到自己的帳號時請換成自己的 Worker 網址／D1 綁定。

### GitHub Pages

1. Repository Settings → Pages → Source 選 **GitHub Actions**。
2. 設定 Actions repository variable `JEV_API_ENDPOINT` 為完整的 Worker `/api/judge` URL。
3. Push `main`：workflow 會跑 unit／D1 integration／desktop／mobile tests，再部署 `dist/`。
4. Fork 成不同 repo 名稱時，修改 `vite.config.ts` 的 build base。

Worker 程式更新需另外執行 `npm run deploy:api`；Pages workflow 不持有 Cloudflare 憑證。Jev 限免與 Cloudflare 免費額度皆依供應商條件，不代表永久或無限免費。

## 驗證

```sh
npm run check                   # 34 unit / real-D1 tests + typecheck + production build
npx playwright install chromium
npm run test:e2e                # 10 desktop/mobile flows, mocked HTTP (does not call Jev)
npm run test:live -- --live      # real Jev smoke cases, explicit opt-in
```

`docs/live-check.json` 保留 live smoke 的實際回答、機率與耗時。23 個人工案例涵蓋六題正解、三種判定、未完成推理、錯誤正解、指令注入與逐步累積；不是通用準確率 benchmark。

部署後可跑真正的 browser → Worker → Jev → D1 全流程：

```sh
LIVE_SITE_URL=https://y10ab1.github.io/jev-turtle-soup/ \
LIVE_CLEANUP=1 npm run test:e2e -- --project=desktop
```

`LIVE_CLEANUP=1` 需要本機 Wrangler 授權；測試只刪除該次建立的 session 與榜單紀錄。不要把含 session token 的 trace／測試輸出提交到 repo。

## 資料與故事來源

問答會傳給 Cloudflare 後端及 Jev；遊戲 session 保存 14 天後每日清理。排行榜公開暱稱、次數、提示狀態與日期，保留至管理者刪除。本機進度由瀏覽器 localStorage 保存，重開一局會清除本機該局連結。

故事由網路經典情節獨立重述，揭曉後可查看參考連結；完整清單與編寫原則見 [故事來源](docs/story-sources.md)。插畫為程式內原創 SVG，沒有遠端字型或圖片依賴。

程式碼採 MIT License；引用網站本身的文字與品牌仍屬其權利人。
