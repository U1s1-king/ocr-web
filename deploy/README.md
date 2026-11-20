# 部署

## 1. Cloudflare Pages（当前使用，必须带 Functions）

前端是纯静态 SPA（HashRouter），后端接口由 Pages Functions 同源转发，避免 CORS 与混合内容。

**请用 wrangler 部署（会同时上传 `functions/`）**：

```bash
# 仓库根目录
npm run build
set CLOUDFLARE_API_TOKEN=你的_Cloudflare_API_Token      # PowerShell: $env:CLOUDFLARE_API_TOKEN="..."
set CLOUDFLARE_ACCOUNT_ID=你的账户ID
npm run deploy:pages
```

- 项目名：`ocr-web`，产物：`dist/`
- 接口：`functions/api/[[path]].js` 把 `/api/*` 转发到 `UPSTREAM`（trycloudflare 隧道），
  可用 Pages 环境变量 `API_ORIGIN` 临时切换后端地址。
- 生产环境变量（构建时）：`.env.production` 里 `VITE_API_BASE=/` 表示同源。
- wrangler 需要走代理时先设置 `HTTP_PROXY/HTTPS_PROXY=http://127.0.0.1:7897`。

> ⚠️ 不要用 `deploy/cloudflare/deploy_pages.py`（纯静态直传 API）做正式发布：
> 它只上传 `dist/` 静态资源，**不会带 Functions**，线上 `/api/*` 会回落到 SPA 首页 HTML。
> 该脚本仅保留给「只需要静态预览」的场景。

## 2. 独立 API 代理 Worker（备选）

`deploy/cloudflare/api-proxy-worker.mjs` + `deploy_api_proxy.py` 可以把 `/api` 代理做成独立
Worker（带 CORS），适合 Pages 无法使用 Functions 的情况：

```bash
set CF_TOKEN=...            # 需要 Workers Scripts:Edit
python deploy/cloudflare/deploy_api_proxy.py ocr-api-proxy
```

上传成功后还需在控制台/Global API Key 方式开启 `workers.dev` 子域（普通 API Token 调用
`/workers/scripts/{name}/subdomain` 会返回 405），然后把 `.env.production` 的
`VITE_API_BASE` 改成 Worker 地址并重新构建。

## 3. 命名隧道（把本机后端暴露成固定 https 域名）

```powershell
.\deploy\tunnel\run-tunnel.ps1
```

- 依赖：`cloudflared.exe`（默认 `D:\za\cf\cloudflared.exe`，可用 `CLOUDFLARED` 环境变量覆盖）
- 凭据：`deploy/tunnel/tunnel_token.txt`、`tunnel_id.txt`
- 日志：`deploy/tunnel/named-tunnel.log`
- 前端默认接口地址（`src/api/client.ts` 的 `DEFAULT_BASE`）、Functions 的 `UPSTREAM`、
  `deploy/cloudflare/api-proxy-worker.mjs` 的 `UPSTREAM` 都指向该隧道域名，换隧道后要同步修改。

## 4. 旧方案：Caddy 8088 子路径（备查）

见 `deploy/Caddyfile-8088.conf` 与 `deploy/部署说明-8088-旧方案.md`。
当前构建已改为根路径 + HashRouter，不再需要 `/ocr/` 子路径；如需复用旧方案，把
`VITE_BASE` 相关配置加回 `vite.config.ts` 并重新构建。
