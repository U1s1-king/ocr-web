# 部署说明（2026-11-20）

这个文件夹就是可以上传到 GitHub 的完整仓库快照，已剔除 `node_modules`、`dist`、截图、本地密钥与构建产物。

## 一、上传到 GitHub

1. 打开已创建的仓库：`https://github.com/U1s1-king/ocr-web`
2. 把本文件夹里的**全部内容**上传（不要只上传 `src`）。
3. 也可以在本目录执行：

```bash
git init -b main
git add .
git commit -m "chore: deploy 鉴裁 OCR"
git remote add origin https://github.com/U1s1-king/ocr-web.git
git push -u origin main
```

> 之前旧仓库历史里有一个 Cloudflare Token 文件，被 GitHub 推送保护拦截；这个新目录是干净快照，不包含任何 Token。

## 二、Cloudflare Pages 部署（推荐，和当前生产一致）

在 Cloudflare Dashboard → Workers & Pages → 创建 Pages → 连接 Git：

| 配置项 | 值 |
| --- | --- |
| 项目名 | `ocr-web` |
| 生产分支 | `main` |
| 框架预设 | `Vite` |
| 构建命令 | `npm ci && npm run build` |
| 构建输出目录 | `dist` |
| 根目录 | `/` |
| Node 版本 | 20 或 22 |

环境变量：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE` | `/` | 必须同源，走 Pages Functions 的 `/api` 转发 |
| `API_ORIGIN` | 可选，当前默认 `https://diffs-entered-goat-formula.trycloudflare.com` | 隧道地址变化时在 Pages 环境变量里改这里，不用改代码 |
| `VITE_API_TOKEN` | 留空 | 前端不需要内置 Token |

> `functions/api/[[path]].js` 会被 Cloudflare Pages 自动识别为 Functions；`public/_headers`、`public/_redirects` 会打进 `dist`。

### 不需要上传的东西

- `node_modules/`、`dist/`：Cloudflare 构建时自动生成
- `shots/`、`screenshots/`、`*.zip`、`.wrangler/`
- `deploy/tunnel/tunnel_token.txt`：本机隧道密钥，已加入 `.gitignore`
- 已打包的答题卡 JSON 压缩包：单独给后端

## 三、后端需要单独部署的内容

这个仓库只包含前端 + Pages Functions，不包含 OCR 后端服务本身。

后端侧需要确认：

1. OCR API 服务已启动，并暴露在 Cloudflare Tunnel 地址上
2. 隧道地址变化后：
   - 在 Cloudflare Pages 环境变量 `API_ORIGIN` 改成新地址，或
   - 在前端「设置 → 接口配置」填写新地址并保存
3. 答题卡模板 JSON：
   - 使用 `templates/designs/*.design.json`、`templates/papers/*.paper.json`、`templates/index.json`
   - 或使用之前打包的 `card-templates-2026-11-20.zip` 由后端替换
   - 模板里的条形码区域仅为「贴条形码区 / 示例学生粘贴处」占位，不含真实条码

## 四、GitHub Pages 说明

不建议直接用 GitHub Pages 部署这个项目：GitHub Pages 没有 `/api` 转发，接口会不可用。

如果只想看静态预览：

- 需要把 API 地址改成绝对隧道地址（设置页保存，或访问 `?api=https://隧道地址`）
- 需要为仓库路径配置 Vite `base`，否则 `/assets` 会 404

正式部署继续用 Cloudflare Pages。
