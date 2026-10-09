type Group = readonly [string, readonly (readonly [string, string])[]];
export const habitGroups: readonly Group[] = [
  [
    "早晨面部护理",
    [
      ["morningWater", "清水洗脸"],
      ["morningNoCloth", "未使用纱布巾摩擦面部"],
    ],
  ],
  [
    "晚间面部护理",
    [
      ["eveningCleanser", "使用洗面奶洗脸"],
      ["eveningCream", "涂面部修护霜"],
      ["eveningNoCloth", "未使用纱布巾摩擦面部"],
    ],
  ],
  [
    "身体与头皮护理",
    [
      ["shower", "冲澡"],
      ["shampoo", "洗头"],
      ["urea", "涂身体尿素霜"],
    ],
  ],
] as const;
export const scoreGroups: readonly Group[] = [
  [
    "面部",
    [
      ["oil", "T区油腻程度"],
      ["tight", "面部干燥或紧绷"],
      ["flake", "面部粗糙或脱屑"],
      ["red", "面部泛红或刺痛"],
      ["acne", "痘痘情况"],
    ],
  ],
  [
    "身体",
    [
      ["bodyDry", "身体干燥程度"],
      ["kp", "鸡皮肤粗糙程度"],
    ],
  ],
  [
    "头皮",
    [
      ["scalpOil", "头皮油腻程度"],
      ["scalpItch", "头皮瘙痒或不适"],
    ],
  ],
] as const;
export const habits = habitGroups.flatMap((g) => g[1]);
export const scores = scoreGroups.flatMap((g) => g[1]);
export type Status = "done" | "missed" | "unknown";
export type Daily = {
  date: string;
  habits: Record<string, Status>;
  scores: Record<string, number | null>;
  note: string;
  updatedAt: string;
};
export type Cycle = {
  id: string;
  name: string;
  start: string;
  days: number;
  goals: string[];
};
export type Photo = {
  id: string;
  date: string;
  part: string;
  note: string;
  type: string;
  blob: Blob;
};
export type Settings = {
  activeCycle: string;
  theme: "system" | "light" | "dark";
};
export type Snapshot = {
  version: 1;
  records: Daily[];
  cycles: Cycle[];
  settings: Settings;
  photos: Photo[];
};
export const defaultCycle: Cycle = {
  id: "first",
  name: "28天洗护与皮肤状态观察",
  start: "2026-10-09",
  days: 28,
  goals: [
    "建立早晨清水洗脸的习惯",
    "建立晚上使用洗面奶洁面的习惯",
    "停止纱布巾机械摩擦，观察面部状态",
    "建立规律冲澡习惯",
    "建立规律洗头习惯",
    "建立规律使用尿素霜的习惯",
    "观察身体干燥与毛周角化的变化",
    "观察头皮油腻、瘙痒和脂溢性皮炎相关表现的变化",
  ],
};
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dayNumber(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
export function addDays(s: string, n: number) {
  const d = new Date((dayNumber(s) + n) * 86400000);
  return d.toISOString().slice(0, 10);
}
export function validDate(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(dayNumber(s)) &&
    addDays(s, 0) === s
  );
}
export const cycleDay = (c: Cycle, d: string) =>
  dayNumber(d) - dayNumber(c.start) + 1;
export const emptyDay = (date: string): Daily => ({
  date,
  habits: Object.fromEntries(habits.map(([k]) => [k, "unknown"])),
  scores: Object.fromEntries(scores.map(([k]) => [k, null])),
  note: "",
  updatedAt: new Date().toISOString(),
});
export const hasRecord = (r: Daily) =>
  !!r.note.trim() ||
  Object.values(r.habits).some((x) => x !== "unknown") ||
  Object.values(r.scores).some((x) => x !== null);
export function rangeStats(records: Daily[], start: string, end: string) {
  const rows = records.filter((r) => r.date >= start && r.date <= end);
  return {
    days: rows.filter(hasRecord).length,
    habits: habits.map(([key, label]) => ({
      key,
      label,
      done: rows.filter((r) => r.habits[key] === "done").length,
      missed: rows.filter((r) => r.habits[key] === "missed").length,
      unknown:
        Math.max(0, dayNumber(end) - dayNumber(start) + 1) -
        rows.filter((r) => r.habits[key] !== "unknown").length,
    })),
    scores: scores.map(([key, label]) => {
      const values = rows
        .map((r) => r.scores[key])
        .filter((x): x is number => x !== null && x !== undefined);
      return {
        key,
        label,
        count: values.length,
        mean: values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : null,
      };
    }),
  };
}
export function summary(s: Snapshot, c: Cycle) {
  const end = addDays(c.start, c.days - 1),
    st = rangeStats(s.records, c.start, end),
    first = rangeStats(
      s.records,
      c.start,
      addDays(c.start, Math.min(7, c.days) - 1),
    ),
    last = rangeStats(s.records, addDays(end, -Math.min(7, c.days) + 1), end);
  return [
    `${c.name}`,
    `${c.start} 至 ${end}（${c.days}天）`,
    `实际记录 ${st.days} 天；缺失 ${c.days - st.days} 天（未记录不等于未完成）`,
    "\n习惯",
    ...st.habits.map(
      (h) =>
        `${h.label}：完成${h.done}次，未完成${h.missed}次，未记录${h.unknown}次`,
    ),
    "\n评分：0无症状、1轻微、2明显、3严重；均值只计算已填写评分",
    ...st.scores.map(
      (x, i) =>
        `${x.label}：样本${x.count}，均值${x.mean?.toFixed(2) ?? "数据不足"}；前${Math.min(7, c.days)}天 ${first.scores[i].mean?.toFixed(2) ?? "数据不足"}（n=${first.scores[i].count}），后${Math.min(7, c.days)}天 ${last.scores[i].mean?.toFixed(2) ?? "数据不足"}（n=${last.scores[i].count}）`,
    ),
    "\n全部原始文字记录",
    ...s.records
      .filter((r) => r.date >= c.start && r.date <= end && r.note)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => `${r.date}\n${r.note}`),
    "\n照片时间轴",
    ...s.photos
      .filter((p) => p.date >= c.start && p.date <= end)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => `${p.date} · ${p.part} · ${p.note}`),
    "\n这是个人观察数据，不构成医学诊断，也不能据此将变化归因于某一产品。",
  ].join("\n");
}
