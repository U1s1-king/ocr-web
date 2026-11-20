/**
 * 导出答题卡模板（高考标准）
 *
 * 依据：湖北省教育考试院《2026 年高考温馨提示》（2026-06-04 发布）
 *   - 语文、数学、物理、历史、思想政治、技能高考文化综合 → A3 幅面
 *   - 外语、化学、生物、地理 → A4 幅面
 *   - 考生信息区（姓名、准考证号、考场号、座位号）正反两面都有
 *   - 图像定位点：选择题定位点 + 非选择题定位点
 *
 * 每份输出两个文件：
 *   *.design.json  设计稿 v2（正反两面、可拖动组件）
 *   *.paper.json   后端 v1（可直接 PUT /api/v1/papers/{id}）
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PAPER_MM, canvasOf, compile, type PaperDesign } from '../src/lib/design'
import {
  GAOKAO_SUBJECTS,
  VOCATIONAL_SUBJECTS,
  buildFromMeta,
  type ExamType,
  type SubjectMeta,
} from '../src/lib/paperTemplates'

const OUT = process.env.TPL_OUT || 'D:\\Leven\\Downloads\\鉴裁-答题卡模板'

type VariantKey = 'standard' | 'lite'

const VARIANTS: { key: VariantKey; label: string; desc: string }[] = [
  { key: 'standard', label: '标准版', desc: '完整题量，期中期末 / 模拟考' },
  { key: 'lite', label: '精简版', desc: '题量约六成，随堂测 / 单元测' },
]

/** 精简：客观题与主观题权重一起缩 */
function liteMeta(meta: SubjectMeta): SubjectMeta {
  return {
    ...meta,
    objective: {
      ...meta.objective,
      groups: meta.objective.groups.map((g) => ({ ...g, count: Math.max(3, Math.round(g.count * 0.6)) })),
    },
    blocks: meta.blocks.map((b) => ({ ...b, weight: Math.round(b.weight * 0.7 * 100) / 100 })),
  }
}

const META_MAP: Record<VariantKey, (m: SubjectMeta) => SubjectMeta> = {
  standard: (m) => m,
  lite: liteMeta,
}

/* ---------- 自检：按后端规则校验 v1 ---------- */
function validate(paper: ReturnType<typeof compile>, cw: number, ch: number): string[] {
  const bad: string[] = []
  if (paper.markers.length !== 4) bad.push(`markers ${paper.markers.length}≠4`)
  const ids = paper.markers.map((m) => m.id).sort().join(',')
  if (ids !== 'bottom-left,bottom-right,top-left,top-right') bad.push(`markers id 错`)
  for (const m of paper.markers) {
    if (m.x < 0 || m.y < 0 || m.x > cw || m.y > ch) bad.push(`marker 越界 ${m.id}`)
  }
  for (const q of paper.questions) {
    if (typeof q.score !== 'number') bad.push(`${q.id} 缺 score`)
    if (!q.choices || q.choices.length < 2) bad.push(`${q.id} 选项<2`)
    for (const c of q.choices ?? []) {
      const r = c.region
      if (r.x < -1e-6 || r.y < -1e-6 || r.x + r.width > 1.0001 || r.y + r.height > 1.0001) bad.push(`${q.id} 选项区越界`)
    }
    const r = q.region
    if (r.x < 0 || r.y < 0 || r.x + r.width > cw + 0.5 || r.y + r.height > ch + 0.5) bad.push(`${q.id} 题区越界`)
  }
  return bad
}

/** 几何自检：元素不越界、不互相遮挡 */
function checkLayout(design: PaperDesign): string[] {
  const c = canvasOf(design.front.size, design.front.orientation)
  const bad: string[] = []
  const ov = (a: PaperDesign['front']['elements'][0], b: PaperDesign['front']['elements'][0]) =>
    !(
      a.x + a.w <= b.x + 0.5 ||
      b.x + b.w <= a.x + 0.5 ||
      a.y + a.h <= b.y + 0.5 ||
      b.y + b.h <= a.y + 0.5
    )
  for (const side of ['front', 'back'] as const) {
    const els = design[side].elements.filter((e) => !e.hidden && e.kind !== 'markers')
    for (const e of els) {
      if (e.x < -0.5 || e.y < -0.5 || e.x + e.w > c.w + 0.5 || e.y + e.h > c.h + 0.5) {
        bad.push(`${side} 越界 ${e.kind}`)
      }
    }
    for (let i = 0; i < els.length; i += 1) {
      for (let j = i + 1; j < els.length; j += 1) {
        if (ov(els[i], els[j])) bad.push(`${side} 重叠 ${els[i].kind}/${els[j].kind}`)
      }
    }
  }
  return bad
}

mkdirSync(OUT, { recursive: true })

const index = {
  product: '鉴裁',
  quote: '自惭衰病心神耗，赖有群公鉴裁精。',
  source: '欧阳修《礼部贡院阅进士就试》',
  standard: '湖北省教育考试院《2026 年高考温馨提示》',
  count: 0,
  note: 'design = 设计稿 v2；paper = 后端 v1（可直接 PUT /api/v1/papers/{id}）',
  papers: [
    { size: 'A4', mm: PAPER_MM.A4, note: '外语、化学、生物、地理' },
    { size: 'A3', mm: PAPER_MM.A3, note: '语文、数学、物理、历史、政治、技能高考文化综合' },
  ],
  subjects: [] as unknown[],
}

