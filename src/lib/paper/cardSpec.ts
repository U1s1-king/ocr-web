import type { CardSpec, ObjectiveGroupSpec, SubjectiveGroupSpec } from '../card/types'
import type { PaperBundle } from './types'
import { questionsOfSection, sectionTotalScore } from './types'

/**
 * 统一试卷 → 答题卡生成配置。
 * 答题卡题量完全由 questions[] 派生，不再单独维护 count。
 */
export function bundleToCardSpec(bundle: PaperBundle): CardSpec {
  const page = bundle.answerCard.pages[0]
  const paperSize = page?.paperSize === 'A3' ? 'A3' : 'A4'
  const orientation = page?.orientation ?? 'portrait'
  const objectiveGroups: ObjectiveGroupSpec[] = []
  const subjectiveGroups: SubjectiveGroupSpec[] = []

  for (const section of bundle.sections) {
    const qs = questionsOfSection(bundle, section.id)
    const mark = qs.filter((q) => q.answerCard.type === 'mark')
    const subj = qs.filter((q) => q.answerCard.type === 'subjective')

    if (mark.length) {
      const first = mark[0]
      objectiveGroups.push({
        title: section.title,
        count: mark.length,
        score: Math.round((sectionTotalScore(bundle, section.id) / Math.max(1, mark.length)) * 10) / 10,
        options: first.options.length
          ? first.options.map((o) => o.key)
          : first.answerCard.choices?.map((c) => c.value) ?? ['A', 'B', 'C', 'D'],
      })
    }

    if (subj.length) {
      const first = subj[0]
      const style = first.answerCard.render?.style ?? 'lines'
      const items = subj.map((q) => ({
        label: undefined,
        rows: q.answerCard.render?.rows ?? 6,
        score: q.score,
      }))
      subjectiveGroups.push({
        title: section.title,
        style,
        gridCols: first.answerCard.render?.gridCols,
        items,
      })
    }
  }

  return {
    name: bundle.meta.title,
    title: bundle.meta.title,
    subtitle: `${bundle.meta.subject} 答题卡`,
    system: '普高',
    subject: bundle.meta.subject,
    paperSize,
    orientation,
    objectiveGroups,
    subjectiveGroups,
    studentFields: ['姓名', '准考证号', '考场号', '座位号'],
    notes: '1. 答题前，请将姓名、准考证号填写清楚。\n2. 选择题必须使用 2B 铅笔填涂；非选择题必须使用 0.5mm 黑色签字笔书写。\n3. 请按题号在各题答题区域内作答，超出答题区域书写的答案无效。',
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
