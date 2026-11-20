/**
 * 自动出卷模板（高考标准版）
 *
 * 两套体系：
 *   gaokao     普通高考（新高考卷，语数英 150 分，选考科目 100 分）
 *   vocational 职教高考（文化课语数英 + 专业课，题量略少）
 *
 * 共同骨架（所有科目完全一致，符合真实答题卡规范）：
 *
 *   表头  ┌ 标题 / 副标题
 *         ├ 姓名 · 考场号 · 座位号（横排一行）
 *         ├ 准考证号方格 ＋ 竖贴条形码（并排）
 *         ├ 注意事项（左侧竖排红字）
 *         ├ 填涂样例（正确 ■ / 错误 √ × ○）
 *         └ 此栏考生禁填（缺考 / 标记）
 *
 *   客观题  每块 4 栏 × 最多 5 行，块间留空，编号「块→栏→行」；可分段
 *   主观题  lines 整块横线 / list 小题列表 / grid 作文格
 *   反面顶部再放一次考生信息 + 页码（真卡正反两面都有）
 *   页脚    每栏底部「超出黑色矩形边框限定区域的答案无效 · 第 X 页 共 2 页」
 *
 * 落位规则：一条连续的流，正面各栏 → 反面各栏；先算高度再落位，
 * 放不下就换栏，换栏还放不下就压行数，绝不越界、绝不重叠。
 *
 * 单位：1 设计单位 = 0.5mm。A4 竖版 420×594，A3 横版 840×594。
 */

import {
  canvasOf,
  defaultOrientation,
  emptyDesign,
  uid,
  type PaperDesign,
  type PaperElement,
  type PaperSize,
} from './design'

/* ================= 类型 ================= */

export type SubjectKey =
  | 'chinese'
  | 'math'
  | 'english'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'politics'
  | 'history'
  | 'geography'
  | 'v-chinese'
  | 'v-math'
  | 'v-english'
  | 'v-major'
  | 'v-elec'
  | 'v-cs'
  | 'v-nurse'
  | 'v-fin'

/** 考试体系 */
export type ExamType = 'gaokao' | 'vocational'

export interface ObjectiveGroup {
  title: string
  count: number
  /** 该段选项，默认 ABCD */
  options?: string[]
  /** 该段每题分值 */
  score?: number
}

export type BlockKind = 'lines' | 'list' | 'grid'

export interface SectionSpec {
  label: string
  kind: BlockKind
  weight: number
  items?: number[]
  startNumber?: number
  cols?: number
}

export interface SubjectMeta {
  key: SubjectKey
  name: string
  hint: string
  spec: string
  /** 满分 */
  fullScore: number
  /** 官方纸型：语文数学物理历史政治用 A3，外语化学生物地理用 A4 */
  paperSize: PaperSize
  objective: {
    groups: ObjectiveGroup[]
    options: string[]
    score: number
  }
  blocks: SectionSpec[]
}

/* ================= 普通高考（新高考卷） ================= */

