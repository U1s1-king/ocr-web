# 答题卡识别 · 前端（Web 端 + 移动端）

对接后端 `/api/v1`（Bun + Hono + SQLite 答题卡系统）。
一个代码库，两套皮肤：**Web 管理端**（樱花粉浅色站风）与 **移动端**（深色/浅色双主题 App 风），
通过路由前缀 `/web` 与 `/m` 区分。

## 技术栈

- React 19 + TypeScript + Vite
- zustand（全局状态）
- 无 UI 框架，手写 CSS（两套设计令牌，见 `src/styles/`）

## 目录

```
src/
├─ api/            # 后端接口层（唯一允许 fetch 的地方）
│  ├─ client.ts        # 基础请求、鉴权头、错误归一
│  ├─ types.ts         # 后端 JSON 契约（Exam / CheckResult / File）
│  ├─ exams.ts         # /api/v1/exams 增删改查 + check
│  └─ files.ts         # /api/v1/files 上传
├─ store/          # zustand 状态（web / mobile 分域）
├─ styles/         # 设计令牌与基础样式
├─ shared/         # 两端共用：组件、hooks、工具
├─ web/            # Web 管理端页面
└─ mobile/         # 移动端页面
```

## 配置

后端地址在 `.env` 里：

```text
VITE_API_BASE=http://127.0.0.1:3000
VITE_API_TOKEN=
```

留空则运行时在页面上填写（存 localStorage），方便换服务器。

## 启动

```bash
npm install
npm run dev
```

- Web 端：`http://localhost:5173/#/web/exams`
- 移动端：`http://localhost:5173/#/m`

## 接口对照

| 功能 | 方法 | 路径 |
|---|---|---|
| 创建空试卷 | POST | `/api/v1/exams` |
| 获取试卷 | GET | `/api/v1/exams/{id}` |
| 修改试卷 | PUT | `/api/v1/exams/{id}` |
| 删除试卷 | DELETE | `/api/v1/exams/{id}` |
| 批量检查 | POST | `/api/v1/exams/check` |
| 上传文件 | POST | `/api/v1/files` |
