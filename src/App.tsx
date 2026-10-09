import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  House,
  Settings as SettingsIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CloudOff,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import * as db from "./db";
import {
  habits,
  habitGroups,
  scoreGroups,
  scores,
  localDate,
  addDays,
  cycleDay,
  emptyDay,
  hasRecord,
  dayNumber,
  rangeStats,
  summary,
  validDate,
  defaultCycle,
  type Snapshot,
  type Daily,
  type Cycle,
} from "./model";
import { csv, structured, zipBackup, readBackup, download } from "./backup";
import { Photos } from "./Photos";
export default function App() {
  const [data, setData] = useState<Snapshot | null>(null),
    [tab, setTab] = useState("today"),
    [date, setDate] = useState(localDate()),
    [save, setSave] = useState("加载中"),
    [error, setError] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [offlineReady, setOfflineReady] = useState(false),
    [update, setUpdate] = useState(false);
  const current = useRef<Snapshot | null>(null),
    queue = useRef(Promise.resolve()),
    pending = useRef(new Map<string, Daily>()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function commit(s: Snapshot) {
    current.current = s;
    setData(s);
  }
  function operation(fn: () => Promise<unknown>) {
    setSave("正在保存");
    const job = queue.current.then(fn);
    queue.current = job.then(
      () => {
        if (!pending.current.size) setSave("已保存到本机");
      },
      (e) => {
        setSave("保存失败");
        setError(
          `操作失败，输入仍保留在页面。请重试或备份：${e instanceof Error ? e.message : "存储空间不足"}`,
        );
      },
    );
    return job;
  }
  function flush() {
    if (timer.current) clearTimeout(timer.current);
    const entries = [...pending.current.values()];
    pending.current.clear();
    for (const r of entries)
      void operation(async () => {
        await db.saveRecord(r);
        const retry = pending.current.get(r.date);
        if (retry && retry.updatedAt <= r.updatedAt)
          pending.current.delete(r.date);
      }).catch(() => {
        // Retry the latest visible input, never an older failed snapshot.
        const latest = current.current?.records.find(
          (row) => row.date === r.date,
        );
        if (latest) pending.current.set(r.date, latest);
      });
  }
  useEffect(() => {
    db.load()
      .then(commit)
      .then(() => setSave("已保存到本机"))
      .catch((e) => {
        setError(
          `无法打开本地数据库：${e.message}。请检查浏览器是否允许网站存储。`,
        );
        setSave("加载失败");
      });
    const visibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const on = () => setOnline(navigator.onLine),
      ready = () => setOfflineReady(true),
      updated = () => setUpdate(true);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("skinlog-offline", ready);
    window.addEventListener("skinlog-update", updated);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("skinlog-offline", ready);
      window.removeEventListener("skinlog-update", updated);
    };
  }, []);
  useEffect(() => {
    if (data) document.documentElement.dataset.theme = data.settings.theme;
  }, [data?.settings.theme]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  function change(patch: Partial<Daily>, text = false) {
    const s = current.current!;
    const r = {
      ...(s.records.find((r) => r.date === date) || emptyDay(date)),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    commit({ ...s, records: [...s.records.filter((x) => x.date !== date), r] });
    pending.current.set(date, r);
    setSave("待保存");
    if (text) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 350);
    } else flush();
  }
  async function settled() {
    flush();
    await queue.current;
    if (pending.current.size)
      throw new Error("存在尚未保存的记录，请重试保存后操作。");
    return current.current!;
  }
  function navigate(t: string) {
    flush();
    setTab(t);
    if (t === "today") setDate(localDate());
  }
  if (!data)
    return (
      <main className="shell">
        <h1>SkinLog</h1>
        <p role="status">{save}</p>
        {error && <p className="error">{error}</p>}
      </main>
    );
  const cycle = data.cycles.find((c) => c.id === data.settings.activeCycle)!;
  const day = cycleDay(cycle, date),
    r = data.records.find((r) => r.date === date) || emptyDay(date);
  const title = new Date(`${date}T12:00:00`).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return (
    <div className="shell">
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("today");
          }}
        >
          <BookOpen size={24} />
          SkinLog
        </a>
        <span className="save" role="status">
          {online ? <Check size={14} /> : <CloudOff size={14} />} {save}
          {!online ? " · 离线" : ""}
        </span>
      </header>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <button
            className="link"
            onClick={() => {
              setError("");
              flush();
            }}
          >
            重试保存
          </button>
        </div>
      )}
      {offlineReady && (
        <div className="notice">
          离线资源已缓存，可以离线打开与记录。
          <button className="link" onClick={() => setOfflineReady(false)}>
            知道了
          </button>
        </div>
      )}
      {update && (
        <div className="notice">
          有新版本。请先确认已保存并备份，再关闭所有 SkinLog 页面后重新打开。
          <button className="link" onClick={() => setUpdate(false)}>
            知道了
          </button>
        </div>
      )}
      {(tab === "today" || tab === "detail") && (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {date === localDate() ? "今日记录" : "历史记录"}
              </p>
              <h1>{title}</h1>
            </div>
            <input
              aria-label="记录日期"
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) {
                  flush();
                  setDate(e.target.value);
                }
              }}
            />
          </div>
          <section className="experiment">
            <p>{cycle.name}</p>
            <div className="row">
              <strong>
                {day < 1
                  ? "实验尚未开始"
                  : day > cycle.days
                    ? "本周期已结束"
                    : `Day ${day}`}{" "}
                <span>/ {cycle.days}</span>
              </strong>
              <span>
                {cycle.start} — {addDays(cycle.start, cycle.days - 1)}
              </span>
            </div>
            <progress
              value={Math.min(cycle.days, Math.max(0, day))}
              max={cycle.days}
            />
            <p className="muted">如实记录就好。未记录不等于未完成。</p>
          </section>
          <div className="section-title">
            <h2>当日习惯</h2>
            <span className="muted">可分次补充</span>
          </div>
          {habitGroups.map(([name, items], i) => (
            <details className="card habit-group" key={name} open>
              <summary>
                <span className="group-no">0{i + 1}</span>
                {name}
              </summary>
              {items.map(([key, label]) => (
                <div className="habit" key={key}>
                  <span>{label}</span>
                  <div className="segments" aria-label={label}>
                    {(
                      [
                        ["unknown", "未记录"],
                        ["done", "已完成"],
                        ["missed", "未完成"],
                      ] as const
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        className={r.habits[key] === v ? `selected ${v}` : ""}
                        aria-pressed={r.habits[key] === v}
                        onClick={() =>
                          change({ habits: { ...r.habits, [key]: v } })
                        }
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {name !== "身体与头皮护理" && (
                <p className="tiny">
                  “未使用纱布巾”已完成 = 此时段没有摩擦；未完成 = 使用了纱布巾。
                </p>
              )}
            </details>
          ))}
          <div className="section-title">
            <h2>皮肤状态</h2>
            <span className="muted">评分均为可选</span>
          </div>
          <details className="guide">
            <summary>评分标准 · 0 没有 / 1 轻微 / 2 明显 / 3 严重</summary>
            <p>
              对每个指标始终使用同一标准。点击已选分数可取消，恢复未记录。空白不会按0分统计。
            </p>
          </details>
          {scoreGroups.map(([name, items]) => (
            <section className="card" key={name}>
              <h3>{name}</h3>
              {items.map(([key, label]) => (
                <div className="score" key={key}>
                  <span>
                    {label}
                    <small>
                      {r.scores[key] === null ? "未记录" : `${r.scores[key]}分`}
                    </small>
                  </span>
                  <div className="segments rating" aria-label={label}>
                    {[0, 1, 2, 3].map((v) => (
                      <button
                        key={v}
                        aria-label={`${label} ${v}分`}
                        aria-pressed={r.scores[key] === v}
                        className={r.scores[key] === v ? "selected" : ""}
                        onClick={() =>
                          change({
                            scores: {
                              ...r.scores,
                              [key]: r.scores[key] === v ? null : v,
                            },
                          })
                        }
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
          <section className="card">
            <h2>今天有什么变化？</h2>
            <p className="muted">
              触感、保湿、出油、脱屑，或任何想留下的观察。
            </p>
            <textarea
              aria-label="今天有什么变化"
              placeholder="不需要完整，有变化时写一点就好…"
              rows={5}
              value={r.note}
              onChange={(e) => change({ note: e.target.value }, true)}
              onBlur={flush}
            />
            <span className="tiny">原始文字会自动保存，不会被改写。</span>
          </section>
          {[1, 7, 14, 21, 28].includes(day) && (
            <div className="notice">
              今天是建议拍照日{day === 1 ? "，可以留下基线照片" : ""}
              。拍摄完全自愿。
            </div>
          )}
          <Photos
            date={date}
            photos={data.photos}
            add={async (p) => {
              await operation(() => db.savePhoto(p));
              const s = current.current!;
              commit({ ...s, photos: [...s.photos, p] });
            }}
            update={async (p) => {
              try {
                await operation(() => db.savePhoto(p));
                const s = current.current!;
                commit({
                  ...s,
                  photos: s.photos.map((x) => (x.id === p.id ? p : x)),
                });
              } catch {
                throw new Error("保存失败");
              }
            }}
            remove={(id) => {
              void operation(() => db.removePhoto(id))
                .then(() => {
                  const s = current.current!;
                  commit({ ...s, photos: s.photos.filter((p) => p.id !== id) });
                })
                .catch(() => {});
            }}
          />
          {(hasRecord(r) || data.photos.some((p) => p.date === date)) && (
            <DeleteDay
              onDelete={(withPhotos) => {
                flush();
                void operation(() => db.removeDay(date, withPhotos))
                  .then(() => {
                    const s = current.current!;
                    commit({
                      ...s,
                      records: s.records.filter((r) => r.date !== date),
                      photos: withPhotos
                        ? s.photos.filter((p) => p.date !== date)
                        : s.photos,
                    });
                  })
                  .catch(() => {});
              }}
            />
          )}
        </>
      )}
      {tab === "calendar" && (
        <Calendar
          data={data}
          select={(d) => {
            flush();
            setDate(d);
            setTab("detail");
          }}
        />
      )}
      {tab === "trends" && <Trends data={data} cycle={cycle} />}
      {tab === "settings" && (
        <SettingsPanel
          data={data}
          cycle={cycle}
          settled={settled}
          change={commit}
          operation={operation}
        />
      )}
      <footer>个人观察，不构成医学诊断。建议定期完整备份。</footer>
      <nav aria-label="主导航">
        {[
          ["today", "今天", House],
          ["calendar", "日历", CalendarDays],
          ["trends", "趋势", ChartNoAxesCombined],
          ["settings", "设置", SettingsIcon],
        ].map(([key, label, Icon]) => {
          const I = Icon as typeof House;
          return (
            <button
              key={key as string}
              className={
                tab === key || (key === "calendar" && tab === "detail")
                  ? "active"
                  : ""
              }
              onClick={() => navigate(key as string)}
            >
              <I size={22} />
              <span>{label as string}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
function DeleteDay({ onDelete }: { onDelete: (photos: boolean) => void }) {
  const [open, set] = useState(false),
    [photos, setPhotos] = useState(false);
  return (
    <section className="delete-day">
      {!open ? (
        <button className="link danger" onClick={() => set(true)}>
          删除此日记录
        </button>
      ) : (
        <>
          <p>默认只删除习惯、评分和文字，保留照片。</p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={photos}
              onChange={(e) => setPhotos(e.target.checked)}
            />
            同时删除此日照片
          </label>
          <div className="row">
            <button
              className="danger"
              onClick={() => {
                if (
                  confirm(
                    photos
                      ? "确认删除当天记录及全部照片？"
                      : "确认删除当天记录？照片将保留。",
                  )
                ) {
                  onDelete(photos);
                  set(false);
                }
              }}
            >
              确认删除
            </button>
            <button className="secondary" onClick={() => set(false)}>
              取消
            </button>
          </div>
        </>
      )}
    </section>
  );
}
function Calendar({
  data,
  select,
}: {
  data: Snapshot;
  select: (date: string) => void;
}) {
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const first = `${month}-01`,
    weekday = new Date(`${first}T12:00:00`).getDay(),
    next = localDate(new Date(+month.slice(0, 4), +month.slice(5), 1)),
    count = dayNumber(next) - dayNumber(first);
  const shift = (n: number) =>
    setMonth(
      localDate(new Date(+month.slice(0, 4), +month.slice(5) - 1 + n, 1)).slice(
        0,
        7,
      ),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">历史观察</p>
          <h1>日历</h1>
        </div>
        <input
          aria-label="浏览月份"
          type="month"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value);
          }}
        />
      </div>
      <section className="card">
        <div className="row">
          <button
            className="icon secondary"
            aria-label="上个月"
            onClick={() => shift(-1)}
          >
            <ChevronLeft />
          </button>
          <h2>{month.replace("-", "年 ")}月</h2>
          <button
            className="icon secondary"
            aria-label="下个月"
            onClick={() => shift(1)}
          >
            <ChevronRight />
          </button>
        </div>
        <div className="calendar">
          {["日", "一", "二", "三", "四", "五", "六"].map((x) => (
            <span className="weekday" key={x}>
              {x}
            </span>
          ))}
          {Array.from({ length: weekday }, (_, i) => (
            <span key={`blank${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const d = addDays(first, i),
              r = data.records.find((r) => r.date === d),
              p = data.photos.some((p) => p.date === d);
            return (
              <button
                key={d}
                className={d === localDate() ? "today-date" : ""}
                onClick={() => select(d)}
                aria-label={`${d}${r && hasRecord(r) ? " 有记录" : ""}${p ? " 有照片" : ""}`}
              >
                <span>{i + 1}</span>
                <span className="markers">
                  {r && hasRecord(r) && <i />}
                  {p && <b>▧</b>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="muted">● 有记录　▧ 有照片</p>
      </section>
      <p className="muted">点击日期查看、补记或修改。遗漏不会中断实验。</p>
    </>
  );
}
function Trends({ data, cycle }: { data: Snapshot; cycle: Cycle }) {
  const [range, setRange] = useState("28"),
    [start, setStart] = useState(addDays(localDate(), -27)),
    [end, setEnd] = useState(localDate()),
    [group, setGroup] = useState("面部"),
    [key, setKey] = useState("oil"),
    [show, setShow] = useState(false);
  const valid =
    validDate(start) &&
    validDate(end) &&
    start <= end &&
    dayNumber(end) - dayNumber(start) <= 3660;
  const st = valid ? rangeStats(data.records, start, end) : null;
  const points = valid
    ? Array.from({ length: dayNumber(end) - dayNumber(start) + 1 }, (_, i) => {
        const date = addDays(start, i);
        return {
          date,
          value: data.records.find((r) => r.date === date)?.scores[key] ?? null,
        };
      })
    : [];
  return (
    <>
      <p className="eyebrow">观察变化，不推断原因</p>
      <h1>趋势</h1>
      <section className="card">
        <label>
          时间范围
          <select
            value={range}
            onChange={(e) => {
              const v = e.target.value;
              setRange(v);
              if (v !== "custom") {
                setStart(addDays(localDate(), -Number(v) + 1));
                setEnd(localDate());
              }
            }}
          >
            <option value="7">最近7天</option>
            <option value="14">最近14天</option>
            <option value="28">最近28天</option>
            <option value="custom">自定义范围</option>
          </select>
        </label>
        <div className="form-grid">
          <label>
            开始
            <input
              type="date"
              value={start}
              onChange={(e) => {
                setRange("custom");
                setStart(e.target.value);
              }}
            />
          </label>
          <label>
            结束
            <input
              type="date"
              value={end}
              onChange={(e) => {
                setRange("custom");
                setEnd(e.target.value);
              }}
            />
          </label>
        </div>
        {!valid && <p className="error">请选择有效日期范围（最多3661天）。</p>}
        {st && (
          <>
            <div className="metric">
              <strong>{st.days}</strong>
              <span>
                实际记录天数 / {dayNumber(end) - dayNumber(start) + 1} 天
              </span>
            </div>
            <div className="segments">
              {scoreGroups.map(([g, items]) => (
                <button
                  key={g}
                  className={group === g ? "selected" : ""}
                  onClick={() => {
                    setGroup(g);
                    setKey(items[0][0]);
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <label>
              观察指标
              <select value={key} onChange={(e) => setKey(e.target.value)}>
                {scoreGroups
                  .find((g) => g[0] === group)![1]
                  .map(([k, l]) => (
                    <option value={k} key={k}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
            <div className="chart">
              <ResponsiveContainer width="100%" height={230}>
                <LineChart
                  data={points}
                  margin={{ left: -22, right: 12, top: 15, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(s) => s.slice(5)}
                    minTickGap={28}
                  />
                  <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} />
                  <Tooltip formatter={(v) => [`${v}分`, "评分"]} />
                  <Line
                    dataKey="value"
                    stroke="#397da0"
                    strokeWidth={2.5}
                    connectNulls={false}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="muted">
              {points.filter((p) => p.value !== null).length < 2
                ? "数据不足：至少两次评分才能观察变化。"
                : "断线表示缺失评分，未按0分处理。"}
            </p>
          </>
        )}
      </section>
      {st && (
        <>
          <section className="card">
            <h2>各习惯完成次数</h2>
            {st.habits.map((h) => (
              <div className="stat-row" key={h.key}>
                <span>{h.label}</span>
                <strong>
                  {h.done} 次
                  <small>
                    未完成 {h.missed} · 未记录 {h.unknown}
                  </small>
                </strong>
              </div>
            ))}
          </section>
          <section className="card">
            <h2>各指标 · 前期与后期</h2>
            <p className="muted">
              所选范围分为前后两半。均值仅计算有评分的日期；n 是样本数。
            </p>
            {st.scores.map((x) => {
              const middle = addDays(
                  start,
                  Math.ceil((dayNumber(end) - dayNumber(start) + 1) / 2) - 1,
                ),
                a = rangeStats(data.records, start, middle).scores.find(
                  (v) => v.key === x.key,
                )!,
                b = rangeStats(
                  data.records,
                  addDays(middle, 1),
                  end,
                ).scores.find((v) => v.key === x.key)!;
              return (
                <div className="stat-row" key={x.key}>
                  <span>{x.label}</span>
                  <span>
                    {a.mean?.toFixed(1) ?? "—"} → {b.mean?.toFixed(1) ?? "—"}
                    <small>
                      n={a.count} / {b.count}
                      {a.count < 2 || b.count < 2 ? " · 数据不足" : ""}
                    </small>
                  </span>
                </div>
              );
            })}
          </section>
        </>
      )}
      <section className="card">
        <h2>实验总结</h2>
        <p>{cycle.name}</p>
        <p className="muted">
          {localDate() > addDays(cycle.start, cycle.days - 1)
            ? "实验已结束，以下为完整周期总结。"
            : "实验进行中，可查看阶段性总结。"}{" "}
          短周期的首尾窗口可能重叠。
        </p>
        <button onClick={() => setShow(!show)}>
          {show ? "收起总结" : "查看原始数据总结"}
        </button>
        {show && <Summary data={data} cycle={cycle} />}
      </section>
    </>
  );
}
function Summary({ data, cycle }: { data: Snapshot; cycle: Cycle }) {
  const text = summary(data, cycle),
    [message, set] = useState("");
  return (
    <>
      <textarea
        aria-label="可复制给ChatGPT的总结"
        className="summary-text"
        readOnly
        value={text}
        rows={16}
      />
      <div className="row">
        <button
          onClick={() => {
            void navigator.clipboard.writeText(text).then(
              () => set("已复制"),
              () => set("请长按文本框全选并复制"),
            );
          }}
        >
          复制总结
        </button>
        <button
          className="secondary"
          onClick={() =>
            download(
              new Blob([text], { type: "text/plain;charset=utf-8" }),
              "SkinLog-总结.txt",
            )
          }
        >
          下载 TXT
        </button>
      </div>
      <p role="status">{message}</p>
    </>
  );
}
function SettingsPanel({
  data,
  cycle,
  settled,
  change,
  operation,
}: {
  data: Snapshot;
  cycle: Cycle;
  settled: () => Promise<Snapshot>;
  change: (s: Snapshot) => void;
  operation: (fn: () => Promise<unknown>) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(cycle),
    [message, setMessage] = useState(""),
    [restore, setRestore] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [storage, setStorage] = useState(""),
    [wipe, setWipe] = useState(false),
    [word, setWord] = useState("");
  useEffect(() => setDraft(cycle), [cycle]);
  useEffect(() => {
    void navigator.storage
      ?.estimate()
      .then((x) =>
        setStorage(
          `已使用约 ${((x.usage || 0) / 1024 / 1024).toFixed(1)} MB / 可用配额约 ${((x.quota || 0) / 1024 / 1024).toFixed(0)} MB`,
        ),
      );
  }, []);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "操作失败，现有数据未改变。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">周期与数据</p>
      <h1>设置</h1>
      <section className="card">
        <h2>实验周期</h2>
        <label>
          当前周期
          <select
            value={data.settings.activeCycle}
            onChange={(e) => {
              const settings = {
                ...data.settings,
                activeCycle: e.target.value,
              };
              void act(async () => {
                const s = await settled();
                await operation(() => db.saveSettings(settings));
                change({ ...s, settings });
              });
            }}
          >
            {data.cycles.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name} · {c.start}
              </option>
            ))}
          </select>
        </label>
        <label>
          实验名称
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            开始日期
            <input
              type="date"
              value={draft.start}
              onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            />
          </label>
          <label>
            持续天数
            <input
              type="number"
              min="1"
              max="3660"
              value={draft.days}
              onChange={(e) =>
                setDraft({ ...draft, days: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <p className="muted">
          结束：
          {draft.start && draft.days > 0
            ? addDays(draft.start, draft.days - 1)
            : "—"}
        </p>
        <div className="row">
          <button
            disabled={busy}
            onClick={() => {
              if (
                !draft.name.trim() ||
                !draft.start ||
                !Number.isInteger(draft.days) ||
                draft.days < 1 ||
                draft.days > 3660
              ) {
                setMessage("请填写有效名称、日期与1–3660天。");
                return;
              }
              void act(async () => {
                const s = await settled();
                await operation(() => db.saveCycle(draft));
                change({
                  ...s,
                  cycles: s.cycles.map((c) => (c.id === draft.id ? draft : c)),
                });
                setMessage("周期已保存。");
              });
            }}
          >
            保存周期
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const s = await settled(),
                  c = {
                    ...cycle,
                    id: crypto.randomUUID(),
                    name: "新的洗护观察周期",
                    start: localDate(),
                  },
                  settings = { ...s.settings, activeCycle: c.id };
                await operation(() => db.saveCycle(c));
                await operation(() => db.saveSettings(settings));
                change({ ...s, cycles: [...s.cycles, c], settings });
              })
            }
          >
            创建新周期
          </button>
        </div>
        <details>
          <summary>实验目标</summary>
          <ol>
            {cycle.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ol>
        </details>
        <p className="tiny">
          日期记录独立于周期保存。新周期不会覆盖历史；周期重叠时会引用同一天的真实记录。
        </p>
      </section>
      <section className="card">
        <h2>外观</h2>
        <label>
          主题
          <select
            value={data.settings.theme}
            onChange={(e) => {
              const settings = {
                ...data.settings,
                theme: e.target.value as Snapshot["settings"]["theme"],
              };
              void act(async () => {
                const s = await settled();
                await operation(() => db.saveSettings(settings));
                change({ ...s, settings });
              });
            }}
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
      </section>
      <section className="card">
        <h2>备份与恢复</h2>
        <p className="muted">
          ZIP 是完整备份，包含照片原始文件。JSON 包含结构化数据和照片元数据；CSV
          只含每日习惯、评分和文字。两者均不含照片文件，不能用于完整恢复。
        </p>
        <button
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const s = await settled();
              download(
                await zipBackup(s),
                `SkinLog-完整备份-${localDate()}.zip`,
              );
              setMessage(
                "备份已生成，请在Safari下载中保存到“文件”，并核对文件存在。",
              );
            })
          }
        >
          导出 ZIP 完整备份
        </button>
        <div className="row">
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void act(async () =>
                download(
                  new Blob(
                    [JSON.stringify(structured(await settled()), null, 2)],
                    { type: "application/json" },
                  ),
                  "SkinLog-数据.json",
                ),
              )
            }
          >
            导出 JSON
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              void act(async () =>
                download(
                  new Blob([csv(await settled())], {
                    type: "text/csv;charset=utf-8",
                  }),
                  "SkinLog-记录.csv",
                ),
              )
            }
          >
            导出 CSV
          </button>
        </div>
        <label className="button secondary upload">
          选择 ZIP 恢复文件
          <input
            disabled={busy}
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                void act(async () => {
                  setRestore(null);
                  setRestore(await readBackup(f));
                });
              e.target.value = "";
            }}
          />
        </label>
        {restore && (
          <div className="notice">
            <h3>恢复预览</h3>
            <p>
              {restore.records.length} 日记录 · {restore.photos.length} 张照片 ·{" "}
              {restore.cycles.length} 个周期
            </p>
            <p>将覆盖本设备全部现有数据。建议先导出当前完整备份。</p>
            <div className="row">
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  if (confirm("确认用此备份覆盖全部现有数据？"))
                    void act(async () => {
                      await settled();
                      await operation(() => db.replace(restore));
                      change(restore);
                      setRestore(null);
                      setMessage("完整恢复成功。");
                    });
                }}
              >
                确认覆盖恢复
              </button>
              <button className="secondary" onClick={() => setRestore(null)}>
                取消
              </button>
            </div>
          </div>
        )}
        {busy && <p role="status">正在处理，请保持页面打开…</p>}
        <p
          role="status"
          className={
            message.includes("失败") || message.includes("无效") ? "error" : ""
          }
        >
          {message}
        </p>
      </section>
      <section className="card">
        <h2>本地数据与离线说明</h2>
        <p>
          本应用的数据默认保存在当前设备浏览器中。清除网站数据、更换设备或系统清理存储空间可能造成数据丢失。请定期导出完整备份。
        </p>
        <p>
          首次联网加载并缓存完成后可离线打开与记录。安装后建议联网打开一次。私密浏览、缓存被清除或系统回收存储时，离线资源和记录可能不可用。
        </p>
        <p>
          照片没有上传或分析，JPEG、PNG、WebP
          保留原文件及方向信息；其他可解码格式转换为高质量 JPEG。无法解码的 HEIC
          请先导出为 JPEG。
        </p>
        <p className="muted">{storage}</p>
        <button
          className="secondary"
          onClick={() =>
            void act(async () => {
              const ok = await navigator.storage?.persist?.();
              setMessage(
                ok
                  ? "浏览器已允许持久存储；仍建议定期备份。"
                  : "此浏览器未允许持久存储或不支持此请求，请定期备份。",
              );
            })
          }
        >
          请求浏览器保留存储
        </button>
      </section>
      <section className="card">
        <h2>在 iPhone 上安装</h2>
        <p>
          用 Safari 打开 HTTPS 地址，点击分享按钮，选择“添加到主屏幕”，确认名称
          SkinLog
          后点击“添加”。从主屏幕打开后联网加载一次，再检查飞行模式下能否打开。
        </p>
        <p className="muted">
          浏览器标签与主屏幕应用的数据是否共享受系统版本影响，迁移时请使用 ZIP
          备份。
        </p>
      </section>
      <section className="card">
        <h2>清除全部数据</h2>
        {!wipe ? (
          <button
            className="danger secondary"
            onClick={() => {
              if (
                confirm(
                  "将清除全部记录、周期和照片。建议先备份。继续进入最终确认？",
                )
              )
                setWipe(true);
            }}
          >
            删除全部数据
          </button>
        ) : (
          <>
            <label>
              输入“删除全部数据”完成第二次确认
              <input value={word} onChange={(e) => setWord(e.target.value)} />
            </label>
            <button
              className="danger"
              disabled={word !== "删除全部数据" || busy}
              onClick={() =>
                void act(async () => {
                  const s = await settled();
                  const fresh: Snapshot = {
                    version: 1,
                    records: [],
                    photos: [],
                    cycles: [defaultCycle],
                    settings: { activeCycle: "first", theme: s.settings.theme },
                  };
                  await operation(() => db.replace(fresh));
                  change(fresh);
                  setWipe(false);
                  setWord("");
                  setMessage("所有个人记录与照片已删除，默认周期已重建。");
                })
              }
            >
              永久删除
            </button>
            <button className="secondary" onClick={() => setWipe(false)}>
              取消
            </button>
          </>
        )}
      </section>
    </>
  );
}
