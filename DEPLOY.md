# 部署说明（2026-11-20）

这个仓库是「鉴裁 OCR」的前端源代码，已剔除 `node_modules`、`dist`、截图、本地密钥与构建产物。

## 一、GitHub 仓库

- 仓库：`https://github.com/U1s1-king/ocr-web`
- 分支：`main`
- 新增了 `.github/workflows/deploy-pages.yml`，推送到 `main` 会自动构建并部署 GitHub Pages。

> 旧仓库历史里有一个 Cloudflare Token 文件，被 GitHub 推送保护拦截；当前仓库是干净快照，不包含任何 Token。

## 二、当前已配置的两套部署

### 1. Cloudflare Pages（生产主站）

- 生产：https://ocr-web-eww.pages.dev
- 构建命令：`npm ci && npm run build`
- 输出目录：`dist`
- `functions/api/[[path]].js` 是 `/api` 同源代理，已加 CORS
- 隧道地址变化时，在 Cloudflare Pages 环境变量里改 `API_ORIGIN`

### 2. GitHub Pages（静态站，API 走 Cloudflare Pages 代理）

- 地址：`https://u1s1-king.github.io/ocr-web/`
- 构建：`.github/workflows/deploy-pages.yml`
- GitHub Pages 自身没有 `/api` 转发，所以前端构建时使用绝对 API：
  - `.env.pages` 中 `VITE_API_BASE=https://ocr-web-eww.pages.dev`
  - 请求路径为 `https://ocr-web-eww.pages.dev/api/v1/...`
- Cloudflare Pages Function 已经加了 CORS，允许 GitHub Pages 跨域调用
- 前提：Cloudflare 的隧道后端必须在线；隧道地址变更后要更新 `API_ORIGIN`

> 如果 CF 的 `API_ORIGIN` 隧道离线，GitHub Pages 页面能打开，但数据会报「服务器抽风去了」。这不是 GitHub Pages 的问题。

## 三、GitHub Actions 首次启用

1. 打开仓库 `Settings → Pages`
2. Source 选择 **GitHub Actions**
3. 推送 `main` 后等待 Actions 完成，访问 `https://u1s1-king.github.io/ocr-web/`

工作流会自动：

```bash
npm ci
npm run build -- --mode pages
```

其中 `.env.pages` 配置：

```ini
VITE_BASE=/ocr-web/
VITE_API_BASE=https://ocr-web-eww.pages.dev
VITE_API_TOKEN=
```

## 四、后端需要单独部署

仓库不包含 OCR 后端服务本身。后端需要：

1. 启动 OCR API 服务
2. 暴露 Cloudflare Tunnel
3. 隧道地址变化时：
   - Cloudflare Pages 环境变量 `API_ORIGIN` 改成新隧道地址，或
   - 前端「设置 → 接口配置」保存新地址
4. 替换答题卡模板 JSON：
   - `templates/designs/*.design.json`
   - `templates/papers/*.paper.json`
   - `templates/index.json`
   - 或使用 `card-templates-2026-11-20.zip`
   - 条形码区域仅保留「贴条形码区 / 示例学生粘贴处」占位，不含真实条码

## 五、不需要上传的东西

- `node_modules/`、`dist/`
- `shots/`、`screenshots/`、`*.zip`
- `.wrangler/`
- `deploy/tunnel/tunnel_token.txt`（本机隧道密钥，已 `.gitignore`）
