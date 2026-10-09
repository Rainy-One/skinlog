import { describe, it, expect } from "vitest";
import {
  emptyDay,
  defaultCycle,
  cycleDay,
  addDays,
  rangeStats,
  summary,
  hasRecord,
  localDate,
  validDate,
} from "../src/model";
import type { Snapshot } from "../src/model";
const snapshot = (): Snapshot => ({
  version: 1,
  records: [],
  photos: [],
  cycles: [defaultCycle],
  settings: { activeCycle: "first", theme: "system" },
});
describe("设备日期与统计", () => {
  it("默认28天含首尾，跨月、闰年与夏令时按日历日期计算", () => {
    expect(addDays(defaultCycle.start, 27)).toBe("2026-11-05");
    expect(cycleDay(defaultCycle, "2026-10-09")).toBe(1);
    expect(cycleDay(defaultCycle, "2026-11-05")).toBe(28);
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(localDate(new Date(2026, 9, 9, 0, 1))).toBe("2026-10-09");
    expect(validDate("2026-02-30")).toBe(false);
  });
  it("未知习惯、0分和null严格区分，早晚独立", () => {
    const r = emptyDay("2026-10-09");
    expect(hasRecord(r)).toBe(false);
    r.habits.morningWater = "done";
    r.habits.eveningCleanser = "missed";
    r.scores.oil = 0;
    const st = rangeStats([r], "2026-10-09", "2026-10-11");
    expect(st.days).toBe(1);
    expect(st.habits[0]).toMatchObject({ done: 1, unknown: 2, missed: 0 });
    expect(st.habits[2]).toMatchObject({ done: 0, missed: 1, unknown: 2 });
    expect(st.scores[0]).toMatchObject({ count: 1, mean: 0 });
    expect(st.scores[1]).toMatchObject({ count: 0, mean: null });
  });
  it("总结保留文字，首尾窗口均值排除缺失，照片时间轴", () => {
    const s = snapshot();
    const a = emptyDay("2026-10-09"),
      b = emptyDay("2026-11-05");
    a.scores.oil = 3;
    a.note = "原始观察\n不改写";
    b.scores.oil = 1;
    s.records = [a, b];
    const text = summary(s, defaultCycle);
    expect(text).toContain("实际记录 2 天；缺失 26 天");
    expect(text).toContain("前7天 3.00（n=1），后7天 1.00（n=1）");
    expect(text).toContain("原始观察\n不改写");
  });
});
