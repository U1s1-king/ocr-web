import type { ComponentType } from 'react'
import type { IconProps } from './icons'
import {
  ChartIcon,
  CheckCircleIcon,
  ExamIcon,
  FileStackIcon,
  ListIcon,
  PhotoIcon,
  SettingsIcon,
  StudentsIcon,
  UploadIcon,
  UsersIcon,
} from './icons'
import type { ModuleIconKey } from '../lib/modules'

/** 八大模块 → 桌面端图标（同一套 48 视窗线性图标，粗细一致） */
export const MODULE_ICONS: Record<ModuleIconKey, ComponentType<IconProps>> = {
  paper: FileStackIcon,
  exam: ExamIcon,
  result: ChartIcon,
  batch: ListIcon,
  review: CheckCircleIcon,
  log: ListIcon,
  file: UploadIcon,
  student: StudentsIcon,
  settings: SettingsIcon,
}

export { PhotoIcon, UsersIcon }
