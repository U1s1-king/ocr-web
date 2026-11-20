# 试卷 OCR 扫描与多端协同系统

基于 `ocr演示.html` 原型实现的真实可运行系统：移动端 App 流程 + Web 管理端流程，
**核心功能全部直连真实接口** `POST /api/ocr`（图片二进制 → `{ image, answers[] }`）：
能连上就用真实返回，连不上就如实报错，不存在任何模拟 / 示例识别数据。

## 接口实测结论（2026-11-04）

用真实试卷 `scripts/fixtures/exam.jpg`（2560×1801）直连接口实测：

| 项 | 结果 |
|---|---|
| 请求 | `POST http://8.130.177.176:64435/api/ocr`，`Content-Type: image/jpeg`，Body 为图片二进制 |
| 响应 | `HTTP 200`，耗时约 **3.3s**，响应体约 **1.8MB** |
| `image` | `data:image/png;base64,...`，处理后图片 800×1396 |
| `answers` | **`["1:C","2:B","3:B",...]` 共 60 条**，即「题号:答案」字符串数组 |
| 失败情形 | 图片不满足前置条件时返回 `500` + `{"error":"未找到足够的四角定位块"}` |

前端按此结构做归一化：`"1:C"` → `{ no: 1, answer: "C" }`；
同时兼容 `{number, answer}` 之类的对象形态，后端改字段时只需改 `normalizeAnswer()` 一处。

## 快速开始

### 一键启动（推荐，面向展示/评审）

双击项目根目录的 **`一键启动.bat`** 即可：自动检查 Node → 安装依赖 → 构建 dist →
启动本地服务并自动打开浏览器（移动端 `http://localhost:4173/ocr/#/m`，管理端
`http://localhost:4173/ocr/#/admin/files`）。关闭黑窗口即停止服务。

生产配置在 `.env.production`（`VITE_BASE=/ocr/`），本地开发不受影响（base 仍为 `/`）。

想手动敲命令时，等价命令是：

```bash
cd ocr-system
npm start          # = vite preview，服务 dist 并代理 /api/ocr，端口 4173
```

### 开发模式

```bash
cd ocr-system
npm install
npm run dev        # http://localhost:5173
```

- 桌面浏览器打开 `http://localhost:5173/` → 自动进入 **Web 管理端**
- 手机 / 窄屏打开 → 自动进入 **移动端 App**
- 也可手动访问：`/m`（移动端）、`/admin/files`（Web 端）、`/admin/diagnostics`（接口诊断）

> 前置条件：后端 `8.130.177.176:64435` 已启动。若后端不可达，每个页面都会显示真实的
> 错误状态、HTTP 状态码与原始响应片段，可在「接口诊断」页复现并排查。

### 验证命令

```bash
npm run build                                # 类型检查 + 生产构建
npm run ui                                   # 纯视觉截图（不触发识别请求），检查布局与动效
npm run smoke                                # Chrome E2E：真实识别 → 编辑 → 导出 → 错误链路
npm run probe                                # 命令行探测接口，打印 answers 结构
npm run probe -- ./scripts/fixtures/exam.jpg # 指定图片
```

## 部署到 https://8.130.177.176:8088/ocr

生产构建已按 `/ocr/` 子路径配置好（见 `.env.production`）：

```bash
npm run build     # base=/ocr/，输出 dist/（index.html 引用 /ocr/assets/...）
```

一键出包产物在 `deploy/`：

| 文件 | 用途 |
|---|---|
| `deploy/ocr-8088.zip` | 站点包，解压到服务器 `/var/www/ocr/`（index.html + assets + favicon） |
| `deploy/Caddyfile-8088.conf` | 后端需要合并的 Caddy 配置：`/ocr/*` 静态站点 + `/api/*` 反向代理到 64435 |
| `deploy/部署说明.md` | 上传步骤、目录结构、验证地址 |

- 路由：部署构建自动切换为 **HashRouter**，地址形如 `/ocr/#/m`，静态服务器无需 SPA rewrite。
- 接口：页面用 https 打开，浏览器不允许直接请求 `http://8.130.177.176:64435`（混合内容 +
  后端无 CORS），所以必须由 8088 同源反向代理 `/api`；若后端改为提供 HTTPS + CORS 的接口，
  只需在 `.env.production` 里把 `VITE_OCR_ENDPOINT` 改成完整 URL 重新构建。

## 接口配置

| 项 | 说明 |
|---|---|
| 接口 | `POST /api/ocr`，`Content-Type: image/jpeg \| image/png`，Body 为图片二进制（非 multipart） |
| 返回 | `{ "image": "data:image/png;base64,...", "answers": ["1:C", ...] }` |
| 代理目标 | `VITE_OCR_TARGET`，默认 `http://8.130.177.176:64435` |
| 请求超时 | 120s（实测 1.7s~10s） |

复制 `.env.example` 为 `.env` 可修改代理目标：

```bash
VITE_OCR_TARGET=http://8.130.177.176:64435
```

开发/预览服务器通过 Vite 代理把 `/api` 转发到后端，**同源请求，无需后端配置 CORS**。

## 功能实现

### 移动端 `/m`

