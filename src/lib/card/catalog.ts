/**
 * 答题卡模板目录：在普高 / 职教 / 中考三套命题规格上，
 * 自动展开成多纸型、多密度的模板，供「模板工坊」一键出卡。
 */
import {
  GAOKAO_SUBJECTS,
  VOCATIONAL_SUBJECTS,
  type SectionSpec,
  type SubjectMeta,
} from '../paperTemplates'
import type {
  CardSpec,
  ObjectiveGroupSpec,
  PaperSize,
  SubjectiveGroupSpec,
  SubjectiveItemSpec,
} from './types'

export type CardFamily = 'gaokao' | 'vocational' | 'zhongkao' | 'generic'

export interface CardTemplate {
  id: string
  name: string
  system: CardFamily
  systemLabel: string
  subject: string
  size: PaperSize
  /** 展示用标签 */
  variant: string
  hint: string
  /** 满分 */
  fullScore: number
  spec: CardSpec
}

const FAMILY_LABEL: Record<CardFamily, string> = {
  gaokao: '普高',
  vocational: '职教',
  zhongkao: '中考',
  generic: '通用',
}

const VARIANT_LABEL: Record<string, string> = { standard: '标准版', compact: '紧凑版', loose: '宽松版', blank: '空白版' }

/* ---------------- 分值解析 ---------------- */

/** 「每小题 5 分」 */
function parsePerScore(label: string): number | null {
  const m = label.match(/每小题\s*(\d+(?:\.\d+)?)\s*分/)
  return m ? Number(m[1]) : null
}

/** 「共 20 分」 或 「（16 分）」 */
function parseTotalScore(label: string): number | null {
  const total = label.match(/共\s*(\d+(?:\.\d+)?)\s*分/)
  if (total) return Number(total[1])
  const m = label.match(/[（(](\d+(?:\.\d+)?)\s*分[）)]/)
  return m ? Number(m[1]) : null
}

/* ---------------- 规格转换 ---------------- */

interface Transform {
  countScale?: number
  rowScale?: number
  familyLabel: string
  title: string
}

function objectiveGroupsOf(meta: SubjectMeta, t: Transform): ObjectiveGroupSpec[] {
  return meta.objective.groups.map((g) => ({
    title: g.title,
    count: Math.max(1, Math.round(g.count * (t.countScale ?? 1))),
    score: g.score ?? meta.objective.score,
    options: g.options ?? meta.objective.options,
  }))
}

function objectiveTotal(meta: SubjectMeta): number {
  return meta.objective.groups.reduce((sum, g) => sum + g.count * (g.score ?? meta.objective.score), 0)
}

function subjectiveGroupsOf(meta: SubjectMeta, t: Transform): SubjectiveGroupSpec[] {
  const groups: SubjectiveGroupSpec[] = []
  const sections = meta.blocks as SectionSpec[]
  const defaultScore = Math.max(1, Math.round((meta.fullScore - objectiveTotal(meta)) / Math.max(1, sections.length)))

  for (const sec of sections) {
    const perScore = parsePerScore(sec.label)
    const totalScore = parseTotalScore(sec.label)
    const score = totalScore ?? perScore ?? defaultScore
    const rowScale = t.rowScale ?? 1

    if (sec.kind === 'list') {
      const items = (sec.items ?? [1]) as number[]
      const per = perScore ?? Math.max(0.5, Math.round(((totalScore ?? score) / items.length) * 10) / 10)
      groups.push({
        title: sec.label,
        style: 'lines',
        items: items.map<SubjectiveItemSpec>((rows) => ({
          rows: Math.max(1, Math.round(rows * rowScale)),
          score: per,
        })),
      })
      continue
    }
    if (sec.kind === 'grid') {
      groups.push({
        title: sec.label,
        style: 'grid',
        gridCols: sec.cols ?? 20,
        items: [{ rows: rowsOf(sec, rowScale), score: score }],
      })
      continue
    }
    groups.push({
      title: sec.label,
      style: 'lines',
      items: [{ rows: rowsOf(sec, rowScale), score: score }],
    })
  }
  return groups
}

function rowsOf(sec: SectionSpec, rowScale = 1): number {
  return Math.max(2, Math.min(22, Math.round((sec.weight ?? 1) * 6 * rowScale)))
}

function specFromMeta(
  meta: SubjectMeta,
  family: CardFamily,
  size: PaperSize,
  variantKey: string,
  t: Transform,
): CardSpec {
  return {
    name: `${FAMILY_LABEL[family]}-${meta.name}-${size}-${VARIANT_LABEL[variantKey] ?? variantKey}`,
    title: t.title,
    subtitle: `${meta.name} 答 题 卡`,
    system: t.familyLabel,
    subject: meta.name,
    paperSize: size,
    orientation: size === 'A3' ? 'landscape' : 'portrait',
    objectiveGroups: objectiveGroupsOf(meta, t),
    subjectiveGroups: subjectiveGroupsOf(meta, t),
    studentFields: ['姓名', '准考证号', '考场号', '座位号'],
    notes:
      '1. 答题前，请将姓名、准考证号填写清楚，并核对条形码上的信息。\n' +
      '2. 选择题必须使用 2B 铅笔填涂；非选择题必须使用 0.5mm 黑色签字笔书写。\n' +
      '3. 请按题号在各题答题区域内作答，超出答题区域书写的答案无效。\n' +
      '4. 保持卡面清洁，不要折叠、不要弄破。',
    showBarcode: true,
    showLegend: true,
    showNotice: true,
    showStudent: true,
    footer: '超出黑色矩形边框限定区域的答案无效',
    gaokao: true,
    examNoDigits: 12,
    showPaperType: true,
    showAbsent: true,
  }
}

