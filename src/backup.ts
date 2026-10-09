import JSZip from "jszip";
import { validDate, habits, scores, type Snapshot, type Photo } from "./model";
export function structured(s: Snapshot) {
  return {
    ...s,
    photos: s.photos.map(({ blob, ...p }) => ({
      ...p,
      file: `photos/${p.id}`,
      size: blob.size,
    })),
    exportedAt: new Date().toISOString(),
    photoFilesIncluded: false,
  };
}
export async function zipBackup(s: Snapshot) {
  const zip = new JSZip();
  zip.file(
    "skinlog.json",
    JSON.stringify({ ...structured(s), photoFilesIncluded: true }, null, 2),
  );
  s.photos.forEach((p) => zip.file(`photos/${p.id}`, p.blob));
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
const fail = () => {
  throw new Error("备份格式无效、文件不完整或版本不受支持。现有数据未改变。");
};
export function validate(
  raw: unknown,
): Omit<Snapshot, "photos"> & {
  photos: Array<Omit<Photo, "blob"> & { file: string; size: number }>;
} {
  if (!raw || typeof raw !== "object") return fail();
  const s = raw as any;
  if (
    s.version !== 1 ||
    !Array.isArray(s.records) ||
    !Array.isArray(s.cycles) ||
    !Array.isArray(s.photos) ||
    !s.settings ||
    !s.cycles.length
  )
    return fail();
  const ids = new Set<string>();
  for (const r of s.records) {
    if (
      !validDate(r.date) ||
      ids.has(r.date) ||
      typeof r.note !== "string" ||
      typeof r.updatedAt !== "string" ||
      !r.habits ||
      !r.scores
    )
      return fail();
    ids.add(r.date);
    for (const [k] of habits)
      if (!["done", "missed", "unknown"].includes(r.habits[k])) return fail();
    for (const [k] of scores)
      if (
        r.scores[k] !== null &&
        (!Number.isInteger(r.scores[k]) || r.scores[k] < 0 || r.scores[k] > 3)
      )
        return fail();
  }
  ids.clear();
  for (const c of s.cycles) {
    if (
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      !c.name.trim() ||
      !validDate(c.start) ||
      !Number.isInteger(c.days) ||
      c.days < 1 ||
      c.days > 3660 ||
      !Array.isArray(c.goals) ||
      c.goals.some((x: unknown) => typeof x !== "string")
    )
      return fail();
    ids.add(c.id);
  }
  if (
    !ids.has(s.settings.activeCycle) ||
    !["system", "light", "dark"].includes(s.settings.theme)
  )
    return fail();
  ids.clear();
  for (const p of s.photos) {
    if (
      typeof p.id !== "string" ||
      !/^[\w-]+$/.test(p.id) ||
      ids.has(p.id) ||
      !validDate(p.date) ||
      typeof p.part !== "string" ||
      !p.part.trim() ||
      typeof p.note !== "string" ||
      !["image/jpeg", "image/png", "image/webp"].includes(p.type) ||
      p.file !== `photos/${p.id}` ||
      !Number.isInteger(p.size) ||
      p.size < 1
    )
      return fail();
    ids.add(p.id);
  }
  return s;
}
async function decodeBackup(file: Blob): Promise<Snapshot> {
  if (file.size > 300 * 1024 * 1024)
    throw new Error("备份超过300MB，请在存储空间充足的设备恢复。");
  const z = await JSZip.loadAsync(file);
  const manifest = z.file("skinlog.json");
  if (!manifest) return fail();
  const s = validate(JSON.parse(await manifest.async("string")));
  const photos: Photo[] = [];
  for (const p of s.photos) {
    const f = z.file(p.file);
    if (!f) return fail();
    const data = await f.async("uint8array");
    if (data.byteLength !== p.size) return fail();
    const jpeg = data[0] === 255 && data[1] === 216;
    const png =
      data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71;
    const webp =
      new TextDecoder().decode(data.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(data.slice(8, 12)) === "WEBP";
    if (!(
      (p.type === "image/jpeg" && jpeg) ||
      (p.type === "image/png" && png) ||
      (p.type === "image/webp" && webp)
    ))
      return fail();
    photos.push({
      id: p.id,
      date: p.date,
      part: p.part,
      note: p.note,
      type: p.type,
      blob: new Blob([data as BlobPart], { type: p.type }),
    });
  }
  return {
    version: 1,
    records: s.records,
    cycles: s.cycles,
    settings: s.settings,
    photos,
  };
}
export function csv(s: Snapshot) {
  const escape = (v: unknown) => {
    let text = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      [
        "日期",
        ...habits.map((h) => h[1]),
        ...scores.map((x) => x[1]),
        "原始文字记录",
      ],
      ...s.records.map((r) => [
        r.date,
        ...habits.map(
          ([k]) =>
            ({ done: "已完成", missed: "未完成", unknown: "未记录" })[
              r.habits[k]
            ],
        ),
        ...scores.map(([k]) => r.scores[k] ?? ""),
        r.note,
      ]),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n")
  );
}
export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function readBackup(file: Blob): Promise<Snapshot> {
  try {
    return await decodeBackup(file);
  } catch (e) {
    if (e instanceof Error && e.message.includes("300MB")) throw e;
    throw new Error("备份格式无效、文件不完整或版本不受支持。现有数据未改变。");
  }
}
