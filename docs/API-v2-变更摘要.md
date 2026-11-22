# 后端 API v2 变更摘要（2026-11-22）

> 来源：<https://answer-card-docs.pages.dev/>  
> 前端已按以下变更加兼容层。

## 1. 试卷 JSON 升级为 v2

```json
{
  "schemaVersion": 2,
  "answerCard": {
    "answerKey": { "q1": "A" },
    "pages": []
  },
  "paper": {
    "pages": []
  }
}
```

- `answerCard.pages[]` 和 `paper.pages[]` 都支持多页
- 页码由 `page` 字段决定，不依赖数组顺序
- 同组内页码不能重复
- `answerCard` 页必须有四角定位块
- `paper` 页不要求定位块，也不保存答案键
- 主观题答案/解析不在 v2 标准内

## 2. 答案键位置

从：

```json
{ "answerKey": {} }
```

改为：

```json
{ "answerCard": { "answerKey": {} } }
```

只允许 `type: "mark"` 的题；值必须是该题 `choices` 中的选项。

## 3. 模板独立

- 模板不再等同试卷 id
- 新增：
  - `POST /api/v1/templates`（从试卷复制 / 直接提交 v2）
  - `DELETE /api/v1/templates/{id}`
- `GET /api/v1/templates` 只返回 id / name
- `GET /api/v1/templates/{id}` 返回 `paper` 完整 v2

## 4. 多页限制

`answerCard.pages.length > 1` 时：

- 可以保存
- 检查/批改接口返回 `409 MULTI_PAGE_RECOGNITION_UNSUPPORTED`
- 只能先做单页识别

## 5. 前端兼容策略

内部保留现有 `ExamContent` 单页编辑模型：

```text
GET /papers/{id} → 后端 v2 → fromPaperV2() → 单页 ExamContent → 现有页面
PUT /papers/{id} → 单页 ExamContent → toPaperV2() → 后端 v2
```

新文件：

- `src/api/typesV2.ts`：后端 v2 类型
- `src/lib/paper/backendV2.ts`：
  - `toPaperV2()`
  - `fromPaperV2()`
  - `bundleToPaperV2()`
  - `normalizePaperDetail()`
- `src/m/api.ts`：`papersApi` / `templatesApi` 已做 v2 归一化和包装

目前：

- 现有编辑器、打印、模板加载继续可用
- 新建/保存试卷发送 v2
- 读取 v2 后自动转回单页内容
- 多页仅取第一页，识别前需提示
- 模板 create/delete 已补 API 客户端方法

## 6. 已知文档不一致

- `GET /papers/{id}`、`PUT /papers/{id}`、`exam-standard` 示例仍写着 `schemaVersion: 1`
- `exam.schema.json` 仍是 v1
- `exam-standard` 写 `type: "other"`，实际模板返回 `type: "subjective"`

前端当前以实际接口返回为准：

- `schemaVersion: 2`
- 题型 `mark | subjective`
- 兼容 `other` 映射为 `subjective`