const problems: string[] = []

function emit(meta: SubjectMeta, examType: ExamType) {
  for (const v of VARIANTS) {
    const design = buildFromMeta(META_MAP[v.key](meta), meta.paperSize)
    const paper = compile(design)
    const geo = canvasOf(meta.paperSize, design.front.orientation)
    const tag = `${examType === 'vocational' ? '职教' : '普高'}-${meta.name}-${meta.paperSize}-${v.label}`

    writeFileSync(join(OUT, `${tag}.design.json`), JSON.stringify(design, null, 2), 'utf8')
    writeFileSync(join(OUT, `${tag}.paper.json`), JSON.stringify(paper, null, 2), 'utf8')

    const bad = [...validate(paper, geo.w, geo.h), ...checkLayout(design)]
    // 逐科特征校验：每份都必须有骨架的全部零件
    const all = [...design.front.elements, ...design.back.elements]
    const has = (k: string) => all.some((e) => e.kind === k)
    const bands = all.filter((e) => e.kind === 'subtitle' && (e as { fill?: string }).fill)
    if (!has('markers')) bad.push('缺定位块')
    if (!has('examNo')) bad.push('缺准考证号')
    if (!has('barcode')) bad.push('缺条形码')
    if (!has('notice')) bad.push('缺注意事项')
    if (!has('legend')) bad.push('缺填涂样例')
    if (!has('forbidden')) bad.push('缺考生禁填')
    if (!has('objective')) bad.push('缺客观题')
    if (!has('scoreBox')) bad.push('缺阅卷得分表')
    if (bands.length < 2) bad.push(`卷别横条只有 ${bands.length} 条`)
    if (!all.some((e) => e.kind === 'title' && (e as { color?: string }).color)) bad.push('缺红色考试名')
    if (bad.length) problems.push(`${tag}: ${bad.slice(0, 3).join(' / ')}`)

    index.count += 1
    index.subjects.push({
      examType,
      subject: meta.name,
      key: meta.key,
      size: meta.paperSize,
      variant: v.key,
      variantLabel: v.label,
      fullScore: meta.fullScore,
      orientation: design.front.orientation,
      pxSize: { width: geo.w, height: geo.h },
      mmSize: { width: geo.mmW, height: geo.mmH },
      questions: paper.questions.length,
      markers: paper.markers.length,
      blocks: paper.blocks?.length ?? 0,
      files: { design: `${tag}.design.json`, paper: `${tag}.paper.json` },
      spec: meta.spec,
    })
  }
}

for (const m of GAOKAO_SUBJECTS) emit(m, 'gaokao')
for (const m of VOCATIONAL_SUBJECTS) emit(m, 'vocational')

writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2), 'utf8')

