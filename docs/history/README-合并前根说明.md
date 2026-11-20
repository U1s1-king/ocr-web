# 竞赛 OCR 项目

两套前端 + 部署脚本，统一放在这个目录下。

## 目录

```
OCR/
├─ ocr-system/        主系统（原型落地版，含 dist / deploy / screenshots）
│   └─ 一键启动.bat     双击即构建 + 起本地预览（端口 4173）
├─ answer-card-web/   新版 Web + 移动端前端（React 19 + Vite，对接 /api/v1）
├─ deploy-tunnel/     Cloudflare 命名隧道：run-tunnel.ps1 / tunnel_id.txt / tunnel_token.txt
└─ docs/              原型参考：ocr演示.html
```

## 说明

- `ocr-system/scripts/fixtures/exam.jpg` 是唯一的真实试卷测试图，别再往根目录丢副本。
- 运行日志不要放在仓库根目录：tunnel 日志已固定写到 `deploy-tunnel/named-tunnel.log`。
- `answer-card-web/.wrangler`、`*.tsbuildinfo`、`.jwt.tmp` 都是可再生成的临时产物。