const GAOKAO: SubjectMeta[] = [
  {
    key: 'chinese',
    name: '语文',
    hint: '现代文 + 古诗文 + 语用 + 作文',
    spec: '客观 10 题 · 主观 4 块 · 作文 800 字',
    fullScore: 150,
    paperSize: 'A3',
    objective: {
      groups: [{ title: '一、选择题（每小题 3 分，共 30 分）', count: 10 }],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、现代文阅读（16 分）', kind: 'lines', weight: 1.2 },
      { label: '三、古诗文阅读（18 分）', kind: 'lines', weight: 1.3 },
      { label: '四、语言文字运用（12 分）', kind: 'lines', weight: 0.9 },
      { label: '五、名句默写（8 分）', kind: 'list', weight: 0.9, items: [2, 2, 2, 2, 2], startNumber: 17 },
      { label: '六、作文（60 分）', kind: 'grid', weight: 3.6, cols: 20 },
    ],
  },
  {
    key: 'math',
    name: '数学',
    hint: '单选 8 + 多选 4 + 填空 4 + 解答 5',
    spec: '客观 12 题 · 填空 4 题 · 解答 5 题（共 19 题）',
    fullScore: 150,
    paperSize: 'A3',
    objective: {
      groups: [
        { title: '一、单项选择题（1–8 题，每小题 5 分，共 40 分）', count: 8, score: 5 },
        { title: '二、多项选择题（9–12 题，每小题 5 分，共 20 分）', count: 4, score: 5 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 5,
    },
    blocks: [
      { label: '三、填空题（13–16 题，每小题 5 分，共 20 分）', kind: 'list', weight: 1.0, items: [2, 2, 2, 2], startNumber: 13 },
      { label: '四、解答题 17（10 分）', kind: 'lines', weight: 1.3 },
      { label: '18（12 分）', kind: 'lines', weight: 1.5 },
      { label: '19（12 分）', kind: 'lines', weight: 1.5 },
      { label: '20（12 分）', kind: 'lines', weight: 1.6 },
      { label: '21（12 分）', kind: 'lines', weight: 1.6 },
    ],
  },
  {
    key: 'english',
    name: '英语',
    hint: '听力 + 阅读 + 完形 + 语法填空 + 两篇写作',
    spec: '客观 55 题（分 3 段）· 语法填空 10 · 应用文 + 读后续写',
    fullScore: 150,
    paperSize: 'A4',
    objective: {
      groups: [
        { title: '一、听力（1–20 题，每小题 1.5 分，共 30 分）', count: 20, score: 1.5 },
        { title: '二、阅读理解（21–40 题，每小题 2.5 分，共 50 分）', count: 20, score: 2.5 },
        { title: '三、完形填空（41–55 题，每小题 1 分，共 15 分）', count: 15, score: 1 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 1.5,
    },
    blocks: [
      { label: '四、语法填空（56–65 题，每小题 1.5 分，共 15 分）', kind: 'list', weight: 1.2, items: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], startNumber: 56 },
      { label: '五、应用文写作（15 分）', kind: 'lines', weight: 1.4 },
      { label: '六、读后续写（25 分）', kind: 'grid', weight: 2.4, cols: 22 },
    ],
  },
  {
    key: 'physics',
    name: '物理',
    hint: '单选 7 + 多选 3 + 非选择 5',
    spec: '客观 10 题 · 非选择 5 题（满分 100）',
    fullScore: 100,
    paperSize: 'A3',
    objective: {
      groups: [
        { title: '一、单项选择题（1–7 题，每小题 4 分，共 28 分）', count: 7, score: 4 },
        { title: '二、多项选择题（8–10 题，每小题 5 分，共 15 分）', count: 3, score: 5 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 4,
    },
    blocks: [
      { label: '三、实验题 11（8 分）', kind: 'lines', weight: 1.2 },
      { label: '12（10 分）', kind: 'lines', weight: 1.4 },
      { label: '四、计算题 13（10 分）', kind: 'lines', weight: 1.5 },
      { label: '14（13 分）', kind: 'lines', weight: 1.7 },
      { label: '15（16 分）', kind: 'lines', weight: 1.9 },
    ],
  },
  {
    key: 'chemistry',
    name: '化学',
    hint: '单选 + 非选择题（含实验、工艺流程）',
    spec: '客观 14 题 · 非选择 4 题（满分 100）',
    fullScore: 100,
    paperSize: 'A4',
    objective: {
      groups: [{ title: '一、选择题（1–14 题，每小题 3 分，共 42 分）', count: 14, score: 3 }],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、非选择题 15（14 分）', kind: 'lines', weight: 1.4 },
      { label: '16（14 分）', kind: 'lines', weight: 1.4 },
      { label: '17（15 分，实验题）', kind: 'lines', weight: 1.6 },
      { label: '18（15 分，工艺流程）', kind: 'lines', weight: 1.6 },
    ],
  },
  {
    key: 'biology',
    name: '生物',
    hint: '单选 + 多选 + 非选择题',
    spec: '客观 20 题 · 非选择 5 题（满分 100）',
    fullScore: 100,
    paperSize: 'A4',
    objective: {
      groups: [
        { title: '一、单项选择题（1–15 题，每小题 2 分，共 30 分）', count: 15, score: 2 },
        { title: '二、多项选择题（16–20 题，每小题 3 分，共 15 分）', count: 5, score: 3 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 2,
    },
    blocks: [
      { label: '三、非选择题 21（11 分）', kind: 'lines', weight: 1.2 },
      { label: '22（11 分）', kind: 'lines', weight: 1.2 },
      { label: '23（11 分）', kind: 'lines', weight: 1.2 },
      { label: '24（11 分）', kind: 'lines', weight: 1.2 },
      { label: '25（11 分）', kind: 'lines', weight: 1.2 },
    ],
  },
  {
    key: 'politics',
    name: '政治',
    hint: '单选 + 材料分析题',
    spec: '客观 16 题 · 非选择 4 题（满分 100）',
    fullScore: 100,
    paperSize: 'A3',
    objective: {
      groups: [{ title: '一、选择题（1–16 题，每小题 3 分，共 48 分）', count: 16, score: 3 }],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、非选择题 17（10 分）', kind: 'lines', weight: 1.2 },
      { label: '18（12 分）', kind: 'lines', weight: 1.3 },
      { label: '19（14 分）', kind: 'lines', weight: 1.5 },
      { label: '20（16 分）', kind: 'lines', weight: 1.7 },
    ],
  },
  {
    key: 'history',
    name: '历史',
    hint: '单选 + 材料解析 + 开放性论述',
    spec: '客观 16 题 · 非选择 4 题（满分 100）',
    fullScore: 100,
    paperSize: 'A3',
    objective: {
      groups: [{ title: '一、选择题（1–16 题，每小题 3 分，共 48 分）', count: 16, score: 3 }],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、材料解析题 17（14 分）', kind: 'lines', weight: 1.4 },
      { label: '18（14 分）', kind: 'lines', weight: 1.4 },
      { label: '19（12 分）', kind: 'lines', weight: 1.2 },
      { label: '20、开放性论述（12 分）', kind: 'lines', weight: 1.5 },
    ],
  },
  {
    key: 'geography',
    name: '地理',
    hint: '单选 + 综合题（含作图）',
    spec: '客观 16 题 · 综合题 3 题（满分 100）',
    fullScore: 100,
    paperSize: 'A4',
    objective: {
      groups: [{ title: '一、选择题（1–16 题，每小题 3 分，共 48 分）', count: 16, score: 3 }],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、综合题 17（16 分，含作图）', kind: 'lines', weight: 1.7 },
      { label: '18（18 分）', kind: 'lines', weight: 1.9 },
      { label: '19（18 分，选做）', kind: 'lines', weight: 1.9 },
    ],
  },
]

/* ================= 职教高考（文化课 + 专业） ================= */

const VOCATIONAL: SubjectMeta[] = [
  {
    key: 'v-chinese',
    name: '语文',
    hint: '职教高考 · 选择 + 阅读 + 应用文 + 作文',
    spec: '客观 12 题 · 主观 3 块 · 作文 600 字',
    fullScore: 120,
    paperSize: 'A3',
    objective: {
      groups: [{ title: '一、选择题（每小题 3 分，共 36 分）', count: 12 }],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、现代文阅读（18 分）', kind: 'lines', weight: 1.3 },
      { label: '三、文言文阅读（14 分）', kind: 'lines', weight: 1.1 },
      { label: '四、语言表达与应用（12 分）', kind: 'lines', weight: 1.0 },
      { label: '五、作文（40 分，不少于 600 字）', kind: 'grid', weight: 2.8, cols: 20 },
    ],
  },
  {
    key: 'v-math',
    name: '数学',
    hint: '职教高考 · 选择 + 填空 + 解答',
    spec: '客观 12 题 · 填空 4 题 · 解答 4 题',
    fullScore: 120,
    paperSize: 'A3',
    objective: {
      groups: [{ title: '一、选择题（每小题 4 分，共 48 分）', count: 12, score: 4 }],
      options: ['A', 'B', 'C', 'D'],
      score: 4,
    },
    blocks: [
      { label: '二、填空题（每小题 4 分，共 16 分）', kind: 'list', weight: 1.0, items: [2, 2, 2, 2], startNumber: 13 },
      { label: '三、解答题 17（12 分）', kind: 'lines', weight: 1.4 },
      { label: '18（14 分）', kind: 'lines', weight: 1.5 },
      { label: '19（14 分）', kind: 'lines', weight: 1.5 },
      { label: '20（16 分）', kind: 'lines', weight: 1.7 },
    ],
  },
  {
    key: 'v-english',
    name: '英语',
    hint: '职教高考 · 选择 + 补全对话 + 写作',
    spec: '客观 30 题 · 补全对话 5 · 书面表达 1 篇',
    fullScore: 100,
    paperSize: 'A4',
    objective: {
      groups: [
        { title: '一、单项选择（1–20 题，每小题 1.5 分，共 30 分）', count: 20, score: 1.5 },
        { title: '二、阅读理解（21–30 题，每小题 2 分，共 20 分）', count: 10, score: 2 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 1.5,
    },
    blocks: [
      { label: '三、补全对话（每小题 2 分，共 10 分）', kind: 'list', weight: 1.0, items: [1, 1, 1, 1, 1], startNumber: 31 },
      { label: '四、书面表达（20 分）', kind: 'lines', weight: 2.0 },
    ],
  },
  {
    key: 'v-major',
    name: '专业综合（机械类）',
    hint: '职教高考 · 机械专业理论',
    spec: '客观 20 题 · 填空 10 · 简答 2 · 综合 2',
    fullScore: 200,
    paperSize: 'A3',
    objective: {
      groups: [
        { title: '一、选择题（每小题 3 分，共 60 分）', count: 20, score: 3 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、填空题（每空 2 分，共 30 分）', kind: 'list', weight: 1.0, items: [1,1,1,1,1,1,1,1,1,1], startNumber: 21 },
      { label: '三、简答题 31（20 分）', kind: 'lines', weight: 1.6 },
      { label: '32（20 分）', kind: 'lines', weight: 1.6 },
      { label: '四、综合应用题 33（35 分）', kind: 'lines', weight: 2.2 },
      { label: '34（35 分）', kind: 'lines', weight: 2.2 },
    ],
  },
  {
    key: 'v-elec',
    name: '专业综合（电工电子类）',
    hint: '职教高考 · 电工电子专业理论',
    spec: '客观 20 题 · 填空 10 · 简答 2 · 综合 2',
    fullScore: 200,
    paperSize: 'A3',
    objective: {
      groups: [
        { title: '一、选择题（每小题 3 分，共 60 分）', count: 20, score: 3 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、填空题（每空 2 分，共 30 分）', kind: 'list', weight: 1.0, items: [1,1,1,1,1,1,1,1,1,1], startNumber: 21 },
      { label: '三、简答题 31（20 分）', kind: 'lines', weight: 1.6 },
      { label: '32（20 分）', kind: 'lines', weight: 1.6 },
      { label: '四、综合分析题 33（35 分）', kind: 'lines', weight: 2.2 },
      { label: '34（35 分）', kind: 'lines', weight: 2.2 },
    ],
  },
  {
    key: 'v-cs',
    name: '专业综合（计算机类）',
    hint: '职教高考 · 计算机专业理论',
    spec: '客观 20 题 · 填空 10 · 简答 2 · 编程 2',
    fullScore: 200,
    paperSize: 'A3',
    objective: {
      groups: [
        { title: '一、选择题（每小题 3 分，共 60 分）', count: 20, score: 3 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、填空题（每空 2 分，共 30 分）', kind: 'list', weight: 1.0, items: [1,1,1,1,1,1,1,1,1,1], startNumber: 21 },
      { label: '三、简答题 31（20 分）', kind: 'lines', weight: 1.6 },
      { label: '32（20 分）', kind: 'lines', weight: 1.6 },
      { label: '四、程序设计题 33（35 分）', kind: 'lines', weight: 2.2 },
      { label: '34（35 分）', kind: 'lines', weight: 2.2 },
    ],
  },
  {
    key: 'v-nurse',
    name: '专业综合（护理类）',
    hint: '职教高考 · 护理专业理论',
    spec: '客观 20 题 · 填空 10 · 简答 2 · 案例分析 2',
    fullScore: 200,
    paperSize: 'A3',
    objective: {
      groups: [
        { title: '一、选择题（每小题 3 分，共 60 分）', count: 20, score: 3 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、填空题（每空 2 分，共 30 分）', kind: 'list', weight: 1.0, items: [1,1,1,1,1,1,1,1,1,1], startNumber: 21 },
      { label: '三、简答题 31（20 分）', kind: 'lines', weight: 1.6 },
      { label: '32（20 分）', kind: 'lines', weight: 1.6 },
      { label: '四、案例分析 33（35 分）', kind: 'lines', weight: 2.2 },
      { label: '34（35 分）', kind: 'lines', weight: 2.2 },
    ],
  },
  {
    key: 'v-fin',
    name: '专业综合（财经类）',
    hint: '职教高考 · 财经专业理论',
    spec: '客观 20 题 · 填空 10 · 简答 2 · 业务题 2',
    fullScore: 200,
    paperSize: 'A3',
    objective: {
      groups: [
        { title: '一、选择题（每小题 3 分，共 60 分）', count: 20, score: 3 },
      ],
      options: ['A', 'B', 'C', 'D'],
      score: 3,
    },
    blocks: [
      { label: '二、填空题（每空 2 分，共 30 分）', kind: 'list', weight: 1.0, items: [1,1,1,1,1,1,1,1,1,1], startNumber: 21 },
      { label: '三、简答题 31（20 分）', kind: 'lines', weight: 1.6 },
      { label: '32（20 分）', kind: 'lines', weight: 1.6 },
      { label: '四、业务核算题 33（35 分）', kind: 'lines', weight: 2.2 },
      { label: '34（35 分）', kind: 'lines', weight: 2.2 },
    ],
  },
]

/* ================= 组装 ================= */

export const GAOKAO_SUBJECTS: SubjectMeta[] = GAOKAO
export const VOCATIONAL_SUBJECTS: SubjectMeta[] = VOCATIONAL
/** 兼容旧引用：默认取普高 */
export const SUBJECTS = GAOKAO_SUBJECTS

export function subjectsOf(examType: ExamType): SubjectMeta[] {
  return examType === 'vocational' ? VOCATIONAL_SUBJECTS : GAOKAO_SUBJECTS
}

export function subjectOf(key: SubjectKey, examType: ExamType = 'gaokao') {
  const list = subjectsOf(examType)
  return list.find((s) => s.key === key) ?? list[0]
}

/* ================= 统一排版 ================= */

export function buildTemplate(key: SubjectKey, size?: PaperSize, examType: ExamType = 'gaokao'): PaperDesign {
  const meta = subjectOf(key, examType)
  return buildFromMeta(meta, size ?? meta.paperSize)
}

/** 精简版 / 加强版就是改 meta 再调这里 */
export function buildFromMeta(meta: SubjectMeta, size: PaperSize = 'A4'): PaperDesign {
  const orient = defaultOrientation(size)
  const design = emptyDesign(size, orient)
  design.front.side = 'front'
  design.back.side = 'back'

  const c = canvasOf(size, orient)
  const landscape = c.w > c.h
  const M = Math.round(c.h * 0.045)
  const inner = c.w - M * 2
  const colCount = landscape ? 3 : 1
  const colGap = landscape ? 12 : 0
  const colW = Math.round((inner - colGap * (colCount - 1)) / colCount)
  const base = colW / 280

  const F = {
    bigNo: Math.round(22 * base),     // 左上角大页码
    red: Math.round(7.6 * base),      // 红色考试名
    title: Math.round(15 * base),     // 数学答题卡
    body: Math.round(6.4 * base),     // 正文
    sec: Math.round(7.6 * base),      // 大题标题
    band: Math.round(7.4 * base),     // 卷别横条
    foot: Math.round(5.4 * base),     // 页脚
  }
  const rowH = Math.round(F.body * 2.7)
  const gapY = Math.round(5 * base)
  const footerH = Math.round(F.foot * 4.2)
  const secH = Math.round(F.sec * 1.9)

  const colX = (i: number) => M + i * (colW + colGap)

  type Slot = { page: 0 | 1; col: number; y: number; end: number }
  const slots: Slot[] = []
  for (const page of [0, 1] as const) {
    for (let i = 0; i < colCount; i += 1) {
      slots.push({ page, col: i, y: M, end: c.h - M - footerH - gapY })
    }
  }
  let si = 0
  const pages: PaperElement[][] = [[], []]
  const room = () => slots[si].end - slots[si].y
  const nextSlot = () => {
    if (si < slots.length - 1) {
      si += 1
      return true
    }
    return false
  }

  const put = (el: PaperElement, h = el.h): boolean => {
    for (;;) {
      const s0 = slots[si]
      if (s0.y + h <= s0.end) {
        el.x = colX(s0.col)
        el.y = s0.y
        el.w = colW
        el.h = h
        pages[s0.page].push(el)
        s0.y += h + gapY
        return true
      }
      if (!nextSlot()) return false
    }
  }

  /* ================= 表头（所有科目完全一致） ================= */
  const mkSize = Math.round(Math.min(c.w, c.h) * 0.032)
  const markers: PaperElement = {
    id: uid('mk'),
    kind: 'markers',
    x: 0,
    y: 0,
    w: c.w,
    h: c.h,
    size: mkSize,
    inset: { x: Math.round(M * 0.5), y: Math.round(M * 0.5) },
  }

  const header = (suffix: string, isBack: boolean, pageNo = 1) => {
    if (isBack) {
      put({
        id: uid('info'),
        kind: 'studentInfo',
        x: 0, y: 0, w: 0,
        h: Math.round(F.body * 3),
        fields: ['姓名', '准考证号'],
        columns: 2,
        fontSize: F.body,
        boxed: false,
      })
      return
    }

    // 左上角大页码
    put({
      id: uid('pno'),
      kind: 'title',
      x: 0, y: 0, w: 0,
      h: Math.round(F.bigNo * 1.5),
      text: String(pageNo),
      fontSize: F.bigNo,
      bold: true,
      align: 'left',
      lineHeight: 1.1,
    })

    // 红色考试名
    put({
      id: uid('red'),
      kind: 'title',
      x: 0, y: 0, w: 0,
      h: Math.round(F.red * 2.1),
      text: '普通高等学校招生全国统一考试',
      fontSize: F.red,
      bold: true,
      align: 'center',
      lineHeight: 1.3,
      color: '#c0392b',
    })

    // 科目名
    put({
      id: uid('title'),
      kind: 'title',
      x: 0, y: 0, w: 0,
      h: Math.round(F.title * 1.7),
      text: `${meta.name} 答 题 卡${suffix}`,
      fontSize: F.title,
      bold: true,
      align: 'center',
      lineHeight: 1.25,
    })

    // 姓名 / 座号 一行
    put({
      id: uid('info'),
      kind: 'studentInfo',
      x: 0, y: 0, w: 0,
      h: Math.round(F.body * 3.4),
      fields: ['姓名', '座号'],
      columns: 2,
      fontSize: F.body,
      boxed: false,
    })

    // 考生号方格 + 虚线条形码框 并排
    {
      const s0 = slots[si]
      const noH = Math.round(F.body * 4.2)
      const bcW = Math.round(colW * 0.34)
      const bcH = Math.round(noH * 2.2)
      const noW = colW - bcW - gapY
      pages[s0.page].push({
        id: uid('no'),
        kind: 'examNo',
        x: colX(s0.col),
        y: s0.y,
        w: noW,
        h: noH,
        label: '考生号',
        digits: 12,
        fontSize: F.body,
      })
      pages[s0.page].push({
        id: uid('bc'),
        kind: 'barcode',
        x: colX(s0.col) + noW + gapY,
        y: s0.y,
        w: bcW,
        h: bcH,
        label: '贴条形码区',
        rotate: 0,
        vertical: false,
        dashed: true,
        note: '由监考员负责粘贴',
      })
      s0.y += Math.max(noH, bcH) + gapY
    }

    // 注意事项：红框 + 左侧竖排 + 6 条
    put({
      id: uid('notice'),
      kind: 'notice',
      x: 0, y: 0, w: 0,
      h: Math.round(6 * F.body * 2.05 + F.body * 2),
      text:
        '1．答题前，考生先将自己的姓名、考生号填写清楚，并核对条形码信息。\n' +
        '2．选择题必须使用 2B 铅笔按题号填涂，修改时用橡皮擦干净。\n' +
        '3．非选择题必须使用 0.5 毫米黑色签字笔书写，字体工整、笔迹清楚。\n' +
        '4．请按题号在各题的答题区域内作答，超出答题区域书写的答案无效。\n' +
        '5．保持卡面清洁，不要折叠、不要弄破，严禁在卡面作任何标记。\n' +
        '6．严禁在条形码和定位点（黑方块）周围做任何涂写和标记。',
      fontSize: F.body,
      align: 'left',
      lineHeight: 2.05,
      sideLabel: '注意事项',
    })

    // 填涂样例（真卡在注意事项框内右下角，这里单独一行贴着）
    put({
      id: uid('legend'),
      kind: 'legend',
      x: 0, y: 0, w: 0,
      h: Math.round(F.body * 2.6),
      fontSize: F.body,
    })

    // 考生须填涂
    put({
      id: uid('ban'),
      kind: 'forbidden',
      x: 0, y: 0, w: 0,
      h: Math.round(F.body * 3.2),
      fontSize: F.body,
      frame: 'red',
    })
  }

  header('', false)

  /* ================= 客观题 ================= */
  const objCols = 2
  const maxRows = 6

  const band = (text: string) =>
    put({
      id: uid('band'),
      kind: 'subtitle',
      x: 0, y: 0, w: 0,
      h: Math.round(F.band * 2.3),
      text,
      fontSize: F.band,
      bold: true,
      align: 'center',
      lineHeight: 1.25,
      fill: '#2b2f35',
      invert: true,
    })

  band('第Ⅰ卷（选择题　用 2B 铅笔填涂）')

  let cursorNo = 1
  for (const g of meta.objective.groups) {
    const blocks = Math.max(1, Math.ceil(g.count / (objCols * maxRows)))
    const rowsPerBlock = Math.min(maxRows, Math.ceil(g.count / (objCols * blocks)))
    put({
      id: uid('sec'),
      kind: 'subtitle',
      x: 0, y: 0, w: 0,
      h: secH,
      text: g.title,
      fontSize: F.sec,
      bold: true,
      align: 'left',
    })
    put({
      id: uid('obj'),
      kind: 'objective',
      x: 0, y: 0, w: 0,
      h: Math.round(10 + blocks * rowsPerBlock * rowH + (blocks - 1) * F.body * 1.2),
      rows: rowsPerBlock,
      cols: objCols,
      blocks,
      count: g.count,
      options: g.options ?? meta.objective.options,
      startNumber: cursorNo,
      fontSize: F.body,
      score: g.score ?? meta.objective.score,
      markStyle: 'bracket',
    })
    cursorNo += g.count
  }

  /* ================= 主观题 ================= */
  if (cursorNo > 1) {
    band('第Ⅱ卷（非选择题　用 0.5mm 黑色签字笔书写）')
    // 真卡的阅卷得分表就在非选择题区开头
    put({
      id: uid('score'),
      kind: 'scoreBox',
      x: 0, y: 0, w: 0,
      h: Math.round(F.body * 3.2),
      count: Math.min(12, meta.blocks.length + 2),
      fontSize: Math.round(F.body * 0.84),
    })
  }
  const needBackHeader = true
  let backHeaderDone = false

  for (const b of meta.blocks) {
    if (room() < secH + rowH * 3 + gapY && !nextSlot()) break

    // 刚跨到反面时，先在反面顶部补一行考生信息
    if (needBackHeader && !backHeaderDone && slots[si].page === 1) {
      header('', true)
      backHeaderDone = true
    }

    put({
      id: uid('sec'),
      kind: 'subtitle',
      x: 0, y: 0, w: 0,
      h: secH,
      text: b.label,
      fontSize: F.sec,
      bold: true,
      align: 'left',
    })

    if (b.kind === 'list' && b.items?.length) {
      const need = b.items.reduce((a, n) => a + n, 0) * rowH + 8
      put({
        id: uid('list'),
        kind: 'questionList',
        x: 0, y: 0, w: 0,
        h: Math.min(need, Math.max(rowH * 6, room())),
        startNumber: b.startNumber ?? 1,
        items: b.items,
        fontSize: F.body,
        rowHeight: rowH,
      })
      continue
    }

    if (b.kind === 'grid') {
      const gridCols = b.cols ?? 20
      const cell = Math.round(colW / gridCols)
      const rowsFit = Math.max(4, Math.floor((room() - cell) / cell))
      put({
        id: uid('grid'),
        kind: 'gridPaper',
        x: 0, y: 0, w: 0,
        h: (rowsFit + 1) * cell,
        cols: gridCols,
        cell,
        topicLine: true,
      })
      continue
    }

    const available = room()
    const wanted = Math.round(available / rowH)
    const rows = Math.max(3, Math.min(wanted, Math.round(20 * b.weight)))
    const ok = put({
      id: uid('area'),
      kind: 'subjective',
      x: 0, y: 0, w: 0,
      h: rows * rowH,
      label: '',
      rows,
      rowHeight: rowH,
      prompt: '解：',
      ruled: false,
      frame: 'red',
    })
    if (!ok) break
  }

  /* ================= 页脚 ================= */
  const totalPages = colCount * 2
  for (let page = 0; page < 2; page += 1) {
    for (let i = 0; i < colCount; i += 1) {
      const no = page * colCount + i + 1
      pages[page].push({
        id: uid('foot'),
        kind: 'notice',
        x: colX(i),
        y: c.h - M - footerH,
        w: colW,
        h: footerH,
        text: `请在各题目的答题区域内作答，超出黑色矩形边框限定区域的答案无效\n${meta.name}　第 ${no} 页 共 ${totalPages} 页`,
        fontSize: F.foot,
        align: 'center',
        lineHeight: 1.35,
      })
    }
  }

  design.front.elements = [markers, ...pages[0]]
  design.back.elements = pages[1]
  return design
}

export function objectiveCountOf(key: SubjectKey, examType: ExamType = 'gaokao') {
  return subjectOf(key, examType).objective.groups.reduce((s, g) => s + g.count, 0)
}
