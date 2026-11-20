/**
 * 导出全部内置答题卡模板为 JSON：
 *  - templates/papers/*.paper.json   标准 v1 试卷 JSON（可批量灌入后端 papers 表 / 答题卡模板目录）
 *  - templates/designs/*.design.json 前端设计文档（含 meta / qmeta / bmeta，用于打印与精调）
 *  - templates/index.json            模板清单
 *
 * 用法：npm run templates
 */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const entry = path.join(root, 'scripts', 'emit-card-templates-entry.ts')
const tmp = path.join(root, 'node_modules', '.tmp', 'emit-card-templates.mjs')
fs.mkdirSync(path.dirname(tmp), { recursive: true })

await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: tmp,
  logLevel: 'error',
  define: { 'import.meta.env': JSON.stringify({}) },
})

const mod = await import(pathToFileURL(tmp).href)
const { CARD_TEMPLATES } = mod
const { generateCard } = mod
const { contentForBackend } = mod

const papersDir = path.join(root, 'templates', 'papers')
const designsDir = path.join(root, 'templates', 'designs')
fs.mkdirSync(papersDir, { recursive: true })
fs.mkdirSync(designsDir, { recursive: true })

const slug = (s) =>
  s
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

const index = []
for (const t of CARD_TEMPLATES) {
  const generated = generateCard(t.spec)
  const doc = generated.doc
  const base = `${slug(t.name)}__${slug(t.id)}`
  const paper = contentForBackend(doc)
  fs.writeFileSync(path.join(papersDir, `${base}.paper.json`), JSON.stringify(paper, null, 2), 'utf8')
  fs.writeFileSync(path.join(designsDir, `${base}.design.json`), JSON.stringify(doc, null, 2), 'utf8')
  index.push({
    id: t.id,
    name: t.name,
    system: t.systemLabel,
    subject: t.subject,
    paperSize: doc.meta.paperSize,
    orientation: doc.meta.orientation,
    fullScore: t.fullScore,
    questions: paper.questions.length,
    objective: paper.questions.filter((q) => q.type === 'mark').length,
    subjective: paper.questions.filter((q) => q.type === 'subjective').length,
    warnings: generated.warnings,
    files: {
      paper: `papers/${base}.paper.json`,
      design: `designs/${base}.design.json`,
    },
  })
}

fs.writeFileSync(path.join(root, 'templates', 'index.json'), JSON.stringify(index, null, 2), 'utf8')
fs.writeFileSync(
  path.join(root, 'templates', 'README.md'),
  [
    '# 内置答题卡模板（JSON）',
    '',
    `共 ${index.length} 份，由 \`npm run templates\` 从 \`src/lib/card/catalog.ts\` 自动生成，请勿手改。`,
    '',
    '- `papers/*.paper.json`：标准 v1 试卷 JSON，可直接写入后端 `papers` 表或放进后端仓库的 `答题卡模板/` 目录',
    '- `designs/*.design.json`：前端设计文档（额外包含渲染用的 meta / qmeta / bmeta）',
    '- `index.json`：模板清单（体系、科目、纸型、题量、提示）',
    '',
    '更新模板后重新运行 `npm run templates`。',
    '',
  ].join('\n'),
  'utf8',
)

console.log(`已导出 ${index.length} 份模板 → templates/`)
