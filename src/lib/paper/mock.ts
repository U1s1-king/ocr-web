import type {
  PaperAnswerCard,
  PaperBlock,
  PaperBundle,
  PaperCardPage,
  PaperQuestion,
  PaperQuestionType,
  PaperSection,
  PaperSide,
} from './types'

const W = 300
const H = 424.29

const region = (x: number, y: number, width: number, height: number) => ({ x, y, width, height })

const subjectNames = ['集合', '函数', '三角函数', '数列', '导数', '概率', '立体几何', '解析几何']
const answerOf = (i: number) => 'ABCD'[i % 4]
const optionTexts = (i: number) => [
  `${i + 1}`,
  `${i + 2}`,
  `${i + 3}`,
  `${i + 4}`,
]

function choiceRegion(index: number) {
  const col = index < 10 ? 0 : 1
  const row = index % 10
  return region(16 + col * 138, 118 + row * 18, 130, 16)
}

function fillRegion(index: number) {
  const col = index % 2
  const row = Math.floor(index / 2)
  return region(16 + col * 138, 326 + row * 14, 130, 12)
}

function shortRegion(index: number) {
  const col = index % 2
  const row = Math.floor(index / 2)
  return region(16 + col * 138, 108 + row * 96, 130, 88)
}

function choiceChoices(base: ReturnType<typeof region>) {
  return ['A', 'B', 'C', 'D'].map((value, i) => ({
    value,
    region: region(base.width - 70 + i * 16, 2, 11, 11),
  }))
}

function makePages(): PaperCardPage[] {
  const markers = [
    { id: 'top-left', x: 8, y: 8, size: 14 },
    { id: 'top-right', x: W - 22, y: 8, size: 14 },
    { id: 'bottom-left', x: 8, y: H - 22, size: 14 },
    { id: 'bottom-right', x: W - 22, y: H - 22, size: 14 },
  ]
  const frontBlocks: PaperBlock[] = [
    {
      id: 'front-title',
      kind: 'title',
      text: '高三数学周测答题卡',
      region: region(16, 14, 175, 22),
      style: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
    },
    {
      id: 'front-student',
      kind: 'student',
      text: '姓名：__________  准考证号：____________  座号：______',
      region: region(16, 42, 250, 16),
      style: { fontSize: 9 },
    },
    {
      id: 'front-notice',
      kind: 'notice',
      text: '注意事项：1. 答题前请填写姓名、准考证号；2. 选择题用 2B 铅笔填涂；3. 主观题在对应区域作答。',
      region: region(16, 64, 250, 26),
      style: { fontSize: 8 },
    },
    {
      id: 'front-sec-1',
      kind: 'section',
      text: '一、单项选择题（1—20 题）',
      region: region(16, 98, 250, 14),
      style: { fontSize: 11, fontWeight: 'bold' },
    },
    {
      id: 'front-sec-2',
      kind: 'section',
      text: '二、填空题（21—25 题）',
      region: region(16, 306, 250, 14),
      style: { fontSize: 11, fontWeight: 'bold' },
    },
    {
      id: 'front-footer',
      kind: 'footer',
      text: '第 1 页 / 共 2 页',
      region: region(16, H - 16, 120, 10),
      style: { fontSize: 8 },
    },
  ]
  const backBlocks: PaperBlock[] = [
    {
      id: 'back-title',
      kind: 'title',
      text: '高三数学周测答题卡（背面）',
      region: region(16, 14, 250, 22),
      style: { fontSize: 15, fontWeight: 'bold', textAlign: 'center' },
    },
    {
      id: 'back-student',
      kind: 'student',
      text: '姓名：__________  准考证号：____________  座号：______',
      region: region(16, 42, 250, 16),
      style: { fontSize: 9 },
    },
    {
      id: 'back-sec-3',
      kind: 'section',
      text: '三、解答题（26—31 题）',
      region: region(16, 82, 250, 14),
      style: { fontSize: 11, fontWeight: 'bold' },
    },
    {
      id: 'back-footer',
      kind: 'footer',
      text: '第 2 页 / 共 2 页',
      region: region(16, H - 16, 120, 10),
      style: { fontSize: 8 },
    },
  ]
  return [
    {
      id: 'page-front',
      side: 'front',
      paperSize: 'A4',
      orientation: 'portrait',
      canvas: { width: W, height: H, unit: 'canvas' },
      markers,
      blocks: frontBlocks,
    },
    {
      id: 'page-back',
      side: 'back',
      paperSize: 'A4',
      orientation: 'portrait',
      canvas: { width: W, height: H, unit: 'canvas' },
      markers,
      blocks: backBlocks,
    },
  ]
}

