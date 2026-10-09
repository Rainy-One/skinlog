# SkinLog

中文优先、iPhone 竖屏适配的个人洗护与皮肤状态观察 PWA。所有个人数据仅保存在当前设备 IndexedDB；不需要账号，没有云端数据库、追踪、广告或图像分析。

默认实验：2026-10-09 至 2026-11-05，28 天。允许补记、修改、遗漏与重叠周期。未记录习惯不会算作未完成，评分 null 不会算作 0。

## 开发与运行

需要 Node.js 22.12+（推荐 22 LTS 或 24）和 npm。云端终端即可完成，无需本地电脑。

```sh
npm ci
npm run dev
npm run build
npm run preview -- --port 4173
npm test
npx playwright install chromium
npm run test:e2e
```

`npm run build` 包含严格 TypeScript 检查，生成 `dist/`。测试结果见 [TESTING.md](TESTING.md)。生产离线测试使用构建后的 preview，开发服务器不启用 Service Worker。

## 功能

- 今日记录：8 个习惯三态、9 个可选 0–3 分指标、原始多行文字、自动保存与失败提示。
- 月历：记录与照片分别标记，日期切换、补记和删除；删除记录默认保留照片。
- 趋势：7 / 14 / 28 天或自定义、面部 / 身体 / 头皮分项折线、缺失断线、习惯完成/未完成/未知次数、前后半段均值与样本数。
- 周期：名称、开始日期、天数修改与新周期；日期记录独立存储，历史不会被新周期覆盖。总结可在任何阶段查看，结束后显示完整总结，包括首尾七天、原始文字、照片时间轴和缺失情况，支持复制和 TXT 下载。短于14天的周期首尾窗口可能重叠，界面有说明。
- 照片：相机与相册、自定义部位、日期和备注编辑、原始文件查看与删除；同部位并排/滑动对比、分别缩放和水平/垂直调整。操作不改变照片文件，也不分析或推断疗效。
- ZIP 完整备份与事务覆盖恢复；JSON、CSV 和 TXT 导出；系统/浅色/深色主题。

## HTTPS 静态部署（推荐 GitHub Pages）

