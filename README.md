# 鉴裁 · 答题卡识别系统

一个仓库、一套前端：**Web 管理端 + 移动端**。对接后端 `/api/v1`（Bun + Hono + SQLite 答题卡系统），
覆盖试卷版式设计、考试组织、答题卡识别/批改、成绩分析、人工复核、学生名册、接口日志，
以及拍照识别、本机历史、导出、识别诊断等移动端能力。

> 本仓库由原来的 `answer-card-web`（主系统）与 `ocr-system`（旧原型）合并而来，
> 旧代码保存在 git tag `pre-merge` 中可随时找回。合并说明见文末。

## 功能总览

### Web 管理端（`/#/exams`）

| 模块 | 路由 | 说明 |
|---|---|---|
| 试卷 | `/#/papers` | 试卷库、**答题卡制作（模板工坊）**、**文本出卡 DSL**、PS 式精调、答案键、打印 / 存 PDF；54 份高考风格模板 |
| 考试 | `/#/exams` | 创建考试并绑定试卷、考试详情、考试批次 |
| 上传批改 | `/#/check` | 多图上传 → 识别 → 逐题结果；按试卷配置做透视校正与涂卡判断 |
| 识别记录 | `/#/check/history` | 本机历史（IndexedDB）：搜索、展开、导出 TXT/JSON/CSV、删除、清空 |
| 成绩 | `/#/results` | 跨考试/批次成绩列表、分数段/走势/占比图表、CSV 导出 |
| 人工复核 | `/#/reviews` | 客观题争议与主观题评分队列、题目原图、最终判定 |
| 文件 | `/#/files` | 上传原图、按 SHA-256 去重、检索复用 |
| 学生 | `/#/students` | 名册维护、批量导入/更新/删除 |
| 接口日志 | `/#/logs` | 服务端请求/响应日志 |
| 设置 | `/#/settings` | 接口地址与令牌（多套方案）、主题配色、高级选项 |
| 识别诊断 | `/#/settings/diagnostics` | 连通性测试、真实识别链路自检、本机 + 服务端请求日志、排障提示 |

### 答题卡制作（重点）

`/#/papers/studio`：54 份内置模板（普高 18 / 职教 16 / 中考 18 / 通用 2）→ 调题量与表头 →
实时预览 → 保存为新试卷 / 打印 / 导出 JSON / 进入精调。排版引擎按毫米计算，自动保证
四角定位块、题区不越界、选项比例合法、主观题不重叠，容量不足时先压缩再自动升纸型。

`/#/papers/dsl`：Sheeter 风格的文本出卡，一行一题（`X-4` 单选、`T-1` 填空、`L-8` 解答、`B-3` 数字涂卡），
`#split` 分栏、实时预览，适合批量出同规格答题卡。

`/#/papers/:id/edit`：**PS 式精调**（react-moveable + Selecto）：框选/多选、拖动、缩放、文本块旋转、
吸附参考线、标尺、图层显隐、对齐分布、0.5mm 数值面板、撤销重做、实时校验。

模板版式参考 AnswerSheetMaker（MIT）的真实高考 A3 答题卡：四角定位块、准考证号方格、条形码区、
注意事项、填涂样例、试卷类型 / 缺考标记、分栏题区、页码页脚；生成引擎保证不越界不重叠。

详细说明见 [docs/答题卡制作.md](docs/答题卡制作.md)；`npm run templates` 会导出
`templates/papers/*.paper.json`（可灌入后端试卷表/模板目录）与 `templates/designs/*.design.json`。

### 移动端（`/#/m`）

版式参照 `docs/design-reference/` 的四张 vivo 设计图实现（详见 [docs/移动端版式.md](docs/移动端版式.md)）：

- **首页**（Today 版式）：日期 + 大标题、全宽拍照/上传行动卡、数据概览、最近成绩排行榜、功能图标网格
- **试卷**（应用页版式）：我的试卷 / 答题卡模板分段、推荐模板横滑卡、体系胶囊、模板排行榜
- **考试**（表盘页版式）：精选操作横滑大卡、全部/待批改/已出分分段、考试排行榜行
- **我的**（我的页版式）：资料行、连接状态卡、快捷入口、数据工具图标卡、分组设置列表

