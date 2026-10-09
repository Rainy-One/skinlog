import { test, expect } from "@playwright/test";
const photo = {
  name: "sample.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8ZkAAAAASUVORK5CYII=",
    "base64",
  ),
};
async function boot(page: any) {
  await page.goto("/");
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.getByLabel("记录日期").fill("2026-10-09");
}
async function state(page: any) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("skinlog");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return await new Promise<any>((resolve) => {
      const t = db.transaction(["records", "photos"], "readonly");
      const r = t.objectStore("records").getAll(),
        p = t.objectStore("photos").getAll();
      t.oncomplete = () => {
        resolve({
          records: r.result,
          photos: p.result.map((x) => ({ ...x, blobSize: x.blob.size })),
        });
        db.close();
      };
    });
  });
}
test("习惯、评分、自动保存、刷新、补记、月历与趋势", async ({ page }) => {
  await boot(page);
  await page
    .getByLabel("清水洗脸", { exact: true })
    .getByRole("button", { name: "已完成", exact: true })
    .click();
  await page
    .getByLabel("使用洗面奶洗脸", { exact: true })
    .getByRole("button", { name: "已完成", exact: true })
    .click();
  await page
    .getByRole("button", { name: "T区油腻程度 0分", exact: true })
    .click();
  await page.getByLabel("今天有什么变化").fill("早晚记录独立\n真实观察");
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(page.getByLabel("今天有什么变化")).toHaveValue(
    "早晚记录独立\n真实观察",
  );
  let s = await state(page);
  expect(s.records[0].habits.morningWater).toBe("done");
  expect(s.records[0].habits.eveningCleanser).toBe("done");
  expect(s.records[0].scores.oil).toBe(0);
  expect(s.records[0].scores.tight).toBeNull();
  await page
    .getByRole("button", { name: "T区油腻程度 0分", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  expect((await state(page)).records[0].scores.oil).toBeNull();
  await page.getByLabel("记录日期").fill("2026-10-10");
  await page.getByLabel("今天有什么变化").fill("补记");
  await page.getByRole("button", { name: "日历", exact: true }).click();
  await page.getByLabel("浏览月份").fill("2026-10");
  await page
    .getByRole("button", { name: "2026-10-09 有记录", exact: true })
    .click();
  await expect(page.getByLabel("今天有什么变化")).toHaveValue(
    "早晚记录独立\n真实观察",
  );
  await page.getByRole("button", { name: "趋势", exact: true }).click();
  await page.getByLabel("开始", { exact: true }).fill("2026-10-09");
  await page.getByLabel("结束", { exact: true }).fill("2026-11-05");
  await expect(page.locator(".metric strong")).toHaveText("2");
  await page.getByRole("button", { name: "查看原始数据总结" }).click();
  await expect(page.getByLabel("可复制给ChatGPT的总结")).toContainText(
    "实际记录 2 天；缺失 26 天",
  );
});
test("照片上传、对比、完整ZIP导出恢复、非法文件、删除隔离", async ({
  page,
}) => {
  await boot(page);
  await expect(page.locator("input[capture=environment]")).toHaveCount(1);
  await page.locator("input[type=file]").nth(1).setInputFiles(photo);
  await expect(page.locator(".photo-tile")).toHaveCount(1);
  await page.getByLabel("照片日期").fill("2026-10-16");
  await page.locator("input[type=file]").nth(1).setInputFiles(photo);
  await expect.poll(async () => (await state(page)).photos.length).toBe(2);
  await page.getByRole("button", { name: "浏览全部照片与对比（2）" }).click();
  await expect(page.locator(".compare.side img")).toHaveCount(2);
  await page.getByRole("button", { name: "滑动对比", exact: true }).click();
  await page.getByLabel("分割位置", { exact: true }).fill("30");
  await expect(page.locator(".divider")).toHaveAttribute("style", /30%/);
  await page.getByLabel("缩放", { exact: true }).fill("2");
  await expect(page.locator(".compare.slide > img")).toHaveAttribute(
    "style",
    /scale\(2\)/,
  );
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByLabel("今天有什么变化").fill("备份原文");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 ZIP 完整备份" }).click();
  const dl = await d;
  const path = await dl.path();
  expect(path).toBeTruthy();
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await page.getByLabel("今天有什么变化").fill("已改变");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(page.getByText("恢复预览")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "确认覆盖恢复" }).click();
  await expect(page.getByText("完整恢复成功。")).toBeVisible();
  expect((await state(page)).photos).toHaveLength(2);
  expect((await state(page)).records[0].note).toBe("备份原文");
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("status").last()).toContainText("备份格式无效");
  expect((await state(page)).photos).toHaveLength(2);
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await page.getByRole("button", { name: "删除此日记录" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect.poll(async () => (await state(page)).records.length).toBe(0);
  expect((await state(page)).photos).toHaveLength(2);
  await page.locator(".photo-tile").first().click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "删除照片", exact: true }).click();
  await expect.poll(async () => (await state(page)).photos.length).toBe(1);
});
test("PWA manifest、Service Worker与离线刷新记录", async ({
  page,
  context,
}) => {
  await boot(page);
  const manifest = await page
    .locator("link[rel=manifest]")
    .getAttribute("href");
  expect(manifest).toBeTruthy();
  const response = await page.request.get(manifest!);
  expect((await response.json()).display).toBe("standalone");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "当日习惯" })).toBeVisible();
  await page.getByLabel("今天有什么变化").fill("离线记录");
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.reload();
  await expect(page.getByLabel("今天有什么变化")).toHaveValue("离线记录");
  await expect(page.getByRole("status").first()).toContainText("离线");
});
test("照片自定义分类、日期备注修改、EXIF方向与原文件保留", async ({ page }) => {
  await boot(page);
  await page
    .getByRole("combobox", { name: "部位", exact: true })
    .selectOption("自定义");
  await page.getByLabel("自定义部位").fill("左上臂");
  await page.getByLabel("照片备注", { exact: true }).fill("原始纹理");
  await page
    .locator("input[type=file]")
    .nth(1)
    .setInputFiles("tests/fixtures/oriented.jpg");
  await expect(page.locator(".photo-tile")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".photo-tile")).toContainText("左上臂");
  await page.locator(".photo-tile").click();
  await expect(page.locator(".original img")).toBeVisible();
  const size = await page
    .locator(".original img")
    .evaluate((img: HTMLImageElement) => ({
      w: img.naturalWidth,
      h: img.naturalHeight,
    }));
  expect(size).toEqual({ w: 40, h: 80 });
  await page
    .getByRole("dialog", { name: "照片详情" })
    .getByLabel("日期", { exact: true })
    .fill("2026-10-10");
  await page
    .getByRole("dialog", { name: "照片详情" })
    .getByRole("textbox", { name: "备注", exact: true })
    .fill("修改备注");
  await page.getByRole("button", { name: "保存照片信息" }).click();
  await expect(page.locator(".photo-tile")).toHaveCount(0);
  await page.getByLabel("记录日期").fill("2026-10-10");
  await expect(page.locator(".photo-tile")).toHaveCount(1);
  const s = await state(page);
  expect(s.photos[0]).toMatchObject({
    part: "左上臂",
    date: "2026-10-10",
    note: "修改备注",
    type: "image/jpeg",
  });
  expect(s.photos[0].blobSize).toBeGreaterThan(0);
});
test("保存失败明确显示、重试保存、周期修改与新周期保留历史", async ({
  page,
}) => {
  await boot(page);
  await page.evaluate(() => {
    const native = IDBObjectStore.prototype.put;
    (window as any).nativePut = native;
    IDBObjectStore.prototype.put = function (...args: any[]) {
      if (this.name === "records")
        throw new DOMException("模拟配额耗尽", "QuotaExceededError");
      return native.apply(this, args as [any]);
    };
  });
  await page
    .getByLabel("清水洗脸", { exact: true })
    .getByRole("button", { name: "已完成", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("操作失败");
  await expect(
    page
      .getByLabel("清水洗脸", { exact: true })
      .getByRole("button", { name: "已完成", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as any).nativePut;
  });
  await page.getByRole("button", { name: "重试保存" }).click();
  await expect(page.getByRole("status").first()).toContainText("已保存");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await page.getByLabel("实验名称", { exact: true }).fill("我的观察");
  await page.getByLabel("持续天数").fill("35");
  await page.getByRole("button", { name: "保存周期" }).click();
  await expect(page.getByText("周期已保存。", { exact: true })).toBeVisible();
  await expect(page.getByText("结束：2026-11-12")).toBeVisible();
  await page.getByRole("button", { name: "创建新周期" }).click();
  await expect(page.getByLabel("当前周期")).toHaveValue(/.+/);
  await expect(page.getByLabel("当前周期").locator("option")).toHaveCount(2);
  expect((await state(page)).records[0].habits.morningWater).toBe("done");
});
test("JSON/CSV下载、手机布局与深色模式", async ({ page }) => {
  await boot(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "artifacts/mobile-home.png", fullPage: true });
  await page.getByRole("button", { name: "设置", exact: true }).click();
  for (const name of ["导出 JSON", "导出 CSV"]) {
    const promise = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const file = await promise;
    expect(file.suggestedFilename()).toMatch(
      name.includes("JSON") ? /\.json$/ : /\.csv$/,
    );
  }
  await page
    .getByRole("combobox", { name: "主题", exact: true })
    .selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await page.screenshot({ path: "artifacts/mobile-dark.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
