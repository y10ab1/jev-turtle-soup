import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Minus,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { stories } from "./data/stories";
import { DEFAULT_API_ENDPOINT } from "./lib/game-service";
import type { LeaderboardEntry, Story, Verdict } from "./lib/types";
import { useGame } from "./lib/use-game";
import { useLeaderboard } from "./lib/use-leaderboard";

const SETTINGS_KEY = "before-the-truth.endpoint";
const LAST_STORY_KEY = "before-the-truth.last-story";
const verdicts: Record<Verdict, { label: string; icon: typeof Check }> = {
  yes: { label: "正確", icon: Check },
  no: { label: "錯誤", icon: X },
  irrelevant: { label: "無關", icon: Minus },
};

function readSetting(key: string) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function saveSetting(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // The game remains usable when browser storage is unavailable.
  }
}

function BowlMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M8 25h32c-1.3 10-7 15-16 15S9.3 35 8 25Z" fill="currentColor" />
      <path d="M5 24h38M18 43h12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M17 17c-7-7 7-7 0-14M26 19c-7-7 7-7 0-14M34 16c-5-5 5-6 0-11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StoryArt({ motif, storyId }: { motif: Story["motif"]; storyId?: string }) {
  const illustration = storyId && ["hotel", "coffee", "phone"].includes(storyId) ? storyId : motif;
  return (
    <svg className="story-art" viewBox="0 0 280 180" fill="none" aria-hidden="true">
      <ellipse cx="140" cy="158" rx="75" ry="7" fill="currentColor" opacity=".07" />
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {illustration === "elevator" && <>
          <path d="M91 153V31h98v122M99 153V43h82v110M140 45v106" />
          <path d="M93 31h94l-5-7H99l-6 7ZM103 150h73M109 56v79M170 57v78" opacity=".35" />
          <rect x="125" y="9" width="30" height="10" rx="2" />
          <path d="m130 16 3-4 3 4m9-4 3 4 3-4" strokeWidth="1.2" />
          <rect x="200" y="73" width="13" height="33" rx="2" />
          <path d="m204 84 3-4 3 4m-6 9 3 4 3-4M74 151h144" />
          <path d="M59 118c-12-12-4-24 7-26 10 4 17 16 3 27m-4-12v42m0-28-8-6m9 18 8-8" />
          <path d="M54 142h24l-4 12H58l-4-12Z" fill="currentColor" fillOpacity=".1" />
          <path d="m228 38 2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" strokeWidth="1.2" />
        </>}
        {illustration === "glass" && <>
          <path d="m107 40 8 108c15 6 35 6 50 0l8-108" fill="currentColor" fillOpacity=".035" />
          <ellipse cx="140" cy="40" rx="33" ry="7" />
          <path d="M111 79c17 7 40 7 58 0M121 86l3 48M115 148c15-5 35-5 50 0" />
          <path d="m128 92 13-5 6 14-14 5-5-14Zm14 24 12-4 5 13-12 4-5-13Z" opacity=".5" />
          <path d="M185 44c12-11 9-21 5-27m8 43c17-5 20-15 19-24M88 52c-11-5-14-11-13-19" />
          <path d="M70 113c-4 6-8 10-8 14a8 8 0 0 0 16 0c0-4-4-8-8-14Z" fill="currentColor" fillOpacity=".12" />
          <path d="m205 114 2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" strokeWidth="1.2" />
        </>}
        {illustration === "ice" && <>
          <path d="m95 85 49-24 48 27-49 26-48-29Z" fill="currentColor" fillOpacity=".04" />
          <path d="M95 85v43l48 28 49-26V88m-49 26v42" />
          <path d="m107 97 27 16v26m19-23 26-14v21m-64-37 28-14 30 17" opacity=".4" />
          <path d="m116 80 16 9-6 13m34-18-8 13 11 6M102 159c-34 2-35-17-13-23m111 1c29 13 21 21-15 24" />
          <path d="M89 26v28M75 40h28M79 30l20 20M79 50l20-20m113 22v20m-10-10h20m-17-7 14 14m-14 0 14-14" />
          <path d="M165 32c-4 6-7 9-7 13a7 7 0 0 0 14 0c0-4-3-7-7-13Z" />
        </>}
        {illustration === "music" && <>
          <path d="M94 145h92l-5-12H99l-5 12ZM116 130l-4-54h57l-5 54M108 76h66M121 85v32m13-32v37m13-37v37m13-37v32" />
          <path d="M125 74c4-21 15-17 20-25m-1 0c-9-1-15-10-15-20 20 4 38-1 46-15 7 30 2 49-8 55-12 0-20-8-23-20Z" fill="currentColor" fillOpacity=".07" />
          <path d="M175 14c-1 21-3 38-8 55M133 30c17 10 28 9 40 1M184 85V61l16-4v23m-16-13 16-4" />
          <ellipse cx="180" cy="86" rx="5" ry="3" transform="rotate(-20 180 86)" />
          <ellipse cx="196" cy="81" rx="5" ry="3" transform="rotate(-20 196 81)" />
          <path d="M74 72V48l11 3m-11 3 11 3" />
          <ellipse cx="70" cy="73" rx="5" ry="3" transform="rotate(-20 70 73)" />
          <path d="M76 107c-3-5-3-10 0-15m-8 20c-5-8-5-15 0-22" opacity=".5" />
        </>}
        {illustration === "letter" && <>
          <path d="m80 74 63-44 60 44v72H80V74Z" fill="currentColor" fillOpacity=".035" />
          <path d="M94 82V42h96v43M104 54h49m-49 10h68m-68 10h57M80 74l62 43 61-43M80 146l48-39m75 39-48-38" />
          <circle cx="142" cy="114" r="11" fill="var(--art-bg, #efe5d7)" />
          <path d="m136 114 4 4 8-8M177 53h5v10h-5z" />
          <path d="M57 110c-11-3-13-8-12-14 8 0 13 5 12 14Zm0 0c11-9 20-5 19 1-5 4-12 4-19-1Zm0 0 7 31m-5-21-12-3M221 41l2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" />
        </>}
        {illustration === "match" && <>
          <path d="m84 99 66-32 52 30-66 34-52-32Z" fill="currentColor" fillOpacity=".07" />
          <path d="M84 99v29l52 30 66-32V97m-66 34v27m-43-53 35 21v17l-35-20v-18Z" />
          <path d="m99 112 2 18m5-14 2 18m5-14 2 18m5-14 2 18m22-47 20-10 16 9-21 11-15-10Z" opacity=".5" />
          <path d="m140 96 24-64 5 2-24 64-5-2Z" fill="currentColor" fillOpacity=".12" />
          <path d="M163 33c-10-6-3-18 5-29-1 13 13 19 5 29-3 4-6 4-10 0Z" fill="currentColor" fillOpacity=".16" />
          <path d="M144 22l-6-5m46 23 8 2m-7-25 5-6M69 65l-4 7m2-25-8-2M219 143h9" />
        </>}
        {illustration === "hotel" && <>
          <path d="M89 152V64h100v88M80 64h118l-15-17h-86L80 64Z" fill="currentColor" fillOpacity=".045" />
          <path d="M102 47V24h75v23M108 29v11m8-11v11m-8-6h8m8-5h8v11h-8V29Zm14 0h10m-5 0v11m12-11v11h8m-8-6h6m11-5v11h7" strokeWidth="1.3" />
          <path d="M102 78h13v17h-13V78Zm30 0h13v17h-13V78Zm30 0h13v17h-13V78ZM98 112h82l-5-10h-72l-5 10Z" />
          <path d="M126 150v-28c0-15 26-15 26 0v28m-13-41v41m-40-29h15v15H99v-15Zm65 0h15v15h-15v-15ZM79 154h121" />
          <path d="M58 144v-32m0 8c-18-8-13-23-1-23 15 2 20 20 1 25m0 10 8-7m-17 19h18l-3 11H52l-3-11Zm155-63h20v32h-20V81Zm10 32v39m-5-51h10m-10-7h10M216 44l2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" />
        </>}
        {illustration === "coffee" && <>
          <ellipse cx="136" cy="145" rx="70" ry="12" fill="currentColor" fillOpacity=".045" />
          <path d="M86 76h99l-6 49c-3 24-84 25-88 0l-5-49Z" fill="currentColor" fillOpacity=".035" />
          <ellipse cx="136" cy="76" rx="50" ry="10" />
          <path d="M99 77c17-7 56-7 73 0m14 6c38-15 44 33-6 36m5-26c22-9 24 11-3 15m-82-14 3 25m4 24c17 5 40 5 54 1" />
          <path d="M119 55c-15-15 16-16 1-32m25 34c-15-15 16-16 1-32m17 30c-9-9 9-10 0-20" />
          <path d="m211 132 16 10c5 4 3 8-2 5l-18-9m-1 0c-13 5-32-7-24-12 7-5 24 5 24 12Z" fill="currentColor" fillOpacity=".08" />
          <path d="M64 48l2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2ZM204 40l4-4m-4 15 6 2" strokeWidth="1.3" />
        </>}
        {illustration === "phone" && <>
          <path d="m93 97 13-12h68l14 12 18 49H75l18-49Z" fill="currentColor" fillOpacity=".055" />
          <path d="M77 146v9h127v-9M106 85V66m67 19V66M87 103h105" />
          <path d="M98 51c18-15 65-15 84 0l8 20c-1 5-19 9-22 3l-5-15c-12-5-33-5-45 0l-5 15c-3 6-21 2-22-3l7-20Z" fill="currentColor" fillOpacity=".08" />
          <ellipse cx="140" cy="121" rx="24" ry="17" /><ellipse cx="140" cy="121" rx="12" ry="8" />
          <path d="M126 111h1m13-3h1m12 4h1m8 9h1m-9 9h1m-14 4h1m-14-5h1m-9-8h1" strokeWidth="3" />
          <path d="M96 73c-25 7-27 15-23 18 8 7 23-8 17-11-9-5-23 13-16 16s18-11 15-10c-13 3-15 18-6 18" />
          <path d="M101 27c-9 2-16 7-19 13m7-22c-9 3-16 9-19 15m110-6c9 2 16 7 19 13m-7-22c9 3 16 9 19 15M217 91l2-7 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" />
        </>}
      </g>
    </svg>
  );
}