另有成绩明细（含成绩单导出）、拍照识别（拍照/相册 → 压缩 → 四角裁切/旋转 → 识别）、
本机识别历史、文件库、学生、批次、复核、日志、接口设置、主题等页面；底部沿用胶囊 Dock + 搜索 FAB。

## 技术栈

- React 19 + TypeScript + Vite 7，HashRouter（静态托管无需 SPA rewrite）
- Tailwind CSS 4（设计令牌在 `src/styles/`）
- 手写组件与 CSS，无 UI 框架；图表为自绘 SVG
- 本机存储：IndexedDB（本机识别历史）+ localStorage（接口方案、会话缓存）
- 部署：Cloudflare Pages（`functions/api/[[path]].js` 同源转发 `/api`）
- 冒烟：playwright-core 驱动本机 Chrome

## 目录结构

```
.
├─ src/
│  ├─ api/            # 接口层（唯一 fetch 出口：client.ts 统一鉴权/错误/请求日志）
│  ├─ m/              # 移动端 App（页面、移动端 API、主题、图标、组件）
│  ├─ pages/          # Web 管理端页面
│  ├─ components/     # 两端共用组件（Layout/Logo/Toast/Confirm/UI）
│  ├─ lib/            # 图片处理、离线历史、导出、诊断请求日志、试卷设计器数据层
│  ├─ designer/       # 版式设计器渲染
│  └─ styles/         # 设计令牌与全局样式
├─ public/            # 图标、manifest、logo
├─ functions/api/     # Cloudflare Pages Functions：/api/* → 后端隧道
├─ scripts/           # 冒烟脚本、真实试卷图、模板 JSON 导出
├─ templates/         # 54 份内置模板导出的 paper/design JSON（npm run templates）
├─ docs/              # API 摘要、接口 HTML、原型、设计参照、答题卡制作说明、历史归档
├─ deploy/            # 部署脚本（Cloudflare Pages / 命名隧道 / 旧 Caddy 方案）
└─ assets/brand/      # 品牌源文件（logo / splash）
```

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173
```

- Web 端：`http://localhost:5173/#/exams`
- 移动端：`http://localhost:5173/#/m`
- 接口：开发环境由 Vite 代理 `/api` → `.env.development` 里的 `VITE_API_TARGET`，
  浏览器同源请求，不需要后端配置 CORS。

### 接口配置

复制 `.env.example` 为 `.env.local` 可按需覆盖：

```text
VITE_API_BASE=/                        # / = 同源（开发代理 / 生产 Pages Functions）
VITE_API_TOKEN=                        # 服务端 EXAM_API_TOKEN
VITE_API_TARGET=https://...            # 仅开发/预览：/api 代理目标
```

也可以完全在页面「设置 → 接口设置」里填写地址与令牌（存本机 localStorage，支持多套方案）。

## 构建与验证

```bash
npm run build        # 类型检查 + 生产构建 → dist/
npm run typecheck    # 只做类型检查
npm run start        # 本地预览 dist（端口 4173，带 /api 代理）
npm run smoke        # 路由冒烟（需先 npm run dev，默认 BASE=http://127.0.0.1:5173）
npm run templates    # 重新导出 templates/ 下的 54 份模板 JSON
```

`npm run smoke` 会依次打开 23 个桌面/移动端/制作/诊断路由，检查是否有前端运行时错误，
截图输出到 `shots/smoke/`。设置 `CHROME_PATH` 可指定本机 Chrome。

## 部署

### Cloudflare Pages（当前方案）

```bash
npm run build
set CF_TOKEN=你的_Cloudflare_API_Token
python deploy/cloudflare/deploy_pages.py     # 项目 ocr-web，产出 *.pages.dev
```

`functions/api/[[path]].js` 会把同源 `/api/*` 转发到后端隧道（可用环境变量 `API_ORIGIN` 覆盖）。
详见 `deploy/README.md`。

### 命名隧道（后端对外）

`deploy/tunnel/run-tunnel.ps1` 读取 `tunnel_id.txt` / `tunnel_token.txt`，用 cloudflared 把本机服务
暴露成固定 https 域名；前端默认接口地址即该隧道域名。

### 旧方案（保留备查）