移动端采用现代 App 架构：统一玻璃质感头部（`MobileHeader`）、**悬浮玻璃 Dock 导航**
（两侧导航 + 中央识别 FAB）、固定悬浮底部操作栏（`action-bar`）、路由级页面过渡动画，
所有内容滚动区都做了安全区与 Dock 遮挡避让。

| 屏 | 路由 | 实现 |
|---|---|---|
| 首页 | `/m` | 渐变品牌头、接口状态、主操作大卡 + 次级入口、横向滑动最近记录 |
| 相机 | `/m/capture` | `getUserMedia` 真实取景、扫描线、前后摄像头切换、相册兜底 |
| 裁剪 | `/m/crop` | 四角拖拽裁剪、90° 旋转，输出 JPEG 二进制 |
| 识别中 | `/m/process` | 真实 POST 请求 + 阶段进度 + 取消；失败显示后端原始错误、可重试、可跳诊断 |
| 结果 | `/m/result` | 全宽图片 Hero（叠加 HTTP 状态/耗时）+ 答案网格 + 底部悬浮操作栏；answers 为空时明确提示 |
| 编辑 | `/m/editor` | 答案逐条编辑、单条/全部确认、确认进度 |
| 导出 | `/m/export` | 图片 / TXT（`题号:答案` 逐行）/ JSON（含 answers 原始值）真实下载 |
| 成功 | `/m/success` | 结果摘要 + 分享（Web Share / 剪贴板）+ 历史入口 |
| 历史 | `/m/history` | 搜索（标题/答案）、全部/今天/已确认筛选、回看、删除、清空，IndexedDB 持久化 |

### Web 管理端 `/admin`

| 页 | 路由 | 实现 |
|---|---|---|
| 文件管理 | `/admin/files` | 拖拽/多选上传、队列预览、最近记录、接口说明 |
| 批量识别 | `/admin/batch` | 并发 2 队列、真实进度、失败原因、重试、清空 |
| 双栏审阅 | `/admin/review` | 左：接口返回图片；右：答案逐条编辑 + 确认 + 保存 |
| 结果列表 | `/admin/results` | 表格勾选、批量导出、删除、跳转审阅 |
| 数据统计 | `/admin/stats` | 识别份数 / 答案条数 / 确认率 / 7 天趋势 |
| 接口诊断 | `/admin/diagnostics` | 连通性测试、上传真实图识别测试、原始响应、请求日志与排障提示 |

## 技术栈

- React 19 + TypeScript + Vite
- Tailwind CSS 4（`@theme` 设计令牌，粉色品牌色板 + 深梅色相机页）
- lucide-react 图标（本地打包，无 CDN 依赖）
- idb-keyval + IndexedDB 保存真实识别结果
- Vite `/api` 代理解决跨域；Playwright-core 驱动本机 Chrome 做 E2E

## 目录结构

```
ocr-system/
├─ scripts/
│  ├─ fixtures/exam.jpg      # 真实试卷测试图（E2E / 探测用）
│  ├─ probe-ocr.mjs          # 命令行接口探测
│  ├─ ui-preview.mjs         # 纯 UI 截图（移动端 + 管理端）
│  └─ smoke.mjs              # Chrome E2E 冒烟测试
├─ src/
│  ├─ api/ocr.ts             # 接口层：二进制 POST、answers 归一化、错误翻译、请求日志
│  ├─ components/            # 双端外壳、悬浮 Dock、移动端头部、通用 UI
│  ├─ context/ScanContext.tsx# 会话、批量队列、审阅记录
│  ├─ lib/                   # 图片处理、IndexedDB、导出、接口状态
│  └─ pages/                 # 移动端页面
│     └─ admin/              # Web 管理端页面
└─ vite.config.ts            # /api 代理
```

## 界面与动效

- 设计语言：粉色品牌色板（`src/index.css` 的 `@theme` 令牌）+ 深梅色相机/识别页，圆角、玻璃拟态、
  柔和阴影；组件样式集中在 `@layer components`（`.card` / `.btn` / `.seg` / `.data-table` 等），
  页面只组合语义类，便于统一改版。
- 移动端骨架：`.dock` 悬浮导航（中央 FAB 带呼吸光环）、`.mobile-header` 玻璃头部、
  `.action-bar` 固定操作栏；`.anim-page-in` 提供路由切换过渡，`prefers-reduced-motion` 下自动降级。
- 交互动效：`stagger` 列表逐项入场、卡片悬浮/按压回弹、答案确认态渐变、按钮渐变位移、
  扫描线与取景角标动画、进度条流光等，均在 CSS 中实现，不引入动画库。
- 截图：`npm run ui` 输出到 `screenshots/ui/`（仅渲染页面，不请求 OCR 接口）。

## 已知限制

- 接口要求图片满足其四角定位条件；不满足时后端返回 500，前端原样展示错误，不做任何补数据。
- `answers` 仅含「题号:答案」，不含题目正文、坐标框与置信度；因此界面不展示定位框/置信度，
  也不提供「去手写 / 模版排版 / Word/PDF 转换」等后端未提供的能力。
- 历史记录保存在浏览器 IndexedDB，换浏览器或清缓存会丢失；不含账号体系。
