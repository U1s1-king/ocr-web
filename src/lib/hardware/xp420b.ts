/**
 * 芯烨 XP-420B（203dpi）蓝牙标签打印。
 *
 * 与 XP 官方 Web Serial 示例一致：通过 navigator.serial 绑定经典蓝牙 SPP，
 * 再用 TSPL 指令直接打印标签。只适用于 Chrome/Edge 桌面版 + HTTPS/localhost。
 */
import {
  FIELD_PLACEHOLDER,
  type BarcodeDesign,
  type BarcodeField,
  type BarcodePerson,
} from '../barcode/designer'

const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb'
const DOTS_PER_MM = 8

interface SerialPortLike {
  readable?: unknown
  writable?: unknown
  open: (options: { baudRate: number }) => Promise<void>
  close: () => Promise<void>
  forget?: () => Promise<void>
  getInfo?: () => { bluetoothServiceClassId?: string }
}

function serialApi(): { getPorts: () => Promise<SerialPortLike[]>; requestPort: (options: unknown) => Promise<SerialPortLike> } | null {
  const nav = navigator as Navigator & {
    serial?: {
      getPorts: () => Promise<SerialPortLike[]>
      requestPort: (options: unknown) => Promise<SerialPortLike>
    }
  }
  return nav.serial ?? null
}

export function isXp420bSupported(): boolean {
  return Boolean(serialApi())
}

/** 获取已授权过的 XP 蓝牙口；需要在用户手势内调用 requestPort 首次绑定 */
export async function findXp420bPort(): Promise<SerialPortLike | null> {
  const api = serialApi()
  if (!api) return null
  const ports = await api.getPorts()
  return ports.find((p) => p.getInfo?.().bluetoothServiceClassId === SPP_UUID) ?? null
}

export async function requestXp420bPort(): Promise<SerialPortLike> {
  const api = serialApi()
  if (!api) throw new Error('当前浏览器不支持 Web Serial，请使用桌面版 Chrome/Edge 并确保 HTTPS 或 localhost')
  return api.requestPort({ filters: [{ bluetoothServiceClassId: SPP_UUID }] })
}

export async function forgetXp420bPort(port: SerialPortLike): Promise<void> {
  await port.forget?.()
}

function fieldValue(field: BarcodeField, person: BarcodePerson, staticText?: Record<string, string>): string {
  if (field.key === 'barcode') return person.candidateNumber || person[field.key] || ''
  if (field.text) return field.text
  const fixed = staticText?.[field.key]
  if (fixed) return fixed
  return person[field.key] || FIELD_PLACEHOLDER[field.key] || ''
}

function esc(value: string): string {
  return value.replace(/"/g, "'").replace(/[\r\n]+/g, ' ')
}

function dots(mm: number): number {
  return Math.max(0, Math.round(mm * DOTS_PER_MM))
}

function tsplForLabel(design: BarcodeDesign, person: BarcodePerson): string {
  const lines: string[] = [
    `SIZE ${design.width} mm,${design.height} mm`,
    `GAP ${design.pad || 2} mm,0 mm`,
    'DIRECTION 1',
    'CLS',
  ]
  for (const field of design.fields) {
    const value = esc(fieldValue(field, person, design.staticText))
    if (!value) continue
    const x = dots(field.x)
    const y = dots(field.y)
    if (field.key === 'barcode') {
      const h = Math.max(8, dots(field.h))
      lines.push(`BARCODE ${x},${y},"128",${h},${design.showText ? 1 : 0},0,2,2,"${value}"`)
    } else {
      // 中文使用 TSS24.BF2；纯英文数字用点阵字体 3
      const font = /[㐀-鿿]/.test(value) ? 'TSS24.BF2' : '3'
      lines.push(`TEXT ${x},${y},"${font}",0,1,1,"${value}"`)
    }
  }
  lines.push('PRINT 1,1', '')
  return lines.join('\r\n')
}

export async function printXp420bLabels(
  port: SerialPortLike,
  design: BarcodeDesign,
  people: BarcodePerson[],
): Promise<number> {
  let openedByUs = false
  try {
    if (!port.readable && !port.writable) {
      await port.open({ baudRate: 9600 })
      openedByUs = true
    }
    const payload = people.map((p) => tsplForLabel(design, p)).join('\r\n')
    const writer = (port as unknown as { writable: { getWriter: () => { write: (data: Uint8Array) => Promise<void>; releaseLock: () => void } } }).writable.getWriter()
    try {
      await writer.write(new TextEncoder().encode(payload))
    } finally {
      writer.releaseLock()
    }
    return people.length
  } finally {
    if (openedByUs) {
      try {
        await port.close()
      } catch {
        /* ignore */
      }
    }
  }
}

export type Xp420bPort = SerialPortLike