function makeQuestion(
  number: number,
  type: PaperQuestionType,
  sectionId: string,
  cardType: 'mark' | 'subjective',
  page: PaperSide,
  r: ReturnType<typeof region>,
  score: number,
  opts?: { choices?: boolean; rows?: number },
): PaperQuestion {
  const subject = subjectNames[(number - 1) % subjectNames.length]
  const isChoice = type === 'single' || type === 'multi'
  const options = isChoice
    ? ['A', 'B', 'C', 'D'].map((key, i) => ({ key, text: optionTexts(number)[i] }))
    : []
  const stem = isChoice
    ? `已知关于「${subject}」的一个命题，下列结论正确的是（　　）`
    : type === 'blank'
      ? `若关于「${subject}」的条件成立，则结果为 ______。`
      : `已知「${subject}」中的条件，完成下列问题：\n（1）证明相关结论；\n（2）求最终结果。`
  return {
    id: `q_${String(number).padStart(3, '0')}`,
    sectionId,
    number,
    type,
    stem,
    options,
    answer: isChoice ? answerOf(number) : `${number}. 参考答案（示例）`,
    analysis: isChoice
      ? `本题考查${subject}基础概念，逐项判断即可。`
      : `本题以${subject}为背景，先整理条件，再按步骤计算。`,
    score,
    difficulty: isChoice ? 2 : 4,
    knowledgePoints: [subject],
    media: [],
    answerCard: {
      page,
      type: cardType,
      region: r,
      choices: opts?.choices ? choiceChoices(r) : [],
      render:
        cardType === 'subjective'
          ? { style: type === 'blank' ? 'lines' : 'lines', rows: opts?.rows ?? 8 }
          : null,
    },
  }
}

export function makeMockPaperBundle(): PaperBundle {
  const sections: PaperSection[] = [
    { id: 'sec-1', title: '一、单项选择题', type: 'single', instructions: '每小题 5 分，共 100 分' },
    { id: 'sec-2', title: '二、填空题', type: 'blank', instructions: '每小题 4 分，共 20 分' },
    { id: 'sec-3', title: '三、解答题', type: 'short', instructions: '每小题 5 分，共 30 分' },
  ]

  const questions: PaperQuestion[] = []
  for (let i = 0; i < 20; i++) {
    questions.push(
      makeQuestion(i + 1, 'single', 'sec-1', 'mark', 'front', choiceRegion(i), 5, { choices: true }),
    )
  }
  for (let i = 0; i < 5; i++) {
    questions.push(
      makeQuestion(i + 21, 'blank', 'sec-2', 'subjective', 'front', fillRegion(i), 4, { rows: 1 }),
    )
  }
  for (let i = 0; i < 6; i++) {
    questions.push(
      makeQuestion(i + 26, 'short', 'sec-3', 'subjective', 'back', shortRegion(i), 5, { rows: 7 }),
    )
  }

  const answerCard: PaperAnswerCard = {
    pages: makePages(),
    barcode: {
      format: 'CODE128',
      valueSource: 'student.candidateNumber',
      page: 'front',
      region: region(204, 18, 80, 22),
      showText: true,
    },
  }

  return {
    schema: 'paper-bundle',
    schemaVersion: 1,
    meta: {
      id: 'paper_demo_001',
      title: '高三数学周测',
      subject: '数学',
      grade: '高三',
      examName: '2026 秋季第一次周测',
      durationMinutes: 150,
      paperSize: 'A4',
      orientation: 'portrait',
      sides: 2,
      variant: 'A',
      status: 'draft',
      createdAt: '2026-11-22T19:00:00+08:00',
      updatedAt: '2026-11-22T19:00:00+08:00',
    },
    sections,
    questions,
    answerCard,
  }
}
