# 内置答题卡模板（JSON）

共 54 份，由 `npm run templates` 从 `src/lib/card/catalog.ts` 自动生成，请勿手改。

- `papers/*.paper.json`：标准 v1 试卷 JSON，可直接写入后端 `papers` 表或放进后端仓库的 `答题卡模板/` 目录
- `designs/*.design.json`：前端设计文档（额外包含渲染用的 meta / qmeta / bmeta）
- `index.json`：模板清单（体系、科目、纸型、题量、提示）

更新模板后重新运行 `npm run templates`。
