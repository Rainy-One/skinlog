import "fake-indexeddb/auto";
import { beforeEach, describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  load,
  replace,
  saveRecord,
  savePhoto,
  removePhoto,
  removeDay,
  saveCycle,
} from "../src/db";
import {
  zipBackup,
  readBackup,
  validate,
  csv,
  structured,
} from "../src/backup";
import { defaultCycle, emptyDay, type Snapshot } from "../src/model";
const fresh = (): Snapshot => ({
  version: 1,
  records: [],
  photos: [],
  cycles: [defaultCycle],
  settings: { activeCycle: "first", theme: "system" },
});
// Node JSZip does not accept native Blob input; browser code uses Blob normally.
const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
beforeEach(async () => replace(fresh()));
describe("IndexedDB 持久化", () => {
  it("早晚修改、评分0/null与文字读回，新增周期不覆盖记录", async () => {
    let r = emptyDay("2026-10-09");
    r.habits.morningWater = "done";
    await saveRecord(r);
    r = (await load()).records[0];
    r.habits.eveningCleanser = "done";
    r.scores.oil = 0;
    r.note = "多行\n观察";
    await saveRecord(r);
    await saveCycle({ ...defaultCycle, id: "new" });
    const s = await load();
    expect(s.records[0].habits.morningWater).toBe("done");
    expect(s.records[0].habits.eveningCleanser).toBe("done");
    expect(s.records[0].scores.oil).toBe(0);
    expect(s.records[0].scores.tight).toBe(null);
    expect(s.records[0].note).toBe("多行\n观察");
    expect(s.cycles).toHaveLength(2);
  });
  it("删除当天默认保留照片；明确选择时连照片删除", async () => {
    const p = {
      id: "photo",
      date: "2026-10-09",
      part: "左上臂",
      note: "",
      type: "image/jpeg",
      blob: new Blob([new Uint8Array([255, 216, 255, 217])], {
        type: "image/jpeg",
      }),
    };
    await saveRecord(emptyDay(p.date));
    await savePhoto(p);
    await removeDay(p.date, false);
    expect((await load()).photos).toHaveLength(1);
    await removeDay(p.date, true);
    expect((await load()).photos).toHaveLength(0);
    await savePhoto(p);
    await removePhoto(p.id);
    expect((await load()).photos).toHaveLength(0);
  });
  it("恢复事务写入失败回滚", async () => {
    const r = emptyDay("2026-10-09");
    r.note = "保留";
    await saveRecord(r);
    const invalid = fresh();
    invalid.records = [{ ...r, date: undefined } as any];
    await expect(replace(invalid)).rejects.toThrow();
    expect((await load()).records[0].note).toBe("保留");
  });
});
describe("导出与验证", () => {
  it("JSON说明不含照片；CSV保留0分、空值、多行并防公式", () => {
    const s = fresh(),
      r = emptyDay("2026-10-09");
    r.scores.oil = 0;
    r.note = '=公式,\n"原文"';
    s.records = [r];
    expect(structured(s).photoFilesIncluded).toBe(false);
    expect(JSON.parse(JSON.stringify(structured(s))).version).toBe(1);
    expect(csv(s)).toContain('"0",""');
    expect(csv(s)).toContain('"\'=公式,\n""原文"""');
  });
  it("拒绝未知版本、重复ID、非法日期/评分/状态，不改变数据库", async () => {
    for (const mutate of [
      (s: any) => (s.version = 2),
      (s: any) => (s.records = [emptyDay("bad")]),
      (s: any) => {
        s.records = [emptyDay("2026-10-09")];
        s.records[0].scores.oil = 4;
      },
      (s: any) => s.cycles.push(defaultCycle),
      (s: any) => (s.settings.activeCycle = "missing"),
    ]) {
      const s = structured(fresh());
      mutate(s);
      expect(() => validate(s)).toThrow();
    }
    expect((await load()).cycles).toHaveLength(1);
  });
  it("ZIP完整恢复记录与照片，缺失照片拒绝", async () => {
    const s = fresh(),
      r = emptyDay("2026-10-09");
    r.note = "完整备份";
    s.records = [r];
    s.photos = [
      {
        id: "abc",
        date: r.date,
        part: "面部",
        note: "基线",
        type: "image/jpeg",
        blob: new Blob([new Uint8Array([255, 216, 255, 217])], {
          type: "image/jpeg",
        }),
      },
    ];
    // JSZip Node uses byte buffers instead of browser Blob support.
    const z = new JSZip();
    z.file(
      "skinlog.json",
      JSON.stringify({ ...structured(s), photoFilesIncluded: true }),
    );
    z.file("photos/abc", await bytes(s.photos[0].blob));
    const packed = await z.generateAsync({ type: "uint8array" });
    const restored = await readBackup(packed as unknown as Blob);
    await replace(restored);
    expect((await load()).records[0].note).toBe(r.note);
    expect(await bytes((await load()).photos[0].blob)).toEqual(
      await bytes(s.photos[0].blob),
    );
    z.remove("photos/abc");
    await expect(
      readBackup(
        (await z.generateAsync({ type: "uint8array" })) as unknown as Blob,
      ),
    ).rejects.toThrow();
    expect((await load()).records[0].note).toBe(r.note);
  });
});