function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <span className="art-caption art-caption-top">A LITTLE MYSTERY, PLEASE.</span>
      <svg viewBox="0 0 500 350" fill="none">
        <circle cx="262" cy="174" r="135" fill="#e4e7d8" />
        <circle cx="262" cy="174" r="152" stroke="#9fa894" strokeDasharray="2 8" opacity=".55" />
        <ellipse cx="253" cy="275" rx="151" ry="21" fill="#c5cbb9" opacity=".35" />
        <ellipse cx="253" cy="266" rx="141" ry="24" fill="#f8f4e9" stroke="#344e40" strokeWidth="2" />
        <ellipse cx="253" cy="264" rx="114" ry="14" stroke="#344e40" strokeWidth="1.3" />
        <path d="M154 166h195c-5 61-37 101-97 101s-93-40-98-101Z" fill="#faf6ed" stroke="#344e40" strokeWidth="2.5" />
        <path d="M345 177c59-20 53 52 6 51h-21m17-35c30-12 30 21-9 20" stroke="#344e40" strokeWidth="2.5" fill="#faf6ed" />
        <ellipse cx="251" cy="166" rx="98" ry="23" fill="#faf6ed" stroke="#344e40" strokeWidth="2.5" />
        <ellipse cx="251" cy="168" rx="83" ry="15" fill="#b96b4d" />
        <path d="M184 165c29-9 89-9 127 1m-123 8c24 5 54 6 76 4" stroke="#e4af88" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M176 190c4 24 16 42 29 51" stroke="#c5cbb9" strokeWidth="3" strokeLinecap="round" />
        <path d="M231 130c-28-23 21-35 4-62m33 68c24-24-22-36 1-65" stroke="#344e40" strokeWidth="2" strokeLinecap="round" />
        <path d="M248 40c0-15 25-16 25-1 0 10-13 11-13 22m0 9v2" stroke="#a4553b" strokeWidth="3" strokeLinecap="round" />
        <path d="m104 122 5-13 5 13 13 5-13 5-5 13-5-13-13-5 13-5Zm291-21 3-9 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" stroke="#a4553b" strokeWidth="1.5" />
        <g transform="rotate(-18 112 223)">
          <path d="M81 186h61v70H81z" fill="#f8f4e9" stroke="#344e40" strokeWidth="1.5" />
          <path d="M89 250v-51h44v51m-22-49v48m-18-57h35" stroke="#344e40" strokeWidth="1.3" />
          <circle cx="137" cy="222" r="1.5" fill="#344e40" />
        </g>
        <g transform="rotate(15 370 264)">
          <path d="M347 236h58v39h-58z" fill="#ebdac2" stroke="#344e40" strokeWidth="1.5" />
          <path d="m347 236 29 22 29-22m-58 39 20-23m38 23-20-23" stroke="#344e40" strokeWidth="1.3" />
        </g>
        <path d="m307 144 63-72c5-6 13 0 8 6l-58 72" fill="#e2c6a1" stroke="#344e40" strokeWidth="1.5" />
        <path d="M156 66c-15 4-21 12-25 21m221 216c-20 7-40 9-58 6" stroke="#a4553b" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="art-caption art-caption-bottom">每一碗湯，都藏著另一個版本的故事。</span>
      <span className="hero-art-stamp">慢 慢 想<br /><span>TAKE YOUR TIME</span></span>
    </div>
  );
}

