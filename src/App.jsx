import { useState, useEffect, useMemo, useRef } from "react";

const STORE_KEY = "diet-log-v1";
const SLOTS = [
  // due = 締め切り（0:00からの分数）。この時刻を過ぎて未入力ならバナーを出す
  { id: "m", label: "朝", lid: "#FFC53D", deep: "#8A5B00", due: 10 * 60 + 30, dueText: "10:30" },
  { id: "n", label: "昼", lid: "#4FD1A5", deep: "#0B6E4F", due: 14 * 60, dueText: "14:00" },
  { id: "e", label: "晩", lid: "#9D8BFF", deep: "#3B2BA3", due: 20 * 60, dueText: "20:00" },
];
// 体重の記録も同じ仕組みで催促する
const WEIGH_DUE = 10 * 60 + 30, WEIGH_DUE_TEXT = "10:30";
// ワンタップ日記（グラフの下に印が出る）
const TAGS = [
  { id: "move", label: "運動した", short: "運動", mark: "運", emoji: "🏃", color: "#4FD1A5" },
  { id: "eat", label: "食べすぎ", short: "食べすぎ", mark: "食", emoji: "🍰", color: "#FF9ABF" },
  { id: "drink", label: "お酒", short: "お酒", mark: "酒", emoji: "🍺", color: "#FFC53D" },
];
const C = { ink: "#2E2440", muted: "#7B6E8C", pink: "#FF5D8F", down: "#0FA36B", up: "#F2545B" };
const WD = ["日", "月", "火", "水", "木", "金", "土"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtMD = (k) => { const d = parseKey(k); return `${d.getMonth() + 1}/${d.getDate()}`; };
const fmtLong = (k) => { const d = parseKey(k); return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };
const diffDays = (a, b) => Math.round((parseKey(a) - parseKey(b)) / 86400000);
const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();
const nowHM = () => { const d = new Date(); return `${d.getHours()}:${pad(d.getMinutes())}`; };
const toHalf = (s) => String(s).replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，]/g, ".");
const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(1);
const signed2 = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(2);

