/**
 * 答题卡文档 / 自制模板的本机存储与后端落库。
 *
 * - 文档草稿：按 papers.id 存 localStorage，刷新/断网都不丢
 * - 自制模板：把完整的 CardSpec 存本机，模板工坊可直接复用
 * - 保存到后端：PUT /api/v1/papers/{id} 只提交标准 v1 JSON（无任何扩展字段）
 */
import { papersApi } from '../../m/api'
import type { ExamContent } from '../../api/types'
import { docFromContent, generateCard } from './generator'
import { CARD_TEMPLATES, matchTemplateByName, type CardTemplate } from './catalog'
import { cloneDoc, cloneContent, validateCard, type CardDoc, type CardIssue, type CardSpec } from './types'

const DOC_KEY = (id: number) => `ac.carddoc.v3.${id}`
const TPL_KEY = 'ac.card.templates.v1'
const LAST_SPEC = 'ac.card.lastSpec.v1'

export function readDoc(id: number): CardDoc | null {
  try {
    const raw = localStorage.getItem(DOC_KEY(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CardDoc
    if (!parsed || parsed.version !== 3 || !parsed.content) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDoc(id: number, doc: CardDoc): boolean {
  try {
    localStorage.setItem(DOC_KEY(id), JSON.stringify(doc))
    return true
  } catch {
    return false
  }
}

export function clearDoc(id: number) {
  try {
    localStorage.removeItem(DOC_KEY(id))
  } catch {
    /* ignore */
  }
}

/** 文档 + 后端内容合并：本地草稿优先，其次按内容还原 */
export function resolveDoc(id: number, content: ExamContent | undefined, name: string): { doc: CardDoc; source: 'local' | 'remote' } {
  const local = readDoc(id)
  if (local && local.content) return { doc: local, source: 'local' }
  if (content && content.canvas) {
    return { doc: docFromContent(content, name), source: 'remote' }
  }
  const tpl = CARD_TEMPLATES.find((t) => t.subject !== '通用') ?? CARD_TEMPLATES[0]
  const generated = generateCard(tpl.spec)
  const doc = cloneDoc(generated.doc)
  doc.meta.title = name || doc.meta.title
  return { doc, source: 'remote' }
}

/** 只保留标准 v1 字段，避免后端白名单校验 400 */
export function contentForBackend(doc: CardDoc): ExamContent {
  const c = cloneContent(doc.content)
  return {
    schemaVersion: 1,
    unit: 'canvas',
    canvas: c.canvas,
    markers: c.markers,
    blocks: c.blocks ?? [],
    questions: (c.questions ?? []).map((q) => ({
      id: q.id,
      displayNumber: q.displayNumber,
      type: q.type === 'subjective' ? 'subjective' : 'mark',
      score: q.score,
      region: q.region,
      ...(q.type === 'subjective' ? {} : { choices: q.choices ?? [] }),
    })),
    ...(c.barcode ? { barcode: c.barcode } : {}),
    ...(doc.barcodes?.[0]
      ? {
          barcode: {
            id: doc.barcodes[0].id,
            type: 'code128' as const,
            value: doc.barcodes[0].value,
            anchor: 'top-left' as const,
            offset: { unit: 'canvas' as const, x: doc.barcodes[0].region.x, y: doc.barcodes[0].region.y },
            size: {
              unit: 'canvas' as const,
              width: doc.barcodes[0].region.width,
              height: doc.barcodes[0].region.height,
            },
          },
        }
      : {}),
    answerKey: c.answerKey ?? {},
  }
}

export interface SaveResult {
  id: number
  doc: CardDoc
  issues: CardIssue[]
}

/** 新建试卷并保存内容 */
export async function createPaperFromDoc(doc: CardDoc, name: string): Promise<SaveResult> {
  const issues = validateCard(doc)
  const errors = issues.filter((i) => i.level === 'error')
  if (errors.length) throw new Error(`答题卡还有 ${errors.length} 个问题：${errors[0].message}`)
  const created = await papersApi.create(name)
  const next: CardDoc = { ...cloneDoc(doc), updatedAt: Date.now() }
  next.meta.templateName = next.meta.templateName ?? name
  await papersApi.update(created.id, contentForBackend(next))
  if (next.content.answerKey && Object.keys(next.content.answerKey).length) {
    await papersApi.setAnswers(created.id, next.content.answerKey as Record<string, string>)
  }
  writeDoc(created.id, next)
  return { id: created.id, doc: next, issues }
}

/** 保存（覆盖）已有试卷 */
export async function savePaperDoc(id: number, doc: CardDoc): Promise<SaveResult> {
  const issues = validateCard(doc)
  const errors = issues.filter((i) => i.level === 'error')
  if (errors.length) throw new Error(`答题卡还有 ${errors.length} 个问题：${errors[0].message}`)
  const next: CardDoc = { ...cloneDoc(doc), updatedAt: Date.now() }
  await papersApi.update(id, contentForBackend(next))
  if (next.content.answerKey && Object.keys(next.content.answerKey).length) {
    await papersApi.setAnswers(id, next.content.answerKey as Record<string, string>)
  }
  writeDoc(id, next)
  return { id, doc: next, issues }
}

/* ---------------- 自制模板 ---------------- */

export interface CustomTemplate {
  id: string
  name: string
  spec: CardSpec
  createdAt: number
}

export function listCustomTemplates(): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(TPL_KEY)
    const list = raw ? (JSON.parse(raw) as CustomTemplate[]) : []
    return Array.isArray(list) ? list.sort((a, b) => b.createdAt - a.createdAt) : []
  } catch {
    return []
  }
}

export function saveCustomTemplate(name: string, spec: CardSpec): CustomTemplate {
  const list = listCustomTemplates()
  const item: CustomTemplate = {
    id: `custom-${Date.now().toString(36)}`,
    name: name.trim() || spec.name || '自定义模板',
    spec: { ...spec, name: name.trim() || spec.name },
    createdAt: Date.now(),
  }
  localStorage.setItem(TPL_KEY, JSON.stringify([item, ...list].slice(0, 60)))
  return item
}

export function removeCustomTemplate(id: string) {
  localStorage.setItem(TPL_KEY, JSON.stringify(listCustomTemplates().filter((t) => t.id !== id)))
}

/* ---------------- 最近一次生成参数 ---------------- */

export function saveLastSpec(spec: CardSpec) {
  try {
    localStorage.setItem(LAST_SPEC, JSON.stringify(spec))
  } catch {
    /* ignore */
  }
}

export function readLastSpec(): CardSpec | null {
  try {
    const raw = localStorage.getItem(LAST_SPEC)
    return raw ? (JSON.parse(raw) as CardSpec) : null
  } catch {
    return null
  }
}

/* ---------------- 内置模板 / 后端模板 ---------------- */

export function specFromTemplate(t: CardTemplate): CardSpec {
  return { ...t.spec, name: t.name }
}

/** 后端模板 → 渲染文档；能被内置目录匹配上的，优先用内置规格重新出一版更整齐的卡 */
export function docFromRemoteTemplate(
  name: string,
  content: ExamContent | Record<string, never>,
  size: 'A4' | 'A3' = 'A4',
): CardDoc {
  const matched = matchTemplateByName(name)
  const hasContent = content && typeof content === 'object' && 'canvas' in content && (content as ExamContent).questions?.length
  if (hasContent) {
    return docFromContent(content as ExamContent, name)
  }
  if (matched) {
    const generated = generateCard({ ...matched.spec, paperSize: size, orientation: size === 'A3' ? 'landscape' : 'portrait' })
    const doc = cloneDoc(generated.doc)
    doc.meta.title = name
    doc.meta.templateName = name
    return doc
  }
  const fallback = CARD_TEMPLATES.find((t) => t.size === size) ?? CARD_TEMPLATES[0]
  return cloneDoc(generateCard(fallback.spec).doc)
}

/* ---------------- 无后端时的本地跳转 ---------------- */

const STASH_DOC = 'ac.card.stash.doc'
const STASH_SPEC = 'ac.card.stash.spec'
const LOCAL_DOC = 'ac.card.local.doc'

export function stashDoc(doc: CardDoc, spec?: CardSpec) {
  try {
    sessionStorage.setItem(STASH_DOC, JSON.stringify(doc))
    if (spec) sessionStorage.setItem(STASH_SPEC, JSON.stringify(spec))
  } catch {
    /* ignore */
  }
}

export function takeStashedDoc(): CardDoc | null {
  try {
    const raw = sessionStorage.getItem(STASH_DOC)
    return raw ? (JSON.parse(raw) as CardDoc) : null
  } catch {
    return null
  }
}

export function takeStashedSpec(): CardSpec | null {
  try {
    const raw = sessionStorage.getItem(STASH_SPEC)
    return raw ? (JSON.parse(raw) as CardSpec) : null
  } catch {
    return null
  }
}

export function saveLocalDoc(doc: CardDoc): boolean {
  try {
    localStorage.setItem(LOCAL_DOC, JSON.stringify(doc))
    return true
  } catch {
    return false
  }
}

export function readLocalDoc(): CardDoc | null {
  try {
    const raw = localStorage.getItem(LOCAL_DOC)
    return raw ? (JSON.parse(raw) as CardDoc) : null
  } catch {
    return null
  }
}