function Dialog({ title, eyebrow, children, onClose, className = "" }: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = oldOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog ref={ref} className={`dialog ${className}`} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <button className="icon-button dialog-close" onClick={onClose} aria-label="關閉視窗"><X size={20} /></button>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="一碗湯，怎麼玩？" eyebrow="A SMALL GUIDE" onClose={onClose}>
      <p className="dialog-intro">海龜湯是一場水平思考遊戲。你看見的是「湯面」，而完整故事，藏在「湯底」。</p>
      <ol className="help-steps">
        <li><span>01</span><div><h3>讀一段不尋常的故事</h3><p>留意奇怪的地方，試著放下第一眼的直覺。</p></div></li>
        <li><span>02</span><div><h3>問能用「是／否」回答的問題</h3><p>例如：「這件事和他的職業有關嗎？」一次確認一件事，Jev 會回答正確、錯誤或無關。</p></div></li>
        <li><span>03</span><div><h3>拼起線索，找到另一種可能</h3><p>掌握關鍵線索後，Jev 會邀請你揭開湯底。你也可以再問問，由你決定何時揭曉。</p></div></li>
      </ol>
      <div className="gentle-note"><Lightbulb size={19} /><p>卡住也沒關係。換個角度，或用一次小提示。這裡沒有倒數，也沒有失敗。</p></div>
      <button className="button button-primary full-width" onClick={onClose}>懂了，慢慢來 <ArrowRight size={17} /></button>
    </Dialog>
  );
}

