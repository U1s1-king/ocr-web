/**
 * 八大模块定义：与 /api/v1 的九组接口对齐（试卷 / 考试 / 成绩 / 批次 /
 * 复核 / 日志 / 文件 / 学生），其中「考试」下辖 exam-batches 相关动作。
 *
 * 桌面侧栏用它渲染二级页 + 三级子页，移动端首页用它渲染模块入口，
 * 移动端搜索也用它做「功能」那一半的结果。
 */

export type ModuleChild = {
  label: string
  /** 桌面端路由 */
  to: string
  /** 移动端路由，留空表示暂无移动端页 */
  m?: string
  /** 这一页负责的接口，侧栏悬停可看，搜索也吃这些词 */
  api?: string
  keys?: string[]
}

export type ModuleDef = {
  id: string
  label: string
  desc: string
  /** 首页卡片副标题 */
  hint: string
  tone: 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'cyan' | 'slate' | 'orange'
  icon: 'paper' | 'exam' | 'result' | 'batch' | 'review' | 'log' | 'file' | 'student' | 'settings'
  to: string
  m: string
  children: ModuleChild[]
}

export const MODULES: ModuleDef[] = [
  {
    id: 'papers',
    label: '试卷',
    desc: '答题卡版式与答案键',
    hint: '编辑版式、维护答案键',
    tone: 'blue',
    icon: 'paper',
    to: '/papers',
    m: '/m/papers',
    children: [
      { label: '试卷库', to: '/papers', m: '/m/papers', api: 'GET /papers', keys: ['试卷', '列表'] },
      { label: '答题卡制作', to: '/papers/studio', m: '/m/papers', keys: ['制作', '模板', '自动出卡', '答题卡'] },
      { label: '文本出卡 DSL', to: '/papers/dsl', m: '/m/papers', keys: ['文本', 'DSL', '快速出卡', '一行一题'] },
      { label: '模板工坊', to: '/papers/templates', m: '/m/papers', api: 'GET /templates', keys: ['模板', '出卷', '自动'] },
      { label: '版式精调', to: '/papers/:id/edit', m: '/m/papers/:id/edit', api: 'PUT /papers/{id}', keys: ['编辑', '版式', '画布', '拖动', '定位'] },
      { label: '答案键', to: '/papers/:id/edit', m: '/m/papers/:id/edit', api: 'PUT /papers/{id}/answers', keys: ['答案', '标准答案'] },
      { label: '上传前校验', to: '/papers/:id/edit', api: 'POST /papers/{id}/check', keys: ['校验', '检查'] },
      { label: '删除试卷', to: '/papers', api: 'DELETE /papers/{id}', keys: ['删除'] },
    ],
  },
  {
    id: 'exams',
    label: '考试',
    desc: '考试与考试批次',
    hint: '绑定试卷、批量批改',
    tone: 'green',
    icon: 'exam',
    to: '/exams',
    m: '/m/exams',
    children: [
      { label: '考试列表', to: '/exams', m: '/m/exams', api: 'GET /exams', keys: ['考试', '列表'] },
      { label: '新建考试', to: '/exams/new', m: '/m/exams/new', api: 'POST /exams', keys: ['新建', '创建', '绑定试卷'] },
      { label: '考试详情', to: '/exams/:id', m: '/m/exams/:id', api: 'GET /exams/{id}', keys: ['详情'] },
      { label: '批量批改', to: '/check', m: '/m/capture', api: 'POST /exams/{id}/grade', keys: ['批改', '识别', '扫描', '拍照'] },
      { label: '考试成绩', to: '/exams/:id/results', m: '/m/exams/:id', api: 'GET /exams/{id}/results', keys: ['成绩'] },
      { label: '成绩总表', to: '/results', m: '/m/results', api: 'GET /exam-results', keys: ['总表', '汇总'] },
      { label: '批次列表', to: '/batches', m: '/m/batches', api: 'GET /exam-batches', keys: ['批次'] },
      { label: '批次详情', to: '/batches', m: '/m/batches', api: 'GET /exam-batches/{id}', keys: ['批次详情'] },
      { label: '新建批次', to: '/batches', m: '/m/batches', api: 'POST /exam-batches', keys: ['新建批次'] },
      { label: '编辑批次', to: '/batches', m: '/m/batches', api: 'PUT /exam-batches/{id}', keys: ['编辑批次'] },
      { label: '删除批次', to: '/batches', m: '/m/batches', api: 'DELETE /exam-batches/{id}', keys: ['删除批次'] },
    ],
  },
  {
    id: 'results',
    label: '成绩',
    desc: '单份成绩与逐题明细',
    hint: '总分、逐题与复核入口',
    tone: 'amber',
    icon: 'result',
    to: '/results',
    m: '/m/results',
    children: [
      { label: '成绩列表', to: '/results', m: '/m/results', api: 'GET /exam-results', keys: ['成绩', '分数', '列表'] },
      { label: '成绩详情', to: '/results/:id', m: '/m/results/:id', api: 'GET /exam-results/{id}', keys: ['详情', '逐题'] },
      { label: '统计图表', to: '/results', m: '/m/results', keys: ['统计', '图表', '分布'] },
    ],
  },
  {
    id: 'reviews',
    label: '人工复核',
    desc: '客观题争议与主观题评分',
    hint: '待处理队列与最终判定',
    tone: 'rose',
    icon: 'review',
    to: '/reviews',
    m: '/m/reviews',
    children: [
      { label: '复核列表', to: '/reviews', m: '/m/reviews', api: 'GET /reviews', keys: ['复核', '待处理', '争议'] },
      { label: '复核详情', to: '/reviews/:id', m: '/m/reviews/:id', api: 'GET /reviews/{id}', keys: ['复核详情', '裁剪图'] },
      { label: '题目原图', to: '/reviews/:id', m: '/m/reviews/:id', api: 'GET /reviews/{id}/image', keys: ['原图', '截图'] },
      { label: '提交判定', to: '/reviews', m: '/m/reviews', api: 'PUT /reviews/{id}', keys: ['判定', '改分'] },
    ],
  },
  {
    id: 'files',
    label: '文件',
    desc: '上传原图与按哈希去重',
    hint: '上传、检索、复用原图',
    tone: 'cyan',
    icon: 'file',
    to: '/files',
    m: '/m/files',
    children: [
      { label: '文件库', to: '/files', m: '/m/files', api: 'GET /files/search', keys: ['文件', '图片', '原图', '搜索'] },
      { label: '上传文件', to: '/files', m: '/m/files', api: 'POST /files', keys: ['上传'] },
    ],
  },
  {
    id: 'students',
    label: '学生',
    desc: '名册、考号与批量维护',
    hint: '考号映射与批量导入',
    tone: 'violet',
    icon: 'student',
    to: '/students',
    m: '/m/students',
    children: [
      { label: '学生名册', to: '/students', m: '/m/students', keys: ['学生', '名册', '考号'] },
      { label: '批量导入', to: '/students/import', m: '/m/students', api: 'POST /students/batch', keys: ['导入', '批量', 'Excel'] },
      { label: '批量更新', to: '/students', m: '/m/students', api: 'PUT /students/batch', keys: ['更新'] },
      { label: '批量删除', to: '/students', m: '/m/students', api: 'DELETE /students/batch', keys: ['删除'] },
    ],
  },
  {
    id: 'logs',
    label: '接口日志',
    desc: '请求、响应与错误排查',
    hint: '看清每次请求的去向',
    tone: 'slate',
    icon: 'log',
    to: '/logs',
    m: '/m/logs',
    children: [
      { label: '日志列表', to: '/logs', m: '/m/logs', api: 'GET /logs', keys: ['日志', '记录', '请求'] },
    ],
  },
  {
    id: 'settings',
    label: '设置',
    desc: '接口地址、主题与偏好',
    hint: '接口地址与本机偏好',
    tone: 'orange',
    icon: 'settings',
    to: '/settings',
    m: '/m/settings',
    children: [
      { label: '接口设置', to: '/settings', m: '/m/settings', keys: ['接口', '地址', 'token'] },
      { label: '识别诊断', to: '/settings/diagnostics', m: '/m/settings', keys: ['诊断', '连通', '排障', '自检'] },
      { label: '主题配色', to: '/settings/theme', m: '/m/theme', keys: ['主题', '颜色'] },
      { label: '高级选项', to: '/settings/advanced', m: '/m/settings', keys: ['高级'] },
      { label: '关于', to: '/settings/about', m: '/m/settings', keys: ['关于', '版本'] },
    ],
  },
]

/** 图标键 → 各端自己的图标组件，避免 lib 里引入 React 图标 */
export type ModuleIconKey = ModuleDef['icon'] | 'settings'

/** 卡片底色：低饱和浅底 + 同色系深一档的图标/文字 */
export const MODULE_TONE: Record<ModuleDef['tone'], { bg: string; fg: string }> = {
  blue: { bg: '#eef2f9', fg: '#4a6a9c' },
  green: { bg: '#eef4ef', fg: '#4c7a5e' },
  amber: { bg: '#f7f2e7', fg: '#8a7038' },
  violet: { bg: '#f1eff7', fg: '#6a6396' },
  rose: { bg: '#f8eef0', fg: '#96606a' },
  cyan: { bg: '#eaf2f3', fg: '#447a80' },
  slate: { bg: '#eef0f3', fg: '#5c6570' },
  orange: { bg: '#f7f1ea', fg: '#8d6a45' },
}