`deploy/Caddyfile-8088.conf` + `deploy/部署说明-8088-旧方案.md`：把 `dist/` 放到服务器 `/var/www/ocr/`
并由 Caddy 在 8088 端口同源反代 `/api`。

## 已知限制

- 后端识别依赖图片四角的定位块；定位块拍不全/透视过大时返回 `CHECK_FAILED`，前端如实展示错误。
- 识别结果包含答案、对错、置信度与存疑标记，不包含题目正文/文字识别内容，因此不提供「去手写/Word 转换」等能力。
- 本机历史与接口方案只存在当前浏览器，换设备/清缓存会丢失；服务端成绩不受影响。
- 学生名单目前存本机（后端只提供批量增删改接口，没有列表接口）。

## 从两个项目合并的说明

- 主系统：原 `answer-card-web`（React 19 + Vite，`/api/v1`，品牌「鉴裁」）→ 现在是仓库根项目。
- 答题卡制作页已整体重做：标准 v1 直接编辑 + 毫米排版引擎 + 54 模板 + 模板工坊/精调/打印三段式，
  旧的自由画布设计器（v2）与「经典编辑器」已移除。
- 旧原型：原 `ocr-system`（旧 `/api/ocr` 流程）→ 其中仍有价值的能力已移植：
  - 四角拖拽裁切 + 90° 旋转 + 上传前压缩（移动端拍照识别）
  - 识别诊断页（连通性、真实链路自检、请求日志、排障提示）
  - 导出 TXT / JSON / CSV（识别结果与成绩单）
  - 本机识别历史（IndexedDB，移动端 `/#/m/history` 与桌面 `/#/check/history`）
  - Vite `/api` 开发代理、Cloudflare Pages / 隧道部署脚本
- 已清理：旧版移动端 `src/mobile`、`/legacy` 路由；旧的 `answer-card-web` / `ocr-system` 包装目录。
  `/cards` 旧版卡片式编辑器保留作回退入口。
- 旧仓库快照：`git show pre-merge` / `git checkout pre-merge`。

## 文档

- 接口摘要：`docs/API-v1-摘要.md`
- 接口 HTML：`docs/_apidocs/`
- 原型与设计参照：`docs/ocr演示.html`、`docs/design-reference/`
- 历史归档：`docs/history/`


## 前端视觉（已回退到 ede1df3e 版本）

- **基线**：`https://ede1df3e.ocr-web-eww.pages.dev` 对应的前端样式（git `7c68eba`）——
  桌面端樱花粉白卡片、清爽侧栏；移动端 iOS 蓝白「Today / 表盘 / 应用 / 我的」版式。
- **保留的功能**：答题卡模板工坊、精调页、文本出卡 DSL、答案键、本机记录、诊断页等新功能仍在，
  只是视觉回到旧版；导航中补了「文本出卡」入口。
- **不再加载**：framer-motion / tsparticles / canvas-confetti 与 `fx.css` 特效层，包体回到轻量状态。
- **Web 参考**：配色与圆角/阴影规范参照 `D:\za\GitHub\king.github.io\MODULE-SPLIT-GUIDELINES.md`
  的樱花粉体系（`#e982a2` 主粉、粉棕文字、粉系阴影）。
- **主题**：桌面与移动主题预设恢复为目标版本（桌面默认樱花粉 `#e06a8f`，移动默认晴空蓝 `#3a63b8`）；
  旧版本测试留下的主题色会在启动时清理一次。
- 说明文档见 `docs/视觉回退说明.md`。


## 2026-11 前端细节修复与首页改版

- **字体 bug**：antd-mobile 的全局 `body` 规则会覆盖项目字体和文字颜色；已调整样式加载顺序并提高 body 规则优先级，
  字体统一走 `MiSans / HarmonyOS Sans / PingFang SC / Noto Sans SC / Microsoft YaHei` 系统栈。
- **主题色未跟随**：`--adm-font-family`、`--adm-color-*`、滚动条、品牌阴影等写死颜色改为主题令牌；
  桌面/移动主题色切换后，按钮、选中态、搜索、卡片高光、首页 Bento 卡均跟随变化。
