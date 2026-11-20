/** ===== 试卷 JSON 标准 v1 ===== */

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Marker {
  /** 必须是 top-left / top-right / bottom-left / bottom-right */
  id: string;
  x: number;
  y: number;
  size: number;
}

export interface Choice {
  value: string;
  /** 相对 question.region 的比例区域 */
  region: Region;
}

export interface Question {
  id: string;
  displayNumber?: number;
  type: 'mark' | 'subjective';
  /** 每题分值，后端必填 */
  score?: number;
  region: Region;
  choices?: Choice[];
}

export interface BlockStyle {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
  color?: string;
  fontFamily?: string;
}

export interface Block {
  id: string;
  type: 'text';
  region: Region;
  text: string;
  style?: BlockStyle;
}

export interface Barcode {
  id: string;
  type: 'code128';
  value: string;
  anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offset: { unit: 'canvas' | 'ratio' | 'mm'; x: number; y: number };
  size: { unit: 'canvas' | 'ratio' | 'mm'; width: number; height: number };
}

export interface ExamContent {
  schemaVersion: 1;
  unit: 'canvas';
  canvas: { width: number; height: number };
  markers: Marker[];
  questions: Question[];
  blocks?: Block[];
  barcode?: Barcode;
  answerKey?: Record<string, string>;
}

/** ===== 试卷接口实体 ===== */

export interface ExamSummary {
  id: number;
  name: string;
  exam: ExamContent | Record<string, never>;
}

/** ===== 检查结果 ===== */

export interface QuestionMetric {
  type: 'mark' | 'subjective';
  answer: string | null;
  mode?: 'blank' | 'single' | 'multi' | 'all' | 'other';
  selected?: number;
  selectedOptions?: string[];
  markedCount?: number;
  ratios?: number[];
  confidence?: number;
  expected?: string | null;
  correct?: boolean | null;
  uncertain?: boolean;
}

export interface CheckFileResult {
  fileId: number;
  success: boolean;
  answers?: Record<string, string | null>;
  metrics?: Record<string, QuestionMetric>;
  markers?: { x: number; y: number }[];
  image?: { width: number; height: number };
  code?: string;
  error?: string;
}

export interface CheckBatchResult {
  examId: number;
  total: number;
  successCount: number;
  failureCount: number;
  results: CheckFileResult[];
}

/** ===== 文件 ===== */

export interface UploadedFile {
  fileId: number;
  hash: string;
  uTime: number;
}

/** ===== 学生 ===== */

export interface Student {
  id?: number;
  name: string;
  candidateNumber: string;
  className: string;
  grade: string;
  major: string;
}

export interface ApiErrorInfo {
  status: number;
  code: string;
  message: string;
}