已部署到 GitHub Pages：[打开 SkinLog](https://rainy-one.github.io/skinlog/)。仓库为 [Rainy-One/skinlog](https://github.com/Rainy-One/skinlog)，源码公开；个人记录和照片仍仅保存在设备中。后续修改通过手动触发 GitHub Actions 工作流发布。

仅使用 iPhone 也可以操作：

1. 在 GitHub 网页创建仓库，将本项目所有源码上传；或者在授权 GitHub 后，由 Codex 将项目推送到你的仓库。不要上传 node_modules、个人备份或照片。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 打开 **Actions → Deploy SkinLog to GitHub Pages → Run workflow**。
4. 构建和发布完成后，在 Pages 或工作流输出获取 `https://用户名.github.io/仓库名/` 地址。
5. Safari 打开该 HTTPS 地址进行安装。`base: './'`、manifest 和 SW 使用相对路径，兼容仓库子路径。应用不使用服务器端路由。

也可以将 `dist/` 完整上传到任何 HTTPS 静态主机。不要只上传 index.html；必须保留 assets、manifest、sw.js、workbox 文件和图标。服务器应为 index.html、sw.js、manifest 提供短缓存或重新验证，带哈希 assets 可长期缓存。HTTPS 或 localhost 是 Service Worker 的要求。更换域名或部署路径意味着新的存储空间，应先备份后恢复。

无需环境变量、付费服务或后端。GitHub Pages 发布应用代码，个人记录和照片不会随之上传。

## iPhone 添加到主屏幕

1. 使用 **Safari** 打开已部署的 HTTPS 地址。
2. 等待首屏与资源加载完成（首次联网打开）。
3. 点击 Safari **分享** 按钮，向下找到 **添加到主屏幕**（新版 iOS 可位于更多菜单）。
4. 名称确认 **SkinLog**，点击 **添加**。
5. 从主屏幕图标打开，再联网加载一次。关闭应用、开启飞行模式重新打开验证离线功能。

安装不是强制条件，Safari 标签页也可记录。iOS 版本可能使浏览器标签与主屏幕应用使用不同数据容器；如发现记录未共享，请使用 ZIP 备份迁移。不要在私密浏览中长期记录。

统计中的“实际记录天数”指至少填写了一项习惯状态、评分或非空文字的日期；仅有照片的日期通过照片标记与时间轴单独呈现。

## 保存、隐私与照片

IndexedDB 数据库 `skinlog`，版本 1：`records`（日期主键）、`photos`（UUID 主键，Blob + 日期/部位/备注）、`cycles`、`settings`。备份另有结构版本 `version: 1`。未来升级应通过 IndexedDB upgrade 事务及明确版本迁移实现；当前不接受未知版本。

习惯和评分立即排队保存；文字 350ms 防抖，失焦、切换页面、pagehide 和 visibilitychange 时尽力提交。显示“已保存到本机”后再退出。系统强制终止网页进程可能丢失最后尚未完成的写入，无法承诺绝对不丢失。保存失败时输入保留，显示错误并提供重试；失败未解决时阻止导出或覆盖恢复。

JPEG / PNG / WebP 保存原文件，不缩小、不美颜、不调色，保留 EXIF 方向，浏览器负责正确显示。其他浏览器可解码的图片格式转换为原尺寸 96% 质量 JPEG；HEIC 兼容性依赖 Safari/iOS，不可解码时明确报错，需在“照片/文件”中导出为 JPEG。单张最大40MB；无自动压缩意味着可能更快耗尽本地配额。照片删除同步删除 Blob；内存 URL 在组件卸载时释放。

本应用数据默认保存在当前设备浏览器中。清除网站数据、更换设备、系统清理存储空间或长期未访问可能造成数据丢失。浏览器的持久存储请求不保证被批准，也不代替备份。应用不会上传照片或记录，不调用第三方图像分析。网络请求仅获取应用本身的静态资源与更新。

## 备份与恢复

- **ZIP：完整备份**，包括 `skinlog.json`、`photos/<照片UUID>` 原文件、关联元数据与版本号。请定期保存到 iPhone“文件”、iCloud Drive 或其他你控制的备份位置。Safari 的下载动作可能显示下载/文件预览；请核对文件真正保存。
- **JSON：结构化数据与照片元数据，不含照片文件**。不是完整照片备份；不提供 JSON 恢复入口。
- **CSV：每日习惯、评分、原始文字，不含照片，也不包含周期/设置**。UTF-8 BOM、保留多行及逗号；空评分为空单元格，0分为0。公式前缀加单引号防止电子表格执行公式。
- **TXT：所选周期的客观总结**，可复制给 ChatGPT，由用户自己决定是否分享。应用不会自动发送。

恢复仅支持完整 ZIP，最大300MB。先验证版本、日期、评分范围、习惯状态、唯一ID、周期设置关系、照片路径/大小/文件头，再展示记录/照片/周期数量预览。用户明确确认覆盖后，在跨所有对象存储的单一 IndexedDB 事务中清除与写入；失败回滚，现有数据不变。不提供合并导入。恢复较大备份需要足够内存和磁盘空间，请保持页面打开。

备份是未加密文件，可能含私人照片和文字；请存放在你信任的位置。

## 离线与更新

Vite PWA / Workbox 预缓存应用 HTML、JS、CSS、manifest 和图标。首次加载和缓存完成后可离线打开并记录。照片与记录来自本地 IndexedDB，不依赖网络。离线不会上传或同步。

首次访问未完成缓存、缓存被系统删除、私密浏览限制或设备存储耗尽时，离线功能可能不可用。应用更新提示后先确认保存并备份，关闭所有该应用页面再打开，避免正在输入时强制刷新。

## 目录

```text
src/
  App.tsx        今日、日历、趋势、周期/数据管理
  Photos.tsx     照片采集、元数据、浏览与对比
  model.ts       数据结构、设备日期、统计、总结
  db.ts          IndexedDB CRUD与事务恢复
  backup.ts      ZIP/JSON/CSV、严格导入验证
  main.tsx       React与SW入口
  style.css      移动端、safe area、主题
public/          PWA图标
 tests/          单元/数据库/浏览器测试
.github/workflows/pages.yml  手动部署
vite.config.ts   构建、manifest、SW预缓存
README.md / TESTING.md
```

## 边界

没有注册、云同步、通知、社交、积分或 AI 皮肤评分。不生成健康总分、改善百分比、诊断或产品疗效结论。实验目标中提及的症状仅用于观察，不代表应用能检测疾病。