- **桌面动画**：参考 `king.github.io/css/anim.css` 与 `anim-lib.js`，实现标题入场、侧栏逐项入场、
  卡片滚动浮现、hover 抬起、顶部滚动进度条（`src/components/AppMotion.tsx`）。
- **移动端首页**：改为“工作台”总入口，包含搜索、拍照主卡、快捷入口、数据概览、8 个模块入口、
  最近成绩与待办；搜索可直接唤起全局搜索面板，所有区块可跳转对应页面。
- 配色/圆角/阴影继续参考 `king.github.io/MODULE-SPLIT-GUIDELINES.md` 的樱花粉规范。


## 2026-11 动效与粒子升级

- **Web 3D 粒子背景**：`src/components/ParticleField.tsx`，canvas 三维粒子缓慢旋转、按深度缩放，
  鼠标 200px 内自动连线；颜色跟随主题色；可在「设置 → 视觉与动效」开关（`ac.visualPrefs` 持久化）。
- **动画库**：接入 `framer-motion`，桌面路由切换上浮淡入、移动端页面转场；配合自研 CSS 动画。
- **滚动进出场**：`src/components/ScrollFx.tsx` 使用 IntersectionObserver，进入视口上浮淡入、
  离开视口淡出上移，再进入重新播放；Web 与移动端共用，可在设置里关闭「页面交互动效」。
- **CSS/SVG 动画**：Web 右上角 SVG 轨道与连线绘制；移动首页主卡内置 SVG 扫描线、笔触路径、
  环绕粒子；按钮/卡片/导航 hover、press、逐项入场、主题色下划线等。
- **移动首页**：工作台总入口（搜索、主行动、快捷入口、数据、8 模块、最近成绩、待办），
  搜索唤起全局搜索，所有入口可跳转；小屏 360px 有单独排版。

设置入口：
- Web：`设置 → 接口配置` 顶部「视觉与动效」
- 移动：`我的 → 设置 → 视觉与动效`


## 服务状态与 Logo 使用

- **服务状态**：本项目不是离线应用，核心识别/批改/接口功能必须等待后端服务启动。
  - 移动首页状态会显示「连接中 / 服务未连接 / 服务已连接」；
  - 未连通时显示「后端服务未连接，启动后点击重试」；
  - 演示数据标签改为「演示数据」，不再使用「离线」误导；
  - 文案中的「离线可用/断网也能用」已全部移除。
- **Logo**：Web 侧栏/移动顶栏/抽屉、移动首页头像、我的服务卡、关于页、开屏统一使用 `public/logo-seal.png`，
  尽量用印章 logo 代替纯文字品牌名；文字只保留定位语 `tagline` 与拼音。


## 2026-11 粒子全屏、服务提示与移动端信息密度

- **粒子全屏**：粒子改为屏幕坐标 + 深度视差分布，铺满整个视口，不再集中在中间区域；鼠标靠近仍自动连线。
- **服务提示**：除「接口配置」页外，其他页面不再展示服务状态/错误文案。
  - 接口失败时统一弹窗：**「服务器抽风去了，吃个瓜先」**（每次会话提示一次，可直接去接口配置）。
  - 接口配置页（Web / 移动）新增「接口诊断」：区分接口不通、地址配置错误、Token 无效、路径错误、后端 5xx，并显示最近一次失败请求。
  - 移除了首页/我的页的状态标签与各页错误条。
- **切换到手机版按钮**：改为白底 + 主题色文字，跟随自定义主题时按钮与文字始终有对比度。
- **数据统计**：
  - Web 成绩分析新增 4 个 KPI 卡（成绩数/平均分/最高分/优秀率）；
  - 移动成绩页默认展示柱状分布，新增筛选成绩、平均分、最高分、优秀率数据条；
  - 其他移动页补充数据条（试卷、考试、我的、复核、文件、批次、日志等），并加页面主题光晕，提升信息密度。


## 2026-11-20 接口地址动态化

- **新隧道地址**：`https://diffs-entered-goat-formula.trycloudflare.com`
  - 已同步更新 `src/api/client.ts` 默认值、Pages Functions `UPSTREAM`、Vite 开发代理目标。
