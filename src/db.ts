import { openDB } from "idb";
import {
  defaultCycle,
  type Daily,
  type Photo,
  type Cycle,
  type Settings,
  type Snapshot,
} from "./model";
const connection = openDB("skinlog", 1, {
  upgrade(db) {
    db.createObjectStore("records", { keyPath: "date" });
    db.createObjectStore("photos", { keyPath: "id" });
    db.createObjectStore("cycles", { keyPath: "id" });
    db.createObjectStore("settings");
  },
});
export async function load(): Promise<Snapshot> {
  const db = await connection;
  const tx = db.transaction(
    ["records", "photos", "cycles", "settings"],
    "readwrite",
  );
  let cycles = (await tx.objectStore("cycles").getAll()) as Cycle[];
  let settings = (await tx.objectStore("settings").get("user")) as
    Settings | undefined;
  if (!cycles.length) {
    cycles = [structuredClone(defaultCycle)];
    await tx.objectStore("cycles").put(cycles[0]);
  }
  if (!settings) {
    settings = { activeCycle: cycles[0].id, theme: "system" };
    await tx.objectStore("settings").put(settings, "user");
  }
  const records = (await tx.objectStore("records").getAll()) as Daily[],
    photos = (await tx.objectStore("photos").getAll()) as Photo[];
  await tx.done;
  return { version: 1, records, photos, cycles, settings };
}
export async function saveRecord(r: Daily) {
  const db = await connection;
  await db.put("records", r);
}
export async function savePhoto(p: Photo) {
  const db = await connection;
  await db.put("photos", p);
}
export async function removePhoto(id: string) {
  const db = await connection;
  await db.delete("photos", id);
}
export async function saveCycle(c: Cycle) {
  const db = await connection;
  await db.put("cycles", c);
}
export async function saveSettings(s: Settings) {
  const db = await connection;
  await db.put("settings", s, "user");
}
export async function removeDay(date: string, photos: boolean) {
  const db = await connection;
  const tx = db.transaction(["records", "photos"], "readwrite");
  await tx.objectStore("records").delete(date);
  if (photos) {
    for (const p of (await tx.objectStore("photos").getAll()) as Photo[])
      if (p.date === date) await tx.objectStore("photos").delete(p.id);
  }
  await tx.done;
}
export async function replace(s: Snapshot) {
  const db = await connection;
  const tx = db.transaction(
    ["records", "photos", "cycles", "settings"],
    "readwrite",
  );
  try {
    for (const name of ["records", "photos", "cycles", "settings"] as const)
      await tx.objectStore(name).clear();
    for (const r of s.records) await tx.objectStore("records").put(r);
    for (const p of s.photos) await tx.objectStore("photos").put(p);
    for (const c of s.cycles) await tx.objectStore("cycles").put(c);
    await tx.objectStore("settings").put(s.settings, "user");
    await tx.done;
  } catch (e) {
    try {
      tx.abort();
    } catch {}
    await tx.done.catch(() => {});
    throw e;
  }
}