// チャット内では window.storage、GitHub Pages などでは localStorage に自動で切り替え
async function loadData() {
  try {
    if (window.storage) {
      const r = await window.storage.get(STORE_KEY, false);
      return r ? JSON.parse(r.value) : null;
    }
    const v = window.localStorage.getItem(STORE_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
async function saveData(data) {
  try {
    const s = JSON.stringify(data);
    if (window.storage) { const r = await window.storage.set(STORE_KEY, s, false); return !!r; }
    window.localStorage.setItem(STORE_KEY, s);
    return true;
  } catch { return false; }
}

const CSS = `
.dl{font-family:"Hiragino Maru Gothic ProN","Zen Maru Gothic","Hiragino Sans","Noto Sans CJK JP",sans-serif;
 background-color:#FFF3DC;background-image:radial-gradient(#F4E2C0 2.2px,transparent 2.2px);background-size:24px 24px;
 color:#2E2440;min-height:100vh;font-weight:600;font-feature-settings:"palt"}
.dl *{box-sizing:border-box}
.dl-wrap{max-width:460px;margin:0 auto;padding:calc(env(safe-area-inset-top) + 20px) 18px calc(env(safe-area-inset-bottom) + 60px)}
.dl button{font-family:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.dl button:focus-visible,.dl input:focus-visible{outline:3px solid #FF5D8F;outline-offset:3px}
.num{font-variant-numeric:tabular-nums}
.pop{border:3px solid #2E2440;border-radius:22px;background:#fff;box-shadow:4px 5px 0 #2E2440}
.head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.h1{font-size:27px;font-weight:900;margin:0;letter-spacing:.01em}
.badge{flex:none;background:#FFC53D;border:3px solid #2E2440;border-radius:999px;box-shadow:3px 3px 0 #2E2440;
 padding:7px 13px;font-size:14px;font-weight:900;white-space:nowrap;transform:rotate(3deg)}
.sub{font-size:14px;color:#7B6E8C;margin:8px 0 0;font-weight:700}
.sec{margin-top:34px}
.h2{font-size:19px;font-weight:900;margin:0 0 12px;display:flex;align-items:center;gap:8px}
.h2:before{content:"";width:14px;height:14px;border-radius:5px;background:#FF5D8F;border:3px solid #2E2440;flex:none}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.case{padding:13px;display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-top:20px}
.comp{position:relative;height:142px;border:none;padding:0;background:#F6EEDF;border-radius:17px;
 box-shadow:inset 0 3px 8px rgba(46,36,64,.17);perspective:720px}
.inside{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:15px;gap:2px}
.inside-t{font-size:16px;font-weight:900}
.inside-s{font-size:11px;color:#7B6E8C;font-weight:700}
.lid{position:absolute;inset:-1px;border:3px solid #2E2440;border-radius:18px;transform-origin:top center;
 transition:transform .5s cubic-bezier(.3,1.5,.5,1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
 box-shadow:0 4px 0 #2E2440}
.lid-l{font-size:36px;font-weight:900;line-height:1}
.lid-s{font-size:12px;font-weight:900;opacity:.72}
.comp[aria-pressed="true"] .lid{transform:rotateX(78deg)}
.comp[aria-pressed="true"] .lid > *{opacity:0}
.comp:active .lid{transform:translateY(3px);box-shadow:0 1px 0 #2E2440}
.comp[aria-pressed="true"]:active .lid{transform:rotateX(70deg)}
.week{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-top:14px}
.day{border:3px solid transparent;background:transparent;border-radius:15px;padding:8px 0 6px;display:flex;flex-direction:column;align-items:center;gap:4px}
.day[aria-current="true"]{border-color:#2E2440;background:#fff;box-shadow:3px 3px 0 #2E2440}
.dot{width:17px;height:9px;border-radius:4px;background:#E8DCC6;border:1.5px solid rgba(46,36,64,.18)}
.dot.on{border-color:#2E2440}
.day-l{font-size:11px;color:#7B6E8C;margin-top:2px;font-weight:800}
.tags-l{font-size:13px;font-weight:800;color:#7B6E8C;margin:20px 0 9px}
.tags{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.tag{border:3px solid #2E2440;border-radius:17px;background:#fff;box-shadow:3px 4px 0 #2E2440;padding:11px 4px 10px;
 font-size:13px;font-weight:900;display:flex;flex-direction:column;align-items:center;gap:5px}
.tag .e{font-size:21px;line-height:1}
.tag[aria-pressed="true"]{transform:translate(2px,3px);box-shadow:1px 1px 0 #2E2440}
.wform{display:flex;gap:9px}
.wbox{flex:1;position:relative}
.winput{width:100%;font-family:inherit;font-size:32px;font-weight:900;color:#2E2440;padding:11px 50px 11px 16px;
 border:3px solid #2E2440;border-radius:18px;background:#fff;box-shadow:4px 4px 0 #2E2440}
.winput::placeholder{color:#CFC3B0}
.kg{position:absolute;right:17px;top:50%;transform:translateY(-50%);color:#7B6E8C;font-weight:900}
.primary{background:#FF5D8F;color:#fff!important;border:3px solid #2E2440;border-radius:999px;padding:0 20px;
 font-size:16px;font-weight:900;white-space:nowrap;box-shadow:4px 4px 0 #2E2440}
.primary:active{transform:translate(3px,3px);box-shadow:0 0 0 #2E2440}
.date-in{font-family:inherit;font-size:15px;font-weight:700;border:3px solid #2E2440;border-radius:14px;padding:6px 10px;
 background:#fff;color:#2E2440;box-shadow:3px 3px 0 #2E2440}
.hint{font-size:13px;color:#7B6E8C;margin:10px 0 0;font-weight:700;line-height:1.6}
.chip{display:inline-block;background:#FFE9A8;border:3px solid #2E2440;border-radius:999px;box-shadow:3px 3px 0 #2E2440;
 padding:8px 14px;font-size:13px;font-weight:900;margin-top:13px}
.seg{display:inline-flex;background:#fff;border:3px solid #2E2440;border-radius:999px;padding:3px;box-shadow:3px 3px 0 #2E2440}
.seg button{border:none;background:transparent;padding:6px 10px;border-radius:999px;font-size:13px;font-weight:900;color:#7B6E8C}
.seg button[aria-pressed="true"]{background:#2E2440;color:#fff}
.chart{padding:14px 9px 8px;margin-top:14px}
.chart svg{display:block;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:12px;color:#7B6E8C;font-weight:800;padding:6px 10px 2px}
.legend i{display:inline-block;width:20px;height:0;border-top:3px solid #2E2440;vertical-align:middle;margin-right:6px;border-radius:2px}
.legend i.avg{border-top:3px dashed #B9A9D6}
.empty{height:180px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:14px;color:#7B6E8C;padding:0 26px;line-height:1.8;font-weight:700}
.pace{margin-top:16px;padding:15px 17px}
.pace-l{font-size:13px;font-weight:900;color:#5E5270}
.pace-v{font-size:28px;font-weight:900;line-height:1.15;margin-top:3px}
.pace-v small{font-size:13px;font-weight:900;margin-left:5px}
.pace-s{font-size:13px;font-weight:800;color:#3F3553;margin-top:6px;line-height:1.6}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:14px}
.stat{border:3px solid #2E2440;border-radius:18px;box-shadow:3px 4px 0 #2E2440;padding:12px 4px 10px;text-align:center}
.stat-v{font-size:21px;font-weight:900;line-height:1.2}
.stat-l{font-size:11px;color:#5E5270;margin-top:3px;font-weight:800}
.goal{display:flex;align-items:center;gap:9px;font-size:15px;font-weight:800;margin-top:16px}
.goal input{width:96px;font-family:inherit;font-size:17px;font-weight:900;border:3px solid #2E2440;border-radius:14px;
 padding:6px 10px;background:#fff;color:#2E2440;box-shadow:3px 3px 0 #2E2440}
.sum{padding:2px 16px 15px}
.srow{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:3px solid #F0E7D6;
 font-size:14px;font-weight:800}
.srow-l{color:#5E5270}
.sv{font-size:17px;font-weight:900;white-space:nowrap}
.sv small{font-size:12px;font-weight:900;margin-left:5px}
.cmt{background:#FFF3DC;border:3px solid #2E2440;border-radius:15px;padding:11px 14px;font-size:13px;font-weight:800;
 line-height:1.65;margin-top:14px}
.hist{list-style:none;padding:0;margin:0;overflow:hidden}
.hrow{display:flex;align-items:center}
.hrow+.hrow{border-top:3px solid #F0E7D6}
.hmain{flex:1;display:flex;align-items:center;justify-content:space-between;gap:8px;border:none;background:transparent;
 padding:14px 6px 14px 16px;text-align:left;font-size:15px;font-weight:700}
.hw{font-weight:900;font-size:18px}
.hd{font-size:13px;font-weight:900;min-width:48px;text-align:right}
.del{border:none;background:transparent;font-size:13px;font-weight:800;color:#7B6E8C!important;padding:14px;white-space:nowrap}
.del.on{color:#F2545B!important;font-weight:900}
.more{display:block;width:100%;border:none;background:transparent;padding:15px;font-size:14px;font-weight:900;color:#7B6E8C}
.toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 26px);transform:translateX(-50%);
 background:#2E2440;color:#fff;padding:12px 20px;border:3px solid #2E2440;border-radius:999px;font-size:14px;font-weight:900;
 white-space:nowrap;z-index:10;box-shadow:4px 4px 0 rgba(46,36,64,.25);animation:pop .3s cubic-bezier(.3,1.6,.5,1)}
.warn{background:#FFE3E0;color:#9E2F2A;border:3px solid #2E2440;border-radius:16px;padding:11px 14px;font-size:13px;
 margin-top:16px;line-height:1.6;font-weight:800;box-shadow:3px 3px 0 #2E2440}
.alerts{position:sticky;top:calc(env(safe-area-inset-top) + 8px);z-index:5;display:flex;flex-direction:column;gap:9px;margin-top:16px}
.alert{display:flex;align-items:center;gap:10px;background:#fff;border:3px solid #2E2440;border-radius:20px;
 padding:11px 6px 11px 11px;box-shadow:4px 5px 0 #2E2440;animation:drop .35s cubic-bezier(.3,1.5,.5,1)}
.alert-mark{width:10px;align-self:stretch;border-radius:5px;border:2px solid #2E2440;flex:none}
.alert-body{flex:1;min-width:0}
.alert-t{font-size:15px;font-weight:900}
.alert-s{font-size:12px;color:#7B6E8C;margin-top:2px;font-weight:700}
.alert .primary{padding:9px 15px;font-size:14px;box-shadow:3px 3px 0 #2E2440}
.x{border:none;background:transparent;font-size:22px;line-height:1;padding:6px 8px;color:#7B6E8C!important;font-weight:900}
@keyframes drop{from{transform:translateY(-10px);opacity:0}to{transform:none;opacity:1}}
@keyframes pop{from{transform:translateX(-50%) scale(.86);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.lid{transition:none}.alert,.toast{animation:none}}
`;

export default function DietLog() {
  const initToday = keyOf(new Date());
  const [data, setData] = useState({ weights: {}, supps: {}, tags: {}, goal: null });
  const [loaded, setLoaded] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [today, setToday] = useState(initToday);
  const [pillDay, setPillDay] = useState(initToday);
  const [wDate, setWDate] = useState(initToday);
  const [wVal, setWVal] = useState("");
  const [range, setRange] = useState(30);
  const [toast, setToast] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [nowMin, setNowMin] = useState(minutesOf(new Date()));
  const [dismissed, setDismissed] = useState([]); // バナーを×で閉じたもの（日付-枠）
  const toastTimer = useRef(null);
  const formRef = useRef(null);
  const inputRef = useRef(null);
  const prevToday = useRef(initToday);

  useEffect(() => {
    loadData().then((d) => {
      if (d) {
        setData({ weights: d.weights || {}, supps: d.supps || {}, tags: d.tags || {}, goal: d.goal ?? null });
        if (d.goal) setGoalDraft(String(d.goal));
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveData(data).then((ok) => setSaveFailed(!ok));
  }, [data, loaded]);

  // 次の区切り（10:30 / 14:00 / 20:00 / 0:00）ちょうどに時刻と日付を更新する
  // （画面ロック中はタイマーが止まるので、アプリに戻った瞬間にもチェック）
  useEffect(() => {
    let timer;
    const tick = () => {
      const d = new Date();
      setToday(keyOf(d));
      setNowMin(minutesOf(d));
    };
    const schedule = () => {
      clearTimeout(timer);
      const now = new Date();
      const next = [...SLOTS.map((s) => s.due), WEIGH_DUE, 24 * 60]
        .sort((a, b) => a - b)
        .map((m) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, m, 0, 50))
        .find((t) => t > now);
      timer = setTimeout(() => {
        tick();
        schedule(); // 早めに発火しても、次の区切りを計算し直すので自動で補正される
      }, next - now);
    };
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      tick();
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);
  useEffect(() => {
    if (prevToday.current !== today) {
      setPillDay(today); setWDate(today); prevToday.current = today;
    }
  }, [today]);

  const flash = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  };

  // ---- サプリ ----
  const toggleSlot = (day, id) => {
    setData((p) => {
      const s = { ...(p.supps[day] || {}) };
      if (s[id]) delete s[id];
      else s[id] = day === today ? nowHM() : "記録済み";
      return { ...p, supps: { ...p.supps, [day]: s } };
    });
  };
  const fullDay = (k) => { const s = data.supps[k]; return !!s && SLOTS.every((x) => s[x.id]); };
  let streak = 0;
  {
    let d = parseKey(today);
    if (!fullDay(today)) d = addDays(d, -1);
    while (fullDay(keyOf(d))) { streak++; d = addDays(d, -1); }
  }
  const week = Array.from({ length: 7 }, (_, i) => keyOf(addDays(parseKey(today), i - 6)));
  const daySupps = data.supps[pillDay] || {};
  const todaySupps = data.supps[today] || {};
  const takenToday = SLOTS.filter((s) => todaySupps[s.id]).length;

  // ---- ワンタップ日記 ----
  const dayTags = data.tags[pillDay] || {};
  const toggleTag = (day, id) => {
    setData((p) => {
      const t = { ...(p.tags[day] || {}) };
      if (t[id]) delete t[id]; else t[id] = true;
      return { ...p, tags: { ...p.tags, [day]: t } };
    });
  };

  // ---- 体重 ----
  const entries = useMemo(
    () => Object.entries(data.weights).map(([k, w]) => ({ k, w })).sort((a, b) => (a.k < b.k ? -1 : 1)),
    [data.weights]
  );
  const withAvg = useMemo(
    () => entries.map((e, i) => {
      let s = 0, n = 0;
      for (let j = i; j >= 0; j--) {
        if (diffDays(e.k, entries[j].k) > 6) break;
        s += entries[j].w; n++;
      }
      return { ...e, avg: Math.round((s / n) * 10) / 10, t: parseKey(e.k).getTime() };
    }),
    [entries]
  );
  const chartData = useMemo(
    () => withAvg.filter((e) => range === 0 || diffDays(today, e.k) < range),
    [withAvg, range, today]
  );

  const latest = entries[entries.length - 1];
  const prev = entries[entries.length - 2];
  const first = entries[0];
  const avgIn = (from, to) => {
    const xs = entries.filter((e) => { const d = diffDays(today, e.k); return d >= from && d <= to; });
    return xs.length ? xs.reduce((s, e) => s + e.w, 0) / xs.length : null;
  };
  const thisWeek = avgIn(0, 6), lastWeek = avgIn(7, 13);
  const weighedToday = data.weights[today] != null;

  // 記録ストリーク（体重を測った日が何日続いているか）
  let weighStreak = 0;
  {
    let d = parseKey(today);
    if (!weighedToday) d = addDays(d, -1);
    while (data.weights[keyOf(d)] != null) { weighStreak++; d = addDays(d, -1); }
  }

  // ---- 今のペース（最小二乗法で直近4週間の傾きを出す）----
  const pace = useMemo(() => {
    const recent = entries.filter((e) => diffDays(today, e.k) <= 27 && diffDays(today, e.k) >= 0);
    if (recent.length < 6) return null;
    const span = diffDays(recent[recent.length - 1].k, recent[0].k);
    if (span < 13) return null;
    const xs = recent.map((e) => diffDays(e.k, recent[0].k));
    const ys = recent.map((e) => e.w);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    if (!den) return null;
    const perDay = num / den;
    return { perDay, perWeek: perDay * 7, days: span + 1, points: n };
  }, [entries, today]);

  const fmtEta = (k) => {
    const d = parseKey(k), thisYear = parseKey(today).getFullYear();
    return `${d.getFullYear() !== thisYear ? `${d.getFullYear()}年` : ""}${d.getMonth() + 1}月${d.getDate()}日ごろ`;
  };
  const paceNote = (() => {
    if (!pace) return null;
    const cur = thisWeek ?? (latest ? latest.w : null);
    if (data.goal == null || cur == null) return "目標体重を決めると、到達の予想日も出ます";
    const remain = cur - data.goal;
    if (remain <= 0) return "目標を達成しています";
    if (pace.perDay > -0.003) return "いまは横ばい〜増加傾向なので、到達日はまだ出せません";
    const days = Math.ceil(remain / -pace.perDay);
    if (days > 730) return "このペースだと到達まで2年以上かかります";
    return `このペースなら、目標まであと${remain.toFixed(1)}kg。${fmtEta(keyOf(addDays(parseKey(today), days)))}に届く計算です`;
  })();
  const paceBg = !pace ? "#fff" : pace.perWeek <= -0.05 ? "#C5F2E0" : pace.perWeek >= 0.05 ? "#FFD9D6" : "#FFE9A8";

  // ---- この7日間のまとめ ----
  const summary = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => keyOf(addDays(parseKey(today), -i)));
    const weighed = days.filter((k) => data.weights[k] != null).length;
    const supps = days.reduce((s, k) => s + SLOTS.filter((x) => (data.supps[k] || {})[x.id]).length, 0);
    const tagCount = {};
    TAGS.forEach((t) => { tagCount[t.id] = days.filter((k) => (data.tags[k] || {})[t.id]).length; });
    return { weighed, supps, tagCount };
  }, [data, today]);

  const comment = (() => {
    const lines = [];
    if (summary.weighed <= 3) lines.push("測った日が少ないと傾向が読みにくいです。まずは毎朝のせるところから。");
    else if (thisWeek != null && lastWeek != null) {
      const d = thisWeek - lastWeek;
      if (d <= -0.15) lines.push("7日平均が先週より下がっています。いいペースです。");
      else if (d >= 0.15) lines.push("7日平均が少し上がっています。1〜2kgの増減は水分でも起きるので、来週の平均で見ていきましょう。");
      else lines.push("7日平均はほぼ横ばいです。体重は日々1〜2kg動くので、平均の線で判断するのが確実です。");
    }
    if (summary.supps === 21) lines.push("サプリは21回すべて飲めています。");
    else if (summary.supps >= 15) lines.push(`サプリは21回中${summary.supps}回。いい調子です。`);
    if (summary.tagCount.move >= 3) lines.push(`運動した日が${summary.tagCount.move}日ありました。`);
    return lines.slice(0, 3).join(" ");
  })();

  const saveWeight = () => {
    const v = parseFloat(toHalf(wVal));
    if (!Number.isFinite(v) || v < 20 || v > 300) { flash("20〜300の数字で入力してね"); return; }
    setData((p) => ({ ...p, weights: { ...p.weights, [wDate]: Math.round(v * 10) / 10 } }));
    setWVal("");
    flash(`${fmtMD(wDate)}の体重を記録しました`);
    if (wDate !== today) setWDate(today);
  };
  const focusWeight = () => {
    setWDate(today);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => inputRef.current?.focus(), 420);
  };
  const delWeight = (k) => {
    if (confirmDel !== k) { setConfirmDel(k); return; }
    setData((p) => { const w = { ...p.weights }; delete w[k]; return { ...p, weights: w }; });
    setConfirmDel(null);
    flash("削除しました");
  };
  const editWeight = (e) => {
    setWDate(e.k); setWVal(String(e.w)); setConfirmDel(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const saveGoal = () => {
    const v = parseFloat(toHalf(goalDraft));
    const g = Number.isFinite(v) && v >= 20 && v <= 300 ? Math.round(v * 10) / 10 : null;
    setGoalDraft(g ? String(g) : "");
    setData((p) => ({ ...p, goal: g }));
  };

  // ---- バナー（体重とサプリ）----
  const alerts = [];
  if (nowMin >= WEIGH_DUE && !weighedToday && !dismissed.includes(`${today}-w`)) {
    alerts.push({
      key: "w", color: C.pink, title: "今日の体重、まだ測ってません",
      sub: `${WEIGH_DUE_TEXT}を過ぎました`, btn: "入力する", act: focusWeight,
    });
  }
  SLOTS.forEach((s) => {
    if (nowMin >= s.due && !todaySupps[s.id] && !dismissed.includes(`${today}-${s.id}`)) {
      alerts.push({
        key: s.id, color: s.lid, title: `${s.label}のサプリ、まだです！`,
        sub: `${s.dueText}を過ぎました`, btn: "飲んだ",
        act: () => { toggleSlot(today, s.id); flash(`${s.label}のサプリを記録しました`); },
      });
    }
  });

  // 画面を覆わないよう、同時に出すバナーは2つまで（残りはピルケース側で分かる）
  const shownAlerts = alerts.slice(0, 2);

  const hist = [...entries].reverse();
  const shown = showAll ? hist : hist.slice(0, 14);
  const diffColor = (v) => (v < 0 ? C.down : v > 0 ? C.up : C.muted);

  if (!loaded) {
    return (<div className="dl"><style>{CSS}</style><div className="dl-wrap"><p className="sub">読み込み中…</p></div></div>);
  }

  return (
    <div className="dl">
      <style>{CSS}</style>
      <div className="dl-wrap">
        <header>
          <div className="head">
            <h1 className="h1">{fmtLong(today)}</h1>
            {streak > 0 && <div className="badge">🔥 {streak}日連続</div>}
          </div>
          <p className="sub">
            {takenToday === 3 ? "今日は3回ぜんぶクリア！" :
              takenToday > 0 ? `今日は${takenToday}回ぶん飲みました` : "サプリを飲んだらフタをタップ"}
          </p>
        </header>

        {saveFailed && (
          <div className="warn">このブラウザでは保存できませんでした。アプリを閉じると記録が消えます。</div>
        )}

        {/* 飲み忘れ・測り忘れバナー */}
        {shownAlerts.length > 0 && (
          <div className="alerts" role="alert">
            {shownAlerts.map((a) => (
              <div key={a.key} className="alert">
                <span className="alert-mark" style={{ background: a.color }} />
                <div className="alert-body">
                  <div className="alert-t">{a.title}</div>
                  <div className="alert-s">{a.sub}</div>
                </div>
                <button className="primary" onClick={a.act}>{a.btn}</button>
                <button className="x" aria-label="閉じる"
                  onClick={() => setDismissed((d) => [...d, `${today}-${a.key === "w" ? "w" : a.key}`])}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* サプリ：ピルケース */}
        <div className="case pop" role="group" aria-label={`${fmtLong(pillDay)}のサプリ`}>
          {SLOTS.map((s) => {
            const taken = daySupps[s.id];
            return (
              <button
                key={s.id}
                className="comp"
                aria-pressed={!!taken}
                aria-label={`${s.label}のサプリ ${taken ? "飲んだ" : "まだ"}`}
                onClick={() => toggleSlot(pillDay, s.id)}
              >
                <div className="inside">
                  <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
                    <circle cx="19" cy="19" r="16" fill={s.lid} stroke={C.ink} strokeWidth="3" />
                    <path d="M11 19.5l5 5L27 13" fill="none" stroke={C.ink} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="inside-t num">{taken || ""}</span>
                  <span className="inside-s">{s.label}に飲んだ</span>
                </div>
                <div className="lid" style={{ background: s.lid }}>
                  <span className="lid-l">{s.label}</span>
                  <span className="lid-s">{pillDay === today ? `${s.dueText}まで` : "未記録"}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="week" aria-label="この1週間">
          {week.map((k) => {
            const s = data.supps[k] || {};
            const d = parseKey(k);
            return (
              <button key={k} className="day" aria-current={k === pillDay} onClick={() => setPillDay(k)}
                aria-label={`${fmtLong(k)} ${SLOTS.filter((x) => s[x.id]).length}回飲んだ`}>
                {SLOTS.map((x) => (
                  <span key={x.id} className={s[x.id] ? "dot on" : "dot"} style={s[x.id] ? { background: x.lid } : undefined} />
                ))}
                <span className="day-l">{k === today ? "今日" : `${WD[d.getDay()]} ${d.getDate()}`}</span>
              </button>
            );
          })}
        </div>
        {pillDay !== today && (
          <p className="hint">{fmtLong(pillDay)}の記録を表示中。タップで修正できます。</p>
        )}

        {/* ワンタップ日記 */}
        <p className="tags-l">{pillDay === today ? "今日" : fmtMD(pillDay)}のできごと（タップで記録）</p>
        <div className="tags">
          {TAGS.map((t) => (
            <button key={t.id} className="tag" aria-pressed={!!dayTags[t.id]}
              style={dayTags[t.id] ? { background: t.color } : undefined}
              aria-label={`${t.label} ${dayTags[t.id] ? "記録済み" : "未記録"}`}
              onClick={() => toggleTag(pillDay, t.id)}>
              <span className="e" aria-hidden="true">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* 体重入力 */}
        <section className="sec" ref={formRef}>
          <div className="row" style={{ marginBottom: 14 }}>
            <h2 className="h2" style={{ margin: 0 }}>体重</h2>
            <input type="date" className="date-in" value={wDate} max={today}
              onChange={(e) => e.target.value && setWDate(e.target.value)} aria-label="記録する日" />
          </div>
          <div className="wform">
            <div className="wbox">
              <input ref={inputRef} className="winput num" inputMode="decimal" placeholder={latest ? latest.w.toFixed(1) : "00.0"}
                value={wVal} onChange={(e) => setWVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveWeight()} aria-label="体重（kg）" />
              <span className="kg">kg</span>
            </div>
            <button className="primary" onClick={saveWeight}>記録</button>
          </div>
          {data.weights[wDate] != null && (
            <p className="hint">{fmtMD(wDate)}は {data.weights[wDate].toFixed(1)}kg で記録済み。記録すると上書きします。</p>
          )}
          {weighStreak > 0 && (
            <div className="chip">
              {weighedToday ? `🔥 ${weighStreak}日連続で記録中` : `昨日まで${weighStreak}日連続。今日も測ろう`}
            </div>
          )}
        </section>

        {/* グラフ */}
        <section className="sec">
          <div className="row">
            <h2 className="h2" style={{ margin: 0 }}>変化</h2>
            <div className="seg" role="group" aria-label="表示期間">
              {[[7, "1週"], [30, "1ヶ月"], [90, "3ヶ月"], [0, "全部"]].map(([v, l]) => (
                <button key={v} aria-pressed={range === v} onClick={() => setRange(v)}>{l}</button>
              ))}
            </div>
          </div>

          <div className="chart pop">
            {chartData.length < 2 ? (
              <div className="empty">この期間の記録が2日分たまるとグラフが出ます</div>
            ) : (
              <>
                <WeightChart data={chartData} goal={data.goal} tags={data.tags} />
                <div className="legend">
                  <span><i />体重</span>
                  <span><i className="avg" />7日平均</span>
                  {TAGS.map((t) => <span key={t.id}>{t.emoji} {t.short}</span>)}
                </div>
              </>
            )}
          </div>

          {/* 今のペース */}
          {pace ? (
            <div className="pace pop" style={{ background: paceBg }}>
              <div className="pace-l">今のペース（直近{pace.days}日）</div>
              <div className="pace-v num">{signed2(pace.perWeek)}<small>kg / 週</small></div>
              {paceNote && <div className="pace-s">{paceNote}</div>}
            </div>
          ) : (
            <p className="hint">記録が2週間ぶんたまると、週あたりのペースと目標到達の予想日を出します。</p>
          )}

          <div className="stats">
            <div className="stat" style={{ background: "#FFE9A8" }}>
              <div className="stat-v num" style={{ color: latest && prev ? diffColor(latest.w - prev.w) : C.muted }}>
                {latest && prev ? signed(latest.w - prev.w) : "—"}
              </div>
              <div className="stat-l">前回から</div>
            </div>
            <div className="stat" style={{ background: "#C5F2E0" }}>
              <div className="stat-v num" style={{ color: latest && first && entries.length > 1 ? diffColor(latest.w - first.w) : C.muted }}>
                {latest && first && entries.length > 1 ? signed(latest.w - first.w) : "—"}
              </div>
              <div className="stat-l">記録開始から</div>
            </div>
            <div className="stat" style={{ background: "#DFD8FF" }}>
              <div className="stat-v num">
                {latest && data.goal ? (latest.w - data.goal <= 0 ? "達成" : `${(latest.w - data.goal).toFixed(1)}`) : "—"}
              </div>
              <div className="stat-l">目標まで（kg）</div>
            </div>
          </div>

          <label className="goal">
            目標体重
            <input className="num" inputMode="decimal" placeholder="未設定" value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)} onBlur={saveGoal}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
            kg
          </label>
        </section>

        {/* この7日間のまとめ */}
        <section className="sec">
          <h2 className="h2">この7日間</h2>
          <div className="sum pop">
            <div className="srow">
              <span className="srow-l">平均体重</span>
              <span className="sv num">
                {thisWeek != null ? `${thisWeek.toFixed(1)}kg` : "—"}
                {thisWeek != null && lastWeek != null && (
                  <small style={{ color: diffColor(thisWeek - lastWeek) }}>先週より {signed(thisWeek - lastWeek)}</small>
                )}
              </span>
            </div>
            <div className="srow">
              <span className="srow-l">測った日</span>
              <span className="sv num">{summary.weighed} / 7日</span>
            </div>
            <div className="srow">
              <span className="srow-l">サプリ</span>
              <span className="sv num">{summary.supps} / 21回</span>
            </div>
            <div className="srow">
              <span className="srow-l">できごと</span>
              <span className="sv num">
                {TAGS.map((t) => `${t.emoji}${summary.tagCount[t.id]}日`).join(" ")}
              </span>
            </div>
            {comment && <div className="cmt">{comment}</div>}
          </div>
        </section>

        {/* 履歴 */}
        {hist.length > 0 && (
          <section className="sec">
            <h2 className="h2">記録一覧</h2>
            <ul className="hist pop">
              {shown.map((e, i) => {
                const older = hist[i + 1];
                const d = older ? e.w - older.w : null;
                const et = data.tags[e.k] || {};
                return (
                  <li key={e.k} className="hrow">
                    <button className="hmain" onClick={() => editWeight(e)} aria-label={`${fmtLong(e.k)} ${e.w}kg を修正`}>
                      <span>
                        {fmtLong(e.k)}
                        <span aria-hidden="true" style={{ marginLeft: 6 }}>
                          {TAGS.filter((t) => et[t.id]).map((t) => t.emoji).join("")}
                        </span>
                      </span>
                      <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                        <span className="hw num">{e.w.toFixed(1)}</span>
                        <span className="hd num" style={{ color: d == null ? C.muted : diffColor(d) }}>
                          {d == null ? "" : signed(d)}
                        </span>
                      </span>
                    </button>
                    <button className={`del${confirmDel === e.k ? " on" : ""}`} onClick={() => delWeight(e.k)}>
                      {confirmDel === e.k ? "削除する" : "削除"}
                    </button>
                  </li>
                );
              })}
            </ul>
            {hist.length > 14 && (
              <button className="more" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "最近の14件だけ表示" : `すべて表示（${hist.length}件）`}
              </button>
            )}
          </section>
        )}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

// 体重グラフ（外部ライブラリなしのSVG）。タップ／なぞると数値が出る
function WeightChart({ data, goal, tags }) {
  const wrapRef = useRef(null);
  const [W, setW] = useState(340);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setSel(null), [data]);

  const H = 220, L = 40, R = 12, T = 14, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const vals = data.flatMap((e) => [e.w, e.avg]);
  const rawLo = Math.min(...vals), rawHi = Math.max(...vals);
  const span = rawHi - rawLo;
  const step = span <= 1.5 ? 0.5 : span <= 4 ? 1 : span <= 10 ? 2 : 5;
  let lo = Math.floor((rawLo - step * 0.3) / step) * step;
  let hi = Math.ceil((rawHi + step * 0.3) / step) * step;
  if (hi - lo < step * 2) hi = lo + step * 2;
  // 目標線が近ければグラフに入れる（遠すぎる時は入れない＝線がつぶれないように）
  if (goal != null) {
    if (goal < lo && goal >= lo - step * 2) lo = Math.floor((goal - step * 0.3) / step) * step;
    else if (goal > hi && goal <= hi + step * 2) hi = Math.ceil((goal + step * 0.3) / step) * step;
  }

  const t0 = data[0].t, t1 = data[data.length - 1].t;
  const x = (t) => L + ((t - t0) / (t1 - t0 || 1)) * pw;
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * ph;

  // ワンタップ日記の印（グラフの下の帯）
  const marks = useMemo(() => {
    const out = [];
    Object.entries(tags || {}).forEach(([k, v]) => {
      if (!v || !TAGS.some((t) => v[t.id])) return;
      const t = parseKey(k).getTime();
      if (t < t0 || t > t1) return;
      out.push({ k, t, v });
    });
    return out;
  }, [tags, t0, t1]);
  const bandH = marks.length ? 14 + TAGS.length * 15 : 0;
  const bandTop = H + 2;

  const yTicks = [];
  for (let v = lo; v <= hi + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10);
  const days = Math.round((t1 - t0) / 86400000);
  const nX = Math.max(2, Math.min(4, days + 1));
  const xTicks = [...new Set(Array.from({ length: nX }, (_, i) =>
    keyOf(addDays(new Date(t0), Math.round((days * i) / (nX - 1))))
  ))];

  const path = (key) => data.map((e, i) => `${i ? "L" : "M"}${x(e.t).toFixed(1)} ${y(e[key]).toFixed(1)}`).join(" ");
  const r = data.length > 45 ? 2.5 : 4;

  const pick = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const px = (ev.clientX - rect.left) * (W / rect.width);
    let best = 0, bd = Infinity;
    data.forEach((e, i) => { const d = Math.abs(x(e.t) - px); if (d < bd) { bd = d; best = i; } });
    setSel(best);
  };

  const s = sel != null ? data[sel] : null;
  const sTags = s ? TAGS.filter((t) => (tags?.[s.k] || {})[t.id]) : [];
  const boxW = 136, boxH = sTags.length ? 78 : 60;
  const boxX = s ? Math.min(Math.max(x(s.t) - boxW / 2, L), W - R - boxW) : 0;

  return (
    <div ref={wrapRef}>
      <svg width={W} height={H + bandH} viewBox={`0 0 ${W} ${H + bandH}`} role="img" aria-label="体重の推移グラフ"
        onPointerDown={pick}
        onPointerMove={(e) => (e.pointerType !== "mouse" || e.buttons || sel != null) && pick(e)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setSel(null)}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#F0E7D6" strokeWidth="2" />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fontWeight="700" fill={C.muted} className="num">{v.toFixed(1)}</text>
          </g>
        ))}
        {xTicks.map((k, i) => {
          const tx = x(parseKey(k).getTime());
          const anchor = i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle";
          return <text key={k} x={tx} y={H - 6} textAnchor={anchor} fontSize="11" fontWeight="700" fill={C.muted}>{fmtMD(k)}</text>;
        })}
        {goal != null && goal >= lo && goal <= hi && (
          <g>
            <line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} stroke={C.pink} strokeDasharray="6 5" strokeWidth="3" strokeLinecap="round" />
            <text x={W - R} y={y(goal) - 7} textAnchor="end" fontSize="11" fontWeight="900" fill={C.pink}>目標 {goal.toFixed(1)}</text>
          </g>
        )}
        <path d={path("avg")} fill="none" stroke="#B9A9D6" strokeWidth="3" strokeDasharray="5 4"
          strokeLinejoin="round" strokeLinecap="round" />
        <path d={path("w")} fill="none" stroke={C.ink} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((e) => <circle key={e.k} cx={x(e.t)} cy={y(e.w)} r={r} fill="#fff" stroke={C.ink} strokeWidth="2.5" />)}

        {/* できごとの印 */}
        {bandH > 0 && TAGS.map((t, i) => {
          const ry = bandTop + 10 + i * 15;
          return (
            <g key={t.id}>
              <text x={L - 6} y={ry + 4} textAnchor="end" fontSize="10" fontWeight="900" fill={C.muted}>{t.mark}</text>
              <line x1={L} x2={W - R} y1={ry} y2={ry} stroke="#F4EADA" strokeWidth="2" />
              {marks.filter((m) => m.v[t.id]).map((m) => (
                <circle key={m.k} cx={x(m.t)} cy={ry} r="4.5" fill={t.color} stroke={C.ink} strokeWidth="2" />
              ))}
            </g>
          );
        })}

        {s && (
          <g pointerEvents="none">
            <line x1={x(s.t)} x2={x(s.t)} y1={T} y2={T + ph} stroke={C.ink} strokeOpacity=".3" strokeWidth="2" />
            <circle cx={x(s.t)} cy={y(s.w)} r="7" fill={C.pink} stroke={C.ink} strokeWidth="3" />
            <rect x={boxX + 3} y={T + 4} width={boxW} height={boxH} rx="12" fill={C.ink} />
            <rect x={boxX} y={T} width={boxW} height={boxH} rx="12" fill="#fff" stroke={C.ink} strokeWidth="3" />
            <text x={boxX + 12} y={T + 19} fontSize="12" fontWeight="700" fill={C.muted}>{fmtLong(s.k)}</text>
            <text x={boxX + 12} y={T + 36} fontSize="13" fontWeight="900" fill={C.ink}>体重 {s.w.toFixed(1)} kg</text>
            <text x={boxX + 12} y={T + 52} fontSize="12" fontWeight="700" fill={C.muted}>7日平均 {s.avg.toFixed(1)} kg</text>
            {sTags.length > 0 && (
              <text x={boxX + 12} y={T + 69} fontSize="12" fontWeight="900" fill={C.ink}>
                {sTags.map((t) => t.short).join("・")}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