function SettingsDialog({ endpoint, onSave, onClose }: {
  endpoint: string;
  onSave: (endpoint: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(endpoint);
  const [validation, setValidation] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = value.trim();
    if (next) {
      try {
        const url = new URL(next);
        if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error();
        if (window.location.protocol === "https:" && url.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
          setValidation("此網站使用 HTTPS，請使用 HTTPS 後端網址，以免連線被瀏覽器阻擋。");
          return;
        }
      } catch {
        setValidation("請填入完整的 http:// 或 https:// 後端網址，且不要包含帳號、密碼。");
        return;
      }
    }
    onSave(next);
  }

  return (
    <Dialog title="讓 Jev 接上線" eyebrow="CONNECTION SETTINGS" onClose={onClose}>
      <p className="dialog-intro">Jev 透過後端服務判斷你的提問。你可以使用預設服務，或連接自己的相容後端。</p>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="backend-url">自訂後端網址 <span>選填</span></label>
        <input id="backend-url" className="text-input" type="url" inputMode="url" placeholder="https://your-worker.workers.dev/api/judge" autoComplete="off" spellCheck={false} value={value} onChange={(event) => { setValue(event.target.value); setValidation(""); }} aria-describedby="endpoint-help endpoint-validation" aria-invalid={!!validation} />
        <p className="field-help" id="endpoint-help">填入完整的判斷 API 網址。留白使用預設服務。這裡不需要、也不應填入 API 金鑰。</p>
        <p id="endpoint-validation" className="field-error" role="alert">{validation}</p>
        <div className={`connection-note ${DEFAULT_API_ENDPOINT ? "" : "connection-note-pending"}`}>
          <span className={`status-dot ${DEFAULT_API_ENDPOINT ? "" : "status-dot-pending"}`} />
          <div><strong>{DEFAULT_API_ENDPOINT ? "已提供預設服務" : "預設服務尚未設定"}</strong><p>{DEFAULT_API_ENDPOINT ? "留白即可使用預設後端；實際連線狀態以提問結果為準。" : "你仍可瀏覽故事；開始提問前，請設定可連線且允許跨來源請求的後端。"}</p></div>
        </div>
        <p className="settings-footnote"><ShieldCheck size={16} /> 設定儲存在此瀏覽器。變更連線會取消正在送出的提問，已存進度會保留。</p>
        <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>取消</button><button className="button button-primary" type="submit">儲存設定 <Check size={16} /></button></div>
      </form>
    </Dialog>
  );
}

function completedDate(value: LeaderboardEntry["completedAt"]) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function LeaderboardResults({ story, endpoint }: { story: Story; endpoint: string }) {
  const { entries, loading, error, refresh } = useLeaderboard(story.id, endpoint);
  const [refreshError, setRefreshError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const refreshingRef = useRef(false);
  const refreshOnMount = useRef(refresh);
  const pending = loading || refreshing;
  const failure = error || refreshError;

  useEffect(() => {
    let active = true;
    // Each modal opening / story change requests current server rankings.
    // The microtask avoids duplicate work from Strict Mode's setup/cleanup pass.
    void Promise.resolve().then(async () => {
      if (!active) return;
      try {
        await refreshOnMount.current();
      } catch (cause) {
        if (active) setRefreshError(cause instanceof Error ? cause.message : "暫時讀不到湯客榜，請稍後重試。");
      } finally {
        if (active) setRefreshing(false);
      }
    });
    return () => { active = false; };
  }, []);

  async function reload() {
    if (pending || refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshError("");
    try {
      await refresh();
    } catch (cause) {
      setRefreshError(cause instanceof Error ? cause.message : "暫時讀不到湯客榜，請稍後重試。");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }

  return (
    <section className="leaderboard-results" aria-label={`${story.title}的排行榜`} aria-busy={pending}>
      <div className="leaderboard-list-heading">
        <span>本題精選 <strong>TOP 20</strong></span>
        <button className="text-link leaderboard-refresh" onClick={() => void reload()} disabled={pending} aria-label="重新整理湯客榜"><RotateCcw size={13} className={pending ? "spin" : ""} />重新整理</button>
      </div>
      {pending ? <div className="leaderboard-state" role="status"><LoaderCircle size={26} className="spin" /><h3>正在翻開湯客簿…</h3><p>每一次好奇，都值得被記住。</p></div>
        : failure ? <div className="leaderboard-state leaderboard-state-error" role="alert"><MessageCircle size={26} /><h3>湯客簿暫時沒有回應</h3><p>{failure}</p><button className="button button-secondary" onClick={() => void reload()}><RotateCcw size={15} />再試一次</button></div>
          : entries.length === 0 ? <div className="leaderboard-state"><span className="leaderboard-empty-mark"><Trophy size={28} /></span><h3>第一張位子，還空著。</h3><p>這個故事還沒有上榜紀錄。<br />找出真相後，就能留下你的名字。</p></div>
            : <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <caption className="sr-only">{story.title}：依提問次數排名的前 20 名解題紀錄，名次由伺服器提供。</caption>
                <thead><tr><th scope="col">名次</th><th scope="col">湯客</th><th scope="col">提問次數</th></tr></thead>
                <tbody>{entries.slice(0, 20).map((entry, index) => <tr key={`${entry.rank}-${entry.completedAt}-${index}`} className={entry.rank <= 3 ? `leaderboard-top leaderboard-top-${entry.rank}` : ""}>
                  <td><span className="leaderboard-rank" aria-label={`第 ${entry.rank} 名`}>{entry.rank === 1 ? <><Trophy size={17} /><span className="sr-only">1</span></> : String(entry.rank).padStart(2, "0")}</span></td>
                  <th scope="row"><span className="leaderboard-nickname">{entry.nickname}</span><span className="leaderboard-entry-meta"><time dateTime={entry.completedAt}>{completedDate(entry.completedAt)}</time><span className={`leaderboard-hint ${entry.hintUsed ? "used-hint" : "no-hint"}`}>{entry.hintUsed ? <><Lightbulb size={11} />用過提示</> : <><Sparkles size={11} />無提示</>}</span></span></th>
                  <td className="leaderboard-turns"><strong>{entry.turns}</strong><span>次</span></td>
                </tr>)}</tbody>
              </table>
            </div>}
      <p className="sr-only" role="status" aria-live="polite">{!pending && !failure ? `${story.title}，已載入 ${Math.min(entries.length, 20)} 筆排名。` : ""}</p>
    </section>
  );
}

function LeaderboardDialog({ initialStoryId, endpoint, onClose, onSettings }: {
  initialStoryId: string;
  endpoint: string;
  onClose: () => void;
  onSettings: () => void;
}) {
  const [storyId, setStoryId] = useState(initialStoryId);
  const selectedStory = stories.find((story) => story.id === storyId) || stories[0];

  return (
    <Dialog title="湯客榜" eyebrow="THE CURIOUS MINDS CLUB" onClose={onClose} className="leaderboard-dialog">
      <span className="leaderboard-heading-mark" aria-hidden="true"><Trophy size={25} /></span>
      <p className="dialog-intro">有人一問見底，有人細細品嚐。<br />看看大家用幾次提問，找到了故事的另一面。</p>
      <div className="leaderboard-story-field"><label className="field-label" htmlFor="leaderboard-story">選一碗湯，看看誰來過</label><div className="select-wrap"><select id="leaderboard-story" value={selectedStory?.id ?? ""} onChange={(event) => setStoryId(event.target.value)}>{stories.map((story) => <option value={story.id} key={story.id}>{story.title}</option>)}</select><ChevronRight size={16} aria-hidden="true" /></div></div>
      {!endpoint ? <div className="leaderboard-state"><Settings2 size={27} /><h3>先讓湯客簿接上線</h3><p>目前尚未設定後端服務。<br />設定連線後，就能查看真實解題紀錄。</p><button className="button button-primary" onClick={onSettings}>前往連線設定 <ArrowRight size={15} /></button></div>
        : selectedStory && <LeaderboardResults key={`${selectedStory.id}:${endpoint}`} story={selectedStory} endpoint={endpoint} />}
      <div className="leaderboard-footnote"><ShieldCheck size={16} /><p>每題各自排名，提問越少越靠前。次數與解題資格由伺服器核驗；掌握關鍵線索後揭曉的紀錄，才能送上榜。</p></div>
      <p className="leaderboard-closing">名次是紀念，好奇心才是主角。</p>
    </Dialog>
  );
}

function ScoreSubmission({ turns, savedName, saving, error, onSave, onLeaderboard }: {
  turns: number;
  savedName?: string;
  saving: boolean;
  error: string | null;
  onSave: (nickname: string) => Promise<boolean>;
  onLeaderboard: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [validation, setValidation] = useState("");
  const [acceptedName, setAcceptedName] = useState("");
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const composing = useRef(false);
  const name = savedName || acceptedName;
  const pending = saving || submitting;
  const displayedError = error || requestError;
  const nameLength = Array.from(nickname).length;

  async function submitScore(event: FormEvent) {
    event.preventDefault();
    if (pending || submittingRef.current || composing.current || name) return;
    const trimmed = nickname.trim();
    if (!trimmed || Array.from(trimmed).length > 16) {
      setValidation("請留下一個 1–16 字的暱稱。");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setValidation("");
    setRequestError("");
    try {
      if (await onSave(trimmed)) setAcceptedName(trimmed);
    } catch (cause) {
      setRequestError(cause instanceof Error ? cause.message : "成績尚未儲存。暱稱已保留，請再試一次。");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className={`score-card ${name ? "score-card-saved" : ""}`} aria-labelledby="score-title">
      <div className="score-card-heading"><span className="score-card-mark"><Trophy size={20} /></span><div><p className="eyebrow">A LITTLE MOMENT TO REMEMBER</p><h3 id="score-title">{name ? "這次推理，已經留下足跡。" : "在湯客榜，留個名字。"}</h3></div><span className="score-question-count"><strong>{turns}</strong>次提問</span></div>
      {name ? <div className="score-saved-body"><p className="score-success" role="status"><CheckCircle2 size={17} /><span>成績已儲存，謝謝你，<strong>{name}</strong>。</span></p><button className="text-link" onClick={onLeaderboard}>看看本題湯客榜 <ArrowRight size={15} /></button></div>
        : <><p className="score-intro">用一個暱稱，收藏這次找到真相的時刻。</p><form className="score-form" onSubmit={submitScore} aria-busy={pending}>
          <label className="field-label" htmlFor="leaderboard-nickname">你的暱稱 <span>最多 16 字</span></label>
          <div className="score-input-row"><input id="leaderboard-nickname" className="text-input" autoComplete="nickname" placeholder="例如：愛喝湯的貓" value={nickname} disabled={pending} aria-describedby="nickname-help nickname-error score-submit-error" aria-invalid={!!validation} onChange={(event) => { const value = event.target.value; setNickname(composing.current ? value : Array.from(value).slice(0, 16).join("")); setValidation(""); }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={(event) => { composing.current = false; setNickname(Array.from(event.currentTarget.value).slice(0, 16).join("")); }} onKeyDown={(event) => { if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }} /><button className="button button-primary" type="submit" disabled={pending || !nickname.trim() || nameLength > 16}>{pending ? <LoaderCircle size={16} className="spin" /> : <Trophy size={16} />}{pending ? "儲存中…" : displayedError ? "重試送出" : "送上湯客榜"}</button></div>
          <div className="nickname-help" id="nickname-help"><span>暱稱會公開顯示，榜單展示本題前 20 名。</span><span>{nameLength} / 16</span></div>
          <p id="nickname-error" className="field-error" role="alert">{validation}</p>
          <p id="score-submit-error" className="field-error" role="alert">{displayedError}</p>
          <span className="sr-only" role="status">{pending ? "正在儲存你的解題成績。" : ""}</span>
        </form></>}
    </section>
  );
}

function Header({ inGame, onHome, onHelp, onSettings, onLeaderboard }: {
  inGame: boolean;
  onHome: () => void;
  onHelp: () => void;
  onSettings: () => void;
  onLeaderboard: () => void;
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button className="brand" onClick={onHome} aria-label="湯底之前，回到故事選單">
          <BowlMark className="brand-mark" />
          <span><strong>湯底之前<span className="brand-period">。</span></strong><small>BEFORE THE TRUTH</small></span>
        </button>
        <nav className="header-nav" aria-label="主要導覽">
          <button className={`nav-link ${!inGame ? "is-current" : ""}`} onClick={onHome}>{inGame ? "故事選單" : "今日湯單"}</button>
          <button className="nav-link leaderboard-nav" onClick={onLeaderboard}><Trophy size={16} /><span>湯客榜</span></button>
          <button className="nav-link help-nav" onClick={onHelp} aria-label="怎麼玩"><HelpCircle size={16} /><span>怎麼玩</span></button>
          <span className="nav-divider" />
          <button className="icon-button settings-trigger" onClick={onSettings} aria-label="連線設定" title="連線設定"><Settings2 size={19} /></button>
        </nav>
      </div>
    </header>
  );
}

function Library({ lastStory, onSelect, onHelp }: {
  lastStory: string;
  onSelect: (story: Story) => void;
  onHelp: () => void;
}) {
  const [filter, setFilter] = useState<"全部" | Story["difficulty"]>("全部");
  const featured = stories.find((story) => story.motif === "elevator") || stories[0];
  const previous = stories.find((story) => story.id === lastStory);
  const visible = stories.filter((story) => filter === "全部" || story.difficulty === filter);

  return (
    <main id="main-content" className="library page-width" tabIndex={-1}>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span className="tiny-star">✳</span> 給好奇心，留一張位子</p>
          <h1 id="hero-title" tabIndex={-1}>湯面之下，<br />另有<span className="ink-accent">故事。</span></h1>
          <p className="hero-description">一段看似平凡的故事，一個意想不到的真相。<br className="desktop-break" />和 Jev 一起，用提問慢慢嚐出故事的另一面。</p>
          <div className="hero-actions">
            {featured && <button className="button button-primary hero-start" onClick={() => onSelect(featured)}>來一碗入門湯 <ArrowRight size={18} /></button>}
            <a className="text-link" href="#soup-menu">看看今日湯單 <ArrowDown size={15} /></a>
          </div>
          <div className="hero-note"><span className="handdrawn-circle"><Check size={12} /></span> 不用註冊<span>·</span>不計時<span>·</span>只需要一點好奇心</div>
        </div>
        <HeroArt />
      </section>

      {previous && <section className="resume-note" aria-label="繼續上次的故事"><span className="resume-icon"><BookOpen size={21} /></span><div><span className="resume-kicker">上次的那碗湯，還在這裡</span><p>{previous.title}<span>進度會在此瀏覽器自動保留</span></p></div><button className="text-link" onClick={() => onSelect(previous)}>繼續閱讀 <ArrowRight size={16} /></button></section>}

      <section className="ritual-strip" aria-label="遊戲簡介">
        <div className="ritual-item"><span className="ritual-number">01</span><div><strong>選一碗故事</strong><span>從一個小小的謎開始</span></div></div>
        <span className="ritual-dash" />
        <div className="ritual-item"><span className="ritual-number">02</span><div><strong>問出關鍵</strong><span>Jev 只回答正確、錯誤或無關</span></div></div>
        <span className="ritual-dash" />
        <div className="ritual-item"><span className="ritual-number">03</span><div><strong>嚐到真相</strong><span>讓每一塊線索恰好歸位</span></div></div>
        <button className="ritual-help icon-button" onClick={onHelp} aria-label="了解完整遊戲玩法"><ArrowRight size={20} /></button>
      </section>

      <section className="menu-section" id="soup-menu" aria-labelledby="menu-title">
        <div className="menu-heading"><div><p className="eyebrow">THE MYSTERY MENU</p><h2 id="menu-title">今日湯單<span>每個故事，都值得多問一句。</span></h2></div><span className="menu-count">{String(stories.length).padStart(2, "0")} 道精選故事</span></div>
        <div className="filter-row"><div className="filters" role="group" aria-label="依難度篩選故事">{(["全部", "入門", "進階", "燒腦"] as const).map((item) => <button key={item} className={`filter ${filter === item ? "is-active" : ""}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "全部" ? "全部故事" : item}{item === "全部" && <span>{stories.length}</span>}</button>)}</div><span className="filter-aside">慢慢喝，不急著見底。</span></div>
        <p className="sr-only" role="status">顯示 {visible.length} 個故事</p>
        <div className="story-grid">
          {visible.map((story) => {
            const index = stories.indexOf(story) + 1;
            return <button className={`story-card motif-${story.motif} story-${story.id}`} key={story.id} onClick={() => onSelect(story)}>
              <div className="story-illustration"><span className="story-number">NO. {String(index).padStart(2, "0")}</span>{story.motif === "elevator" && <span className="recommended"><Sparkles size={12} /> 新手推薦</span>}<StoryArt motif={story.motif} storyId={story.id} /><span className="art-corner">{story.mood === "日常" ? "EVERYDAY, BUT UNUSUAL" : "A TWIST IN THE TALE"}</span></div>
              <div className="story-card-body"><div className="story-meta"><span className={`difficulty difficulty-${story.difficulty}`}><i />{story.difficulty}</span><span>{story.mood}</span><span className="story-time"><Clock3 size={12} />{story.minutes} 分鐘</span></div><h3>{story.title}</h3><p className="story-excerpt">{story.premise}</p><div className="story-card-bottom"><span>{lastStory === story.id ? "接著探索" : "這碗湯，等你來解"}</span><span className="card-arrow"><ArrowUpRight /></span></div></div>
            </button>;
          })}
        </div>
        {visible.length === 0 && <p className="empty-filter">這個難度的湯還在準備中。先試試其他故事吧。</p>}
      </section>
      <section className="closing-note"><span className="closing-line" /><BowlMark /><p>最好的答案，往往從一個好問題開始。</p><span className="closing-line" /></section>
    </main>
  );
}

function ArrowUpRight() {
  return <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function VerdictChip({ verdict }: { verdict: Verdict }) {
  const { label, icon: Icon } = verdicts[verdict];
  return <span className={`verdict verdict-${verdict}`}><Icon size={14} />{label}</span>;
}

function Game({ story, endpoint, onExit, onSettings, onHelp, onLeaderboard, overlayOpen }: {
  story: Story;
  endpoint: string;
  onExit: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onLeaderboard: () => void;
  overlayOpen: boolean;
}) {
  const { session, busy, error, ask, reveal, useHint, reset, clearError, saveScore, scoreBusy, scoreError } = useGame(story, endpoint || undefined);
  const [question, setQuestion] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [modal, setModal] = useState<"ready" | "reset" | "surrender" | null>(null);
  const promptStorageKey = `before-the-truth.reveal-dismissed.${story.id}`;
  const readyPromptShown = useRef(readSetting(promptStorageKey) === "yes");
  const composing = useRef(false);
  const sending = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const followTranscript = useRef(true);
  const solutionTitle = useRef<HTMLHeadingElement>(null);
  const currentError = error || submitError;
  const discovered = session.assessment.discoveredFactIds.length;
  const total = session.assessment.totalFacts;
  const progress = total > 0 ? Math.min(100, (discovered / total) * 100) : 0;
  const ready = session.assessment.readyToReveal;
  const configured = !!endpoint;
  const scoreEligible = session.revealed && ready && session.turns.length > 0;

  useEffect(() => {
    if (ready && !session.revealed && !readyPromptShown.current && !overlayOpen && !modal) {
      readyPromptShown.current = true;
      setModal("ready");
    }
  }, [ready, session.revealed, overlayOpen, modal]);

  useEffect(() => {
    const element = transcript.current;
    if (element && followTranscript.current) element.scrollTop = element.scrollHeight;
  }, [session.turns.length, busy, currentError]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || busy || sending.current || composing.current || session.revealed || !configured) return;
    sending.current = true;
    setSubmitError("");
    followTranscript.current = true;
    try {
      const saved = await ask(trimmed);
      if (saved) setQuestion("");
    } catch (failure) {
      setSubmitError(failure instanceof Error ? failure.message : "這次連線沒有完成。你的問題還在，請稍後重試。");
    } finally {
      sending.current = false;
      requestAnimationFrame(() => {
        if (input.current?.isConnected && !document.querySelector("dialog[open]")) input.current.focus({ preventScroll: true });
      });
    }
  }

  function confirmReveal() {
    reveal();
    setModal(null);
    requestAnimationFrame(() => solutionTitle.current?.focus({ preventScroll: true }));
  }

  function dismissReady() {
    saveSetting(promptStorageKey, "yes");
    setModal(null);
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  }

  function confirmReset() {
    readyPromptShown.current = false;
    saveSetting(promptStorageKey, "");
    reset();
    setQuestion("");
    setSubmitError("");
    followTranscript.current = true;
    setModal(null);
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  }

  return (
    <main className="game-page page-width" id="main-content" tabIndex={-1}>
      <div className="game-breadcrumb"><button className="text-link" onClick={onExit}><ArrowLeft size={16} /> 回到湯單</button><span className="breadcrumb-divider">/</span><span>NO. {String(stories.indexOf(story) + 1).padStart(2, "0")}</span><span className="game-saved"><span className="status-dot" /> 此瀏覽器自動記錄進度</span></div>
      <div className="game-title-row"><div><p className="eyebrow">{session.revealed ? "THE TRUTH, AT LAST" : "A QUESTION CLOSER TO THE TRUTH"}</p><h1 tabIndex={-1}>{story.title}</h1></div><button className="button button-quiet game-help" onClick={onHelp}><HelpCircle size={16} /> 玩法說明</button></div>

      {session.revealed && <section className="solution-panel" aria-labelledby="solution-title">
        <div className="solution-mark"><CheckCircle2 size={29} /></div>
        <div className="solution-content">
          <p className="eyebrow">THE STORY BENEATH</p>
          <h2 id="solution-title" ref={solutionTitle} tabIndex={-1}>{ready ? "你找到了，故事的另一面。" : "原來，真相是這樣。"}</h2>
          <p className="solution-text">{story.solution}</p>
          <div className="solution-stats"><span><MessageCircle size={15} /> {session.turns.length} 次提問</span><span><Lightbulb size={15} /> {session.hintUsed ? "用過一次小提示" : "沒有使用提示"}</span></div>
          {story.sources.length > 0 && <div className="story-sources"><h3>故事出處與延伸閱讀</h3>{story.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={13} /><span className="sr-only">（在新分頁開啟）</span></a>)}</div>}
          {scoreEligible ? configured
            ? <ScoreSubmission turns={session.turns.length} savedName={session.leaderboardName} saving={scoreBusy} error={scoreError} onSave={saveScore} onLeaderboard={onLeaderboard} />
            : <div className="score-unavailable"><p>你的解題紀錄已保留。設定後端連線，就能將成績送上湯客榜。</p><button className="text-link" onClick={onSettings}>前往連線設定 <ArrowRight size={14} /></button></div>
            : <p className="score-ineligible">這次先品嚐了湯底，不列入湯客榜。完成至少一次提問、掌握關鍵線索後再揭曉，就能提交解題紀錄。</p>}
          <div className="solution-actions"><button className="button button-primary" onClick={onExit}>再來一碗 <ArrowRight size={17} /></button><button className="button button-secondary" onClick={onLeaderboard}><Trophy size={16} /> 本題湯客榜</button></div>
        </div>
      </section>}

      <div className="game-layout">
        <aside className="story-sidebar" aria-label="故事與推理進度">
          <section className={`premise-card motif-${story.motif} story-${story.id}`} aria-labelledby="premise-heading">
            <div className="premise-art"><StoryArt motif={story.motif} storyId={story.id} /><span className="premise-art-label">THE SURFACE</span></div>
            <div className="premise-content"><div className="premise-label"><h2 id="premise-heading">湯面</h2><span>{story.difficulty}<i />{story.mood}<i />約 {story.minutes} 分鐘</span></div><p>{story.premise}</p><div className="premise-question"><span>?</span>不尋常的地方，往往就是入口。</div></div>
          </section>
          <section className="progress-card" aria-labelledby="progress-heading"><div className="progress-heading"><h2 id="progress-heading"><Sparkles size={16} /> 線索拼圖</h2><span><strong>{discovered}</strong> / {total}</span></div><div className="progress-track" role="progressbar" aria-label="已掌握關鍵線索" aria-valuenow={discovered} aria-valuemin={0} aria-valuemax={Math.max(total, discovered)} aria-valuetext={`已掌握 ${discovered} 個，共 ${total} 個關鍵線索`}><span style={{ width: `${progress}%` }} /></div><p>{session.revealed ? "湯底已揭曉，回頭看看你的思路吧。" : ready ? "關鍵線索已到位，真相等你揭曉。" : "每一次好的提問，都讓輪廓清晰一點。"}</p></section>
          {!session.revealed && <section className={`hint-card ${session.hintUsed ? "hint-is-open" : ""}`}><div className="hint-heading"><Lightbulb size={17} /><h2>換個角度想想</h2></div>{session.hintUsed ? <p className="hint-text">{story.hint}</p> : <p>如果思路打了個結，看看這道湯準備的小提示。</p>}<button className="text-link" onClick={useHint} disabled={session.hintUsed || busy}>{session.hintUsed ? <><Check size={14} /> 已使用本題提示</> : <>給我一點提示 <ChevronRight size={15} /></>}</button></section>}
          <div className="sidebar-bottom"><button className="subtle-button" disabled={busy || scoreBusy} onClick={() => setModal("reset")}><RotateCcw size={14} /> 重新開始</button>{!session.revealed && !ready && <button className="subtle-button surrender-button" disabled={busy} onClick={() => setModal("surrender")}>提前看湯底</button>}</div>
        </aside>

        <section className="conversation" aria-labelledby="conversation-title">
          <div className="conversation-header"><div className="jev-avatar"><BowlMark /><span /></div><div><h2 id="conversation-title">Jev<span>你的海龜湯主持人</span></h2><p>{session.revealed ? "故事揭曉了，好奇心還在。" : busy ? "正在仔細讀你的問題…" : "湯已經備好，等你來問。"}</p></div><span className="conversation-header-star" aria-hidden="true">✳</span></div>
          <div className="transcript" ref={transcript} role="region" aria-label="推理對話記錄" tabIndex={0} onScroll={() => { const element = transcript.current; if (element) followTranscript.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72; }}>
            <div className="transcript-start"><span /> 故事從你的第一個問題開始 <span /></div>
            <div className="host-message"><span className="message-author">JEV</span><div className="host-bubble"><p>你好，歡迎來到湯底之前。</p><p>先讀讀湯面，再問我一個能用「是」或「否」回答的問題。我會陪你，一步步靠近真相。</p><div className="verdict-legend"><VerdictChip verdict="yes" /><VerdictChip verdict="no" /><VerdictChip verdict="irrelevant" /></div></div></div>
            {session.turns.length === 0 && !session.revealed && <div className="first-question-note"><span className="small-ornament" aria-hidden="true">✧</span><p>先別急著猜結局。</p><span>從人物、動機，或一個奇怪的細節問起。</span></div>}
            <ol className="turn-list">{session.turns.map((turn, index) => <li key={turn.id} className="turn"><div className="user-message"><span className="message-author">你 <span>· {String(index + 1).padStart(2, "0")}</span></span><p>{turn.question}</p></div><div className="jev-reply"><span className="reply-avatar">J</span><span className="sr-only">Jev 回答：</span><VerdictChip verdict={turn.verdict} /></div></li>)}</ol>
            {busy && <div className="thinking-message" role="status"><span className="reply-avatar">J</span><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span><span>Jev 正在想一想…</span></div>}
          </div>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{session.turns.length > 0 && `第 ${session.turns.length} 次提問，Jev 回答：${verdicts[session.turns[session.turns.length - 1].verdict].label}。已掌握 ${discovered} 個關鍵線索，共 ${total} 個。`}</div>

          {session.revealed ? <div className="conversation-finished"><CheckCircle2 size={18} /><span>這碗湯，已經見底。上方可以回味完整故事。</span></div> : <div className="composer-area">
            {ready && <div className="ready-banner"><Sparkles size={18} /><p>你已經接近故事的全貌。</p><button onClick={() => setModal("ready")} disabled={busy}>揭開湯底 <ArrowRight size={14} /></button></div>}
            {!configured && <div className="api-notice" role="status"><Settings2 size={19} /><div><strong>Jev 還在等候連線</strong><p>目前尚未設定後端。連接服務後，就能開始真正的推理對話。</p><button className="text-link" onClick={onSettings}>設定後端網址 <ArrowRight size={14} /></button></div></div>}
            {currentError && <div className="error-notice" role="alert"><div><strong>這次操作還沒有完成</strong><p>{currentError}</p><span>問題已保留，重試同一筆提問會同步紀錄，不會重複計次。</span></div><button className="icon-button" onClick={() => { clearError(); setSubmitError(""); }} aria-label="關閉錯誤訊息"><X size={16} /></button></div>}
            <form className="question-form" onSubmit={submit}>
              <label htmlFor="question-input" className="composer-label">你的下一個問題</label>
              <div className={`question-input-wrap ${busy ? "is-busy" : ""}`}><textarea id="question-input" ref={input} rows={2} maxLength={240} placeholder={configured ? "這件事，和＿＿有關嗎？" : "先設定連線，再開始提問…"} value={question} disabled={busy || !configured} onChange={(event) => { setQuestion(event.target.value); if (currentError) { clearError(); setSubmitError(""); } }} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229) { event.preventDefault(); void submit(); } }} aria-describedby="question-help" /><button type="submit" className="send-button" disabled={busy || !question.trim() || !configured} aria-label={busy ? "Jev 正在判斷" : currentError ? "重試提問" : "送出提問"}>{busy ? <LoaderCircle size={18} className="spin" /> : currentError ? <RotateCcw size={18} /> : <Send size={18} />}<span>{busy ? "思考中" : currentError ? "重試" : "提問"}</span></button></div>
              <div className="composer-footnote" id="question-help"><span><span className="desktop-input-tip">Enter 送出 · Shift + Enter 換行</span><span className="mobile-input-tip">一次問一件事，讓線索更清楚。</span></span><span>{question.length > 180 ? `${question.length} / 240` : "每個好問題，都算數。"}</span></div>
            </form>
          </div>}
        </section>
      </div>
      <p className="game-bottom-note">不急著找到答案，也是一種享受故事的方式。</p>

      {modal === "ready" && <Dialog title="是否揭開湯底？" eyebrow="YOU’RE CLOSE TO THE TRUTH" onClose={dismissReady} className="reveal-dialog"><span className="dialog-emblem"><Sparkles size={29} /></span><p className="dialog-intro">你已經掌握了關鍵線索。想現在看看完整故事，還是再享受一下推理的樂趣？</p><div className="reveal-count"><span>{discovered} / {total}</span> 關鍵線索已掌握</div><div className="dialog-actions dialog-actions-stacked"><button className="button button-primary" onClick={confirmReveal}>是，揭開湯底 <ArrowRight size={17} /></button><button className="button button-secondary" onClick={dismissReady}>我想再問問</button></div><p className="dialog-small-note">真相會等你。稍後也能隨時按「揭開湯底」。</p></Dialog>}
      {modal === "reset" && <Dialog title="重新煮這碗湯？" eyebrow="A FRESH START" onClose={() => setModal(null)}><p className="dialog-intro">這會清除「{story.title}」的提問記錄、線索與提示狀態。從第一個問題重新開始，確定嗎？</p><div className="dialog-actions"><button className="button button-secondary" onClick={() => setModal(null)}>保留進度</button><button className="button button-primary" onClick={confirmReset}><RotateCcw size={16} /> 確定重新開始</button></div></Dialog>}
      {modal === "surrender" && <Dialog title="確定要提前看湯底嗎？" eyebrow="PEEK BEHIND THE STORY" onClose={() => setModal(null)}><p className="dialog-intro">這會結束本次推理，直接顯示完整真相。揭曉後，就不能再用第一次的眼光看這個故事了。提前揭曉的紀錄不會列入湯客榜。</p><div className="gentle-note"><Lightbulb size={19} /><p>{session.hintUsed ? "也許再換一個問法，故事就會出現新的方向。" : "還沒試過小提示嗎？也許只差一點方向。"}</p></div><div className="dialog-actions dialog-actions-stacked"><button className="button button-primary" onClick={() => setModal(null)}>再讓我想想</button><button className="button button-secondary" onClick={confirmReveal}>確認結束推理並揭曉</button></div></Dialog>}
    </main>
  );
}

export default function App() {
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [lastStory, setLastStory] = useState(() => readSetting(LAST_STORY_KEY));
  const [customEndpoint, setCustomEndpoint] = useState(() => readSetting(SETTINGS_KEY));
  const [overlay, setOverlay] = useState<"help" | "settings" | "leaderboard" | null>(null);
  const [leaderboardStoryId, setLeaderboardStoryId] = useState(stories[0]?.id || "");
  const previousStoryId = useRef<string | null>(null);
  const endpoint = customEndpoint || DEFAULT_API_ENDPOINT;

  function selectStory(story: Story) {
    saveSetting(LAST_STORY_KEY, story.id);
    setLastStory(story.id);
    setActiveStory(story);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goHome() {
    setActiveStory(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openLeaderboard() {
    setLeaderboardStoryId(activeStory?.id || stories.find((story) => story.id === lastStory)?.id || stories[0]?.id || "");
    setOverlay("leaderboard");
  }

  useEffect(() => {
    document.title = activeStory ? `${activeStory.title} — 湯底之前` : "湯底之前 — BEFORE THE TRUTH";
    if (previousStoryId.current !== (activeStory?.id ?? null)) {
      document.querySelector<HTMLElement>("#main-content h1")?.focus({ preventScroll: true });
      previousStoryId.current = activeStory?.id ?? null;
    }
  }, [activeStory]);

  return (
    <>
      <a className="skip-link" href="#main-content">跳至主要內容</a>
      <Header inGame={!!activeStory} onHome={goHome} onHelp={() => setOverlay("help")} onSettings={() => setOverlay("settings")} onLeaderboard={openLeaderboard} />
      {activeStory ? <Game key={`${activeStory.id}:${endpoint}`} story={activeStory} endpoint={endpoint} onExit={goHome} onSettings={() => setOverlay("settings")} onHelp={() => setOverlay("help")} onLeaderboard={openLeaderboard} overlayOpen={!!overlay} /> : <Library lastStory={lastStory} onSelect={selectStory} onHelp={() => setOverlay("help")} />}
      <footer className="site-footer page-width"><div><BowlMark /><span>湯底之前 <i>/</i> BEFORE THE TRUTH</span></div><p>給故事一點時間，給直覺一點意外。</p><button className="text-link" onClick={() => setOverlay("help")}>關於這碗湯 <ArrowUpRight /></button></footer>
      {overlay === "help" && <HelpDialog onClose={() => setOverlay(null)} />}
      {overlay === "settings" && <SettingsDialog endpoint={customEndpoint} onClose={() => setOverlay(null)} onSave={(value) => { saveSetting(SETTINGS_KEY, value); setCustomEndpoint(value); setOverlay(null); }} />}
      {overlay === "leaderboard" && <LeaderboardDialog initialStoryId={leaderboardStoryId} endpoint={endpoint} onClose={() => setOverlay(null)} onSettings={() => setOverlay("settings")} />}
    </>
  );
}