- **接口设置动态生效**：
  - 地址/Tokens 保存后立即写 `localStorage`，后续每个请求动态读取，不需要刷新或重新构建。
  - 「接口诊断」改为实时状态：保存/重新检测后立即刷新当前生效地址与结果；检测成功显示「接口正常」，失败显示本次错误。
  - 保存或切换地址会清空旧的失败记录，避免旧提示残留。
- **无需改代码切隧道**：
  - 直接访问 `https://站点/?api=https://新的隧道地址`，地址会写入本机；
  - 也可以访问 `#/m?api=...`（移动端）；
  - 或直接在「接口配置」里改地址保存。
- Pages Functions 仍支持通过 `API_ORIGIN` 环境变量覆盖上游，便于在 Cloudflare 后台切换隧道。


## 2026-11 答题卡编辑器组件化与自由排版

- **修复拖动/缩放坐标系**：命中层按屏幕坐标预览，提交时换算 mm，缩放后拖动跟手；所有题目、文本、组件都可点选/拖动。
- **组件库**（答题卡精调右侧 / 移动编辑器底部）：
  - 选择题组：输入题数、选项数、每题分值，自动生成 N 行选择题
  - 主观题组：输入题数、每题行数、样式（横线/方格/空白），生成 N 个答题框
  - 空白方框组：数学/历史用无横线方框
  - 文本、标题、分组标题、分割线、注意事项、学生信息、条形码占位、页眉、页脚/页码
- **组与图层**：生成后默认成组整体拖动，可在图层面板中查看组/子元素、隐藏、拆成独立小题、删除组；支持整组拖拽。
- **移动端基础编辑器**：`/m/papers/:id/edit`，支持组件添加、参数调节、点选拖动与保存，精细排版回桌面端。
- **数据兼容**：保存到后端仍是标准 v1 试卷 JSON；组定义只保存在本机设计文档和导出的 design JSON 中，不影响后端识别。

保存/导出：
- 后端：`PUT /api/v1/papers/{id}`，提交标准 questions/blocks
- 本机：localStorage CardDoc v3，包含 qmeta / bmeta / groups
- 导出 JSON：包含 meta / content / qmeta / bmeta / groups


## 2026-11 自定义条形码 + 模块分组

### 条形码
- 使用 MIT 开源的 [JsBarcode](https://github.com/lindell/JsBarcode)（v3.12.3）前端生成 SVG，打印为矢量。
- 支持格式：Code128、Code39、EAN-13、ITF-14。
- 编辑器组件库新增「自定义条形码」：内容、格式、显示文字、尺寸（可拖动缩放）。
- 与「贴条形码区」占位组件相互独立，不会把示例学生粘贴处替换成真实条码。
- 保存到后端时，把第一条自定义条码同步为 `content.barcode`（`type: code128`，后端标准目前只接受 Code128；其他格式前端打印，后端记录 Code128 镜像值）。
- 本机 CardDoc / 导出 design JSON 保存全部自定义条码。

第三方 License：JsBarcode MIT；后续若启用 bwip-js，同样为 MIT。

### 模块分组
- 桌面侧栏、移动首页按三组划分：
  - 核心业务：试卷 → 考试 → 成绩 → 人工复核
  - 资源服务：文件、学生
  - 系统服务：接口日志、设置
- 各模块保留独立职责，减少跨模块入口混淆。


## 2026-11 账号、条形码联动与移动端导航

- **条形码制作页**：`/papers/templates`（原模板工坊入口）改为按学生考号批量生成条形码标签，支持 Code128/Code39/EAN-13/ITF-14，SVG 预览与 A4 标签打印。
- **学生考号联动**：条形码制作以 `students.candidateNumber` 为数据源；答题卡编辑器添加条形码时也可以直接从学生考号带入。
- **本地模拟账号**：Web 侧栏左下角账号卡，可编辑姓名、头像、身份；三种本地模拟权限：
  - 管理员：全部模块
  - 教师：试卷/考试/成绩/复核/文件/学生
  - 阅卷员：考试/成绩/复核
  后端登录/注册接口接入后替换 `src/lib/account.ts`。
- **移动端导航**：底部改为 首页 / 试卷 / 成绩 / 我的；首页改为带模块分组的链接页。
- **版权声明**：页面中的品牌引用/出处暂时移除，待后端提供完整声明名单后再统一补充。
