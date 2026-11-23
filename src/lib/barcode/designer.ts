import type { CardBarcodeFormat } from '../card/types'

export type BarcodeFieldKey = 'school' | 'name' | 'seat' | 'room' | 'candidateNumber' | 'className' | 'barcode' | 'custom'

export interface BarcodeField {
  id: string
  key: BarcodeFieldKey
  text?: string
  x: number
  y: number
  w: number
  h: number
  fontSize: number
  bold?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface BarcodeDesign {
  width: number
  height: number
  pad: number
  format: CardBarcodeFormat
  showText: boolean
  fields: BarcodeField[]
  /** 学校/座号/考场号等画布固定文字；外部数据源有值时优先用数据源 */
  staticText?: Record<string, string>
}

export interface BarcodePerson {
  school: string
  name: string
  seat: string
  room: string
  candidateNumber: string
  className: string
  [key: string]: string
}

export const FIELD_LABELS: Record<BarcodeFieldKey, string> = {
  school: '学校/考点',
  name: '姓名',
  seat: '座号',
  room: '考场号',
  candidateNumber: '考号',
  className: '班级',
  barcode: '条形码',
  custom: '自定义文本',
}

export const FIELD_PLACEHOLDER: Record<BarcodeFieldKey, string> = {
  school: 'XX中学/考点',
  name: '张三',
  seat: '01',
  room: '101',
  candidateNumber: '2026001',
  className: '高一（1）班',
  barcode: '2026001',
  custom: '自定义文字',
}

export const DEFAULT_PERSON: BarcodePerson = {
  school: 'XX中学/考点',
  name: '张三',
  seat: '01',
  room: '101',
  candidateNumber: '2026001',
  className: '高一（1）班',
}

export function makeFields(width: number, height: number): BarcodeField[] {
  const compact = width <= 55
  const fs = compact ? 2 : 2.6
  return [
    { id: 'f-school', key: 'school', x: 2, y: 1, w: width - 4, h: height * 0.14, fontSize: fs, bold: true, align: 'center' },
    { id: 'f-barcode', key: 'barcode', x: width * 0.12, y: height * 0.16, w: width * 0.76, h: height * 0.48, fontSize: fs, align: 'center' },
    { id: 'f-name', key: 'name', x: 2, y: height * 0.66, w: width * 0.45, h: height * 0.18, fontSize: fs + 0.5, bold: true, align: 'left' },
    { id: 'f-seat', key: 'seat', x: width * 0.47, y: height * 0.66, w: width * 0.25, h: height * 0.18, fontSize: fs, align: 'center' },
    { id: 'f-room', key: 'room', x: width * 0.72, y: height * 0.66, w: width * 0.26, h: height * 0.18, fontSize: fs, align: 'right' },
    { id: 'f-candidate', key: 'candidateNumber', x: 2, y: height * 0.84, w: width - 4, h: height * 0.14, fontSize: fs - 0.2, align: 'center' },
  ]
}

export interface LabelPreset {
  id: string
  name: string
  width: number
  height: number
  desc: string
}

export const LABEL_PRESETS: LabelPreset[] = [
  { id: 'gaokao-40x30', name: '高考考试专用条码 40×30', width: 40, height: 30, desc: '参考高考考试专用标签：条码居中，学校/考点、姓名、座号、考场号分列' },
  { id: 'exam-50x25', name: '考试条码标签 50×25', width: 50, height: 25, desc: '常见考试条码纸：条码上方学校，下方姓名/座号/考场' },
  { id: 'card-50x20', name: '答题卡贴条 50×20', width: 50, height: 20, desc: '和答题卡「贴条形码区」50×20mm 对齐' },
  { id: 'exam-75x28', name: '宽标签 75×28.5', width: 75, height: 28.5, desc: '信息量大，适合学校名较长或需要更多自定义文字' },
  { id: 'custom', name: '自定义尺寸', width: 60, height: 25, desc: '自由设置标签宽高和字段，可继续拖拽调整' },
]

function gaokaoFields(w: number, h: number): BarcodeField[] {
  const fs = h >= 28 ? 2.4 : 2.1
  return [
    { id: 'f-school', key: 'school', x: 1.5, y: 1, w: w - 3, h: 3, fontSize: fs, bold: true, align: 'center' },
    { id: 'f-barcode', key: 'barcode', x: w * 0.1, y: 4.2, w: w * 0.8, h: h * 0.42, fontSize: fs, align: 'center' },
    { id: 'f-name', key: 'name', x: 1.5, y: h * 0.63, w: w * 0.34, h: 3.2, fontSize: fs, bold: true, align: 'left' },
    { id: 'f-seat', key: 'seat', x: w * 0.37, y: h * 0.63, w: w * 0.25, h: 3.2, fontSize: fs, align: 'center' },
    { id: 'f-room', key: 'room', x: w * 0.63, y: h * 0.63, w: w * 0.35, h: 3.2, fontSize: fs, align: 'right' },
    { id: 'f-candidate', key: 'candidateNumber', x: 1.5, y: h * 0.82, w: w - 3, h: 2.8, fontSize: fs - 0.2, align: 'center' },
  ]
}

function examFields(w: number, h: number): BarcodeField[] {
  const fs = h >= 24 ? 2.3 : 2
  return [
    { id: 'f-school', key: 'school', x: 1.5, y: 1, w: w - 3, h: 2.8, fontSize: fs, bold: true, align: 'center' },
    { id: 'f-barcode', key: 'barcode', x: w * 0.12, y: 4, w: w * 0.76, h: h * 0.44, fontSize: fs, align: 'center' },
    { id: 'f-name', key: 'name', x: 1.5, y: h * 0.62, w: w * 0.38, h: 3.2, fontSize: fs + 0.2, bold: true, align: 'left' },
    { id: 'f-seat', key: 'seat', x: w * 0.4, y: h * 0.62, w: w * 0.26, h: 3.2, fontSize: fs, align: 'center' },
    { id: 'f-room', key: 'room', x: w * 0.67, y: h * 0.62, w: w * 0.31, h: 3.2, fontSize: fs, align: 'right' },
    { id: 'f-candidate', key: 'candidateNumber', x: 1.5, y: h * 0.82, w: w - 3, h: 2.8, fontSize: fs - 0.2, align: 'center' },
  ]
}

function cardFields(w: number, h: number): BarcodeField[] {
  const fs = 1.9
  return [
    { id: 'f-school', key: 'school', x: 1.5, y: 1, w: w - 3, h: 2.6, fontSize: fs, bold: true, align: 'center' },
    { id: 'f-barcode', key: 'barcode', x: w * 0.1, y: 3.8, w: w * 0.8, h: h * 0.47, fontSize: fs, align: 'center' },
    { id: 'f-name', key: 'name', x: 1.5, y: h * 0.68, w: w * 0.4, h: 2.8, fontSize: fs, bold: true, align: 'left' },
    { id: 'f-seat', key: 'seat', x: w * 0.42, y: h * 0.68, w: w * 0.25, h: 2.8, fontSize: fs, align: 'center' },
    { id: 'f-room', key: 'room', x: w * 0.68, y: h * 0.68, w: w * 0.3, h: 2.8, fontSize: fs, align: 'right' },
    { id: 'f-candidate', key: 'candidateNumber', x: 1.5, y: h * 0.84, w: w - 3, h: 2.4, fontSize: fs - 0.2, align: 'center' },
  ]
}

export function designForPreset(preset: LabelPreset): BarcodeDesign {
  let fields: BarcodeField[]
  if (preset.id === 'gaokao-40x30') fields = gaokaoFields(preset.width, preset.height)
  else if (preset.id === 'exam-50x25') fields = examFields(preset.width, preset.height)
  else if (preset.id === 'card-50x20') fields = cardFields(preset.width, preset.height)
  else fields = makeFields(preset.width, preset.height)
  return {
    width: preset.width,
    height: preset.height,
    pad: 1,
    format: 'CODE128',
    showText: false,
    fields,
    staticText: { school: 'XX中学', seat: '01', room: '101', className: '' },
  }
}

const aliases: Record<keyof Omit<BarcodePerson, 'id'>, string[]> = {
  school: ['学校', '学校名称', 'school', 'schoolname', '中学'],
  name: ['姓名', '学生姓名', 'name', 'studentname', '学生'],
  seat: ['座号', '座位号', '座位', 'seat', 'seatno', '座位编号'],
  room: ['考场号', '考场', '考室', 'room', 'examroom'],
  candidateNumber: ['考号', '考生号', '准考证号', 'candidateNumber', 'candidate_no', 'examnumber', '编号'],
  className: ['班级', 'class', 'classname', '班'],
}

/** 自动识别表头：返回字段 -> 实际 key */
export function detectMapping(headers: string[]): Partial<Record<keyof Omit<BarcodePerson, 'id'>, string>> {
  const out: Partial<Record<keyof Omit<BarcodePerson, 'id'>, string>> = {}
  const norm = (s: string) => s.replace(/^﻿/, '').trim().toLowerCase().replace(/[\s_\-（）()]/g, '')
  for (const [field, list] of Object.entries(aliases) as Array<[keyof typeof aliases, string[]]>) {
    const found = headers.find((h) => list.some((a) => norm(h) === norm(a) || norm(h).includes(norm(a))))
    if (found) out[field] = found
  }
  return out
}

export function personFromRow(row: Record<string, unknown>, mapping: Partial<Record<keyof Omit<BarcodePerson, 'id'>, string>>): BarcodePerson {
  const pick = (field: keyof typeof aliases) => {
    const key = mapping[field]
    const v = key ? row[key] : ''
    return v === undefined || v === null ? '' : String(v)
  }
  return {
    school: pick('school'),
    name: pick('name'),
    seat: pick('seat'),
    room: pick('room'),
    candidateNumber: pick('candidateNumber'),
    className: pick('className'),
  }
}