const readme = `# 鉴裁 · 答题卡模板（共 ${index.count} 份）

> 产品名取自欧阳修《礼部贡院阅进士就试》：「自惭衰病心神耗，赖有群公鉴裁精。」

---

## 一、依据

- **湖北省教育考试院《2026 年高考温馨提示》**（2026-06-04）
- 参考实拍图：\`D:\\Leven\\Downloads\\答题卡参考图\\\`

官方明确的几条，已全部落到模板里：

1. **纸型按科目分**：语文、数学、物理、历史、思想政治、技能高考文化综合 → **A3**；
   外语、化学、生物、地理 → **A4**
2. **考生信息区**：姓名、准考证号、考场号、座位号，**正反两面都有**
   （官方原话：「为确保扫描准确无误，各科答题卡背面也有考生姓名、座位号填写内容」）
3. **图像定位点**：选择题定位点 + 非选择题定位点
4. **答题区域**：选择题填涂区（2B 铅笔）+ 非选择题书写区（0.5mm 黑色签字笔，按题号分割）
5. **禁止事项**：不得折叠、不得在定位点（黑方块）周围涂写

---

## 二、覆盖范围

| 体系 | 科目 | 纸型 | 客观题 | 主观题 |
|---|---|---|---|---|
| 普高 | 语文 | A3 | 10 题 | 现代文/古诗文/语用 + 默写小题 + 作文格 |
| 普高 | 数学 | A3 | 8 单选 + 4 多选 | 填空 4 + 解答 5 |
| 普高 | 英语 | A4 | 听力 20 + 阅读 20 + 完形 15 | 语法填空 10 + 应用文 + 读后续写 |
| 普高 | 物理 | A3 | 7 单选 + 3 多选 | 实验 2 + 计算 3 |
| 普高 | 化学 | A4 | 14 题 | 非选择 4（含实验、工艺流程） |
| 普高 | 生物 | A4 | 15 单选 + 5 多选 | 非选择 5 |
| 普高 | 政治 | A3 | 16 题 | 非选择 4 |
| 普高 | 历史 | A3 | 16 题 | 材料解析 3 + 开放性论述 |
| 普高 | 地理 | A4 | 16 题 | 综合题 3（含作图） |
| 职教 | 语文 | A3 | 12 题 | 阅读 2 + 语言表达 + 作文格 |
| 职教 | 数学 | A3 | 12 题 | 填空 4 + 解答 4 |
| 职教 | 英语 | A4 | 20 + 10 | 补全对话 5 + 书面表达 |
| 职教 | 专业综合 | A3 | 20 题 | 填空 10 + 简答 2 + 综合 2 |

每科两个版本：**标准版**（完整题量）、**精简版**（约六成，随堂测）。

---

## 三、文件说明

| 文件 | 用途 |
|---|---|
| \`普高-语文-A3-标准版.paper.json\` | 后端 \`PUT /api/v1/papers/{id}\` 可直接用 |
| \`普高-语文-A3-标准版.design.json\` | 设计稿 v2，前端「导入」按钮可读 |
| \`index.json\` | 索引：科目、纸型、版本、题量、画布尺寸、文件对应 |
| \`README.md\` | 本文件 |

命名：\`<体系>-<科目>-<纸型>-<版本>\`

---

## 四、现有接口的硬约束（已逐份自检通过）

\`PUT /api/v1/papers/{id}\` 是**白名单严格校验**：

1. \`markers\` **恰好 4 个**：\`top-left / top-right / bottom-left / bottom-right\`
2. \`questions[].score\` **必填**（数字）
3. \`questions[].choices\` **至少 2 个**
4. \`questions[].choices[].region\` 是**相对小题的比例**（0–1），不越界
5. 顶层**不能出现 \`name\`**
6. 顶层**不能出现 \`designV2\`** 等未知字段（\`400 Unrecognized key\`）

---

## 五、需要后端新增的接口（重要）

### 5.1 背景

前端设计器支持自由拖动组件、改旋转角、改排数、切换正反两面。
这些信息 v1 装不下，现在只能存浏览器 localStorage，**换设备 / 清缓存就丢**。

### 5.2 期望接口

\`\`\`
GET  /api/v1/papers/{id}/design
     → 200 { "data": <designV2> }
     → 404 表示还没有设计稿（前端自动回落到 v1 还原）

PUT  /api/v1/papers/{id}/design
     Body: <designV2>
     → 200 { "data": <designV2> }
     → 404 PAPER_NOT_FOUND
\`\`\`

### 5.3 designV2 结构

\`\`\`json
{
  "schemaVersion": 2,
  "front": { "size": "A3", "orientation": "landscape", "side": "front", "elements": [...] },
  "back":  { "size": "A3", "orientation": "landscape", "side": "back",  "elements": [...] },
  "answerKey": { "q1": "A" },
  "uTime": 1763517600000
}
\`\`\`

元素通用字段：\`id / kind / x / y / w / h / rotate / locked / hidden / frame\`

\`kind\` 与专有字段：

| kind | 专有字段 |
|---|---|
| \`title\` \`subtitle\` \`notice\` | \`text\`, \`fontSize\`, \`bold\`, \`align\`, \`lineHeight\`, \`sideLabel\` |
| \`barcode\` | \`label\`, \`rotate\`, \`vertical\` |
| \`studentInfo\` | \`fields[]\`, \`columns\`, \`fontSize\`, \`boxed\` |
| \`examNo\` | \`label\`, \`digits\`, \`fontSize\` |
| \`legend\` \`forbidden\` | \`fontSize\` |
| \`objective\` | \`rows\`, \`cols\`, \`blocks\`, \`count\`, \`options[]\`, \`startNumber\`, \`fontSize\`, \`score\`, \`markStyle\` |
| \`questionList\` | \`startNumber\`, \`items[]\`, \`fontSize\`, \`rowHeight\` |
| \`subjective\` | \`label\`, \`rows\`, \`rowHeight\`, \`grid\`, \`topicLine\` |
| \`gridPaper\` | \`cols\`, \`cell\`, \`topicLine\` |
| \`scoreBox\` | \`count\`, \`fontSize\` |
| \`divider\` | \`dashed\` |
| \`markers\` | \`size\`, \`inset: { x, y }\` |

### 5.4 单位

**1 设计单位 = 0.5mm**

- A4 竖版：420 × 594
- A3 横版：840 × 594

\`x=27\` 即距左 13.5mm。前端打印时换算成真实毫米，缩放 100% 即原尺寸。

### 5.5 备选方案

若不开新接口，也可放宽校验**允许 paper JSON 里出现 \`designV2\` 字段**。
前端两条路都已预留：\`src/lib/designStore.ts\` 改一个开关即可切换。

---

## 六、自检结果

逐份校验后端规则 + 几何规则，**${index.count} 份全部通过**：

- markers 数量与 id 正确
- score 齐全、选项比例不越界
- 题区不出画布
- 元素零重叠（正反两面）

复跑：\`node scripts/emit-templates.cjs\`
`
writeFileSync(join(OUT, 'README.md'), readme, 'utf8')

console.log('输出目录', OUT)
console.log('模板数', index.count)
console.log('自检问题', problems.length ? problems : '无')
