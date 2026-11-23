import type { PaperV2, PaperV2Page, PaperV2Question } from '../../api/typesV2'
import type { PaperBundle, PaperCardPage, PaperQuestion, PaperSection } from './types'

const sideOf = (index: number): 'front' | 'back' => (index === 0 ? 'front' : 'back')

function pageSizeOf(page: PaperV2Page): 'A4' | 'A3' {
  return page.canvas.width >= 380 ? 'A3' : 'A4'
}

function orientationOf(page: PaperV2Page): 'portrait' | 'landscape' {
  return page.canvas.width > page.canvas.height ? 'landscape' : 'portrait'
}

/**
 * 后端 v2 → 前端统一试卷模型。
 * 用于把后端真实试卷直接带入「统一试卷预览 / 打印 / 生成答题卡」。
 */
export function paperV2ToBundle(detail: { id: number; name: string; paper: PaperV2 }): PaperBundle {
  const v2 = detail.paper
  const cardPages = v2.answerCard?.pages ?? []
  const paperPages = v2.paper?.pages ?? []
  const paperByPage = new Map(paperPages.map((p) => [p.page, p]))
  const first = cardPages[0]
  const firstPaper = paperPages[0]

  const pages: PaperCardPage[] = cardPages.map((p, i) => ({
    id: `p${p.page ?? i + 1}`,
    side: sideOf(i),
    paperSize: pageSizeOf(p),
    orientation: orientationOf(p),
    answerCardSize: pageSizeOf(p),
    canvas: { ...p.canvas, unit: 'canvas' },
    markers: p.markers ?? [],
    blocks: (p.blocks ?? []).map((b) => ({
      id: b.id,
      kind: 'text',
      text: b.text ?? '',
      region: b.region,
      style: b.style,
    })),
  }))

  const sections: PaperSection[] = [
    { id: 'sec-mark', title: '一、客观题', type: 'single', instructions: '请用 2B 铅笔填涂' },
    { id: 'sec-subj', title: '二、主观题', type: 'short', instructions: '请在各题指定区域内作答' },
  ]

  const questions: PaperQuestion[] = []
  cardPages.forEach((p, pageIndex) => {
    const source = paperByPage.get(p.page ?? pageIndex + 1)
    for (const q of p.questions ?? []) {
      const textQ = (source?.questions ?? []).find((x) => x.id === q.id) as PaperV2Question | undefined
      const isMark = q.type === 'mark'
      const number = q.displayNumber ?? questions.length + 1
      const options = isMark
        ? (textQ?.choices?.map((c) => ({ key: c.value, text: c.text ?? c.value })) ??
          (q.choices ?? []).map((c) => ({ key: c.value, text: c.value })))
        : []
      questions.push({
        id: q.id,
        sectionId: isMark ? 'sec-mark' : 'sec-subj',
        number,
        type: isMark ? 'single' : 'short',
        stem: textQ?.stem ?? (isMark ? `第 ${number} 题` : `第 ${number} 题 解答区`),
        options,
        answer: v2.answerCard?.answerKey?.[q.id] ?? '',
        score: q.score,
        answerCard: {
          page: sideOf(pageIndex),
          type: isMark ? 'mark' : 'subjective',
          region: q.region,
          choices: q.choices,
          render: isMark ? null : { style: 'lines', rows: 8 },
        },
      })
    }
  })

  questions.sort((a, b) => a.number - b.number)

  const size = first ? pageSizeOf(first) : firstPaper ? pageSizeOf(firstPaper) : 'A4'
  const orientation = first ? orientationOf(first) : 'portrait'
  return {
    schema: 'paper-bundle',
    schemaVersion: 1,
    meta: {
      id: `backend-${detail.id}`,
      title: detail.name || '后端试卷',
      subject: inferSubject(detail.name),
      grade: '高三',
      examName: detail.name || '后端试卷',
      durationMinutes: 120,
      paperSize: size,
      orientation,
      answerCardSize: size,
      sides: 2,
      variant: 'A',
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    sections,
    questions,
    answerCard: {
      pages,
    },
  }
}

function inferSubject(name: string): string {
  const subjects = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治']
  return subjects.find((s) => name.includes(s)) ?? '数学'
}