function pushTemplates(
  out: CardTemplate[],
  metas: SubjectMeta[],
  family: CardFamily,
  title: string,
  countScale = 1,
  rowScale = 1,
) {
  for (const meta of metas) {
    const standard = meta.paperSize
    const sizes: PaperSize[] = standard === 'A3' ? ['A3', 'A4'] : ['A4', 'A3']
    sizes.forEach((size, i) => {
      const variantKey = i === 0 ? 'standard' : standard === 'A3' ? 'compact' : 'loose'
      out.push({
        id: `${FAMILY_LABEL[family]}-${meta.key}-${size}-${variantKey}`,
        name: `${FAMILY_LABEL[family]}-${meta.name}-${size}-${VARIANT_LABEL[variantKey]}`,
        system: family,
        systemLabel: FAMILY_LABEL[family],
        subject: meta.name,
        size,
        variant: VARIANT_LABEL[variantKey],
        hint: `${meta.hint} · ${meta.spec}`,
        fullScore: meta.fullScore,
        spec: specFromMeta(meta, family, size, variantKey, {
          countScale,
          rowScale,
          familyLabel: FAMILY_LABEL[family],
          title,
        }),
      })
    })
  }
}

/* ---------------- 组装 ---------------- */

function genericTemplates(): CardTemplate[] {
  const base = (size: PaperSize, name: string, id: string): CardTemplate => ({
    id,
    name,
    system: 'generic',
    systemLabel: '通用',
    subject: '通用',
    size,
    variant: VARIANT_LABEL.blank,
    hint: '空白答题卡骨架：定位块 + 表头 + 条形码，题量可自由添加',
    fullScore: 100,
    spec: {
      name,
      title: '考试名称（可编辑）',
      subtitle: '通 用 答 题 卡',
      system: '通用',
      subject: '通用',
      paperSize: size,
      orientation: size === 'A3' ? 'landscape' : 'portrait',
      objectiveGroups: [],
      subjectiveGroups: [],
      studentFields: ['姓名', '准考证号', '班级', '座位号'],
      notes:
        '1. 本卡为空白模板，可在「精调」里添加选择题与主观题。\n' +
        '2. 选择题用 2B 铅笔填涂；主观题用 0.5mm 黑色签字笔作答。\n' +
        '3. 答题前请先核对定位块是否完整印刷。',
      showBarcode: true,
      showLegend: true,
      showNotice: true,
      showStudent: true,
      footer: '超出矩形边框限定区域的答案无效',
    },
  })
  return [base('A4', '通用-A4-空白答题卡', '通用-generic-A4-blank'), base('A3', '通用-A3-空白答题卡', '通用-generic-A3-blank')]
}

function buildAll(): CardTemplate[] {
  const out: CardTemplate[] = []
  pushTemplates(out, GAOKAO_SUBJECTS, 'gaokao', '普通高等学校招生全国统一考试')
  pushTemplates(out, VOCATIONAL_SUBJECTS, 'vocational', '职业技术教育高考（对口升学）')
  // 中考：题量比高考略少、作答区略窄，标题单独一套
  pushTemplates(out, GAOKAO_SUBJECTS, 'zhongkao', '初中学业水平考试', 0.82, 0.78)
  out.push(...genericTemplates())
  return out
}

export const CARD_TEMPLATES: CardTemplate[] = buildAll()

export const CATALOG_SUBJECTS = ['全部', ...Array.from(new Set(CARD_TEMPLATES.map((t) => t.subject)))]
export const CATALOG_SYSTEMS = ['全部', '普高', '职教', '中考', '通用']
export const CATALOG_SIZES = ['全部', 'A4', 'A3']

export function templateById(id: string): CardTemplate | null {
  return CARD_TEMPLATES.find((t) => t.id === id) ?? null
}

/** 按名称模糊找模板（后端模板名遵循 体系-科目-纸型-版本） */
export function matchTemplateByName(name: string): CardTemplate | null {
  if (!name) return null
  const n = name.replace(/\s+/g, '')
  const hit = CARD_TEMPLATES.find((t) => t.name.replace(/\s+/g, '') === n)
  if (hit) return hit
  const parts = n.split('-')
  if (parts.length >= 3) {
    const size = parts.find((p) => p === 'A3' || p === 'A4')
    const systemLabel = parts[0]
    const subjectKey = parts[1]
    return (
      CARD_TEMPLATES.find(
        (t) =>
          (!size || t.size === size) &&
          (t.systemLabel === systemLabel || t.system === systemLabel) &&
          (t.subject.includes(subjectKey) || subjectKey.includes(t.subject.replace(/\s/g, ''))),
      ) ?? null
    )
  }
  return CARD_TEMPLATES.find((t) => n.includes(t.subject) && t.subject !== '通用') ?? null
}

/** 把模板规格复制一份并改纸型，供「换纸型重新排版」 */
export function respecSize(spec: CardSpec, size: PaperSize): CardSpec {
  return {
    ...spec,
    paperSize: size,
    orientation: size === 'A3' ? 'landscape' : 'portrait',
  }
}
