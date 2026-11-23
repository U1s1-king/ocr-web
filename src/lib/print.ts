/**
 * 浏览器打印桥。
 *
 * 纯浏览器不能直接向打印机写原始指令；现在统一走 print dialog。
 * 后续接硬件时，在页面里监听 `ocr:print` 事件并阻止默认打印即可：
 *
 * window.addEventListener('ocr:print', (e) => {
 *   e.preventDefault()
 *   hardwareBridge.send(e.detail) // QZ Tray / WebSocket / WebUSB / WebSerial
 * })
 *
 * 事件 detail 是 JSON 可序列化的 PrintJob，包含纸型、方向、页数、双面、
 * 来源和标题，硬件端不需要再解析 DOM。
 */
export type PrintKind = 'answer-card' | 'exam-paper' | 'barcode-label' | 'paper-bundle'

export interface PrintJob {
  kind: PrintKind
  title: string
  paperSize: string
  orientation: 'portrait' | 'landscape'
  widthMm: number
  heightMm: number
  pages: number
  doubleSided: boolean
  source: string
  createdAt: string
}

declare global {
  interface WindowEventMap {
    'ocr:print': CustomEvent<PrintJob>
  }
}

export function requestPrint(job: Omit<PrintJob, 'createdAt'>): boolean {
  const detail: PrintJob = { ...job, createdAt: new Date().toISOString() }
  const event = new CustomEvent<PrintJob>('ocr:print', { detail, cancelable: true })
  const shouldUseBrowserDialog = window.dispatchEvent(event)
  if (shouldUseBrowserDialog) {
    // 必须紧跟在用户点击栈里，否则部分浏览器会拦截 print dialog
    window.print()
  }
  return shouldUseBrowserDialog
}
