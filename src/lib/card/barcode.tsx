import { useEffect, useRef, useState } from 'react'
import JsBarcode from 'jsbarcode'
import type { CardBarcodeFormat } from './types'

export const BARCODE_FORMATS: Array<{ value: CardBarcodeFormat; label: string; hint: string }> = [
  { value: 'CODE128', label: 'Code 128', hint: '任意 ASCII，考试条码最常用' },
  { value: 'CODE39', label: 'Code 39', hint: '数字/大写字母及 - . 空格 / + %' },
  { value: 'EAN13', label: 'EAN-13', hint: '12 或 13 位数字' },
  { value: 'ITF14', label: 'ITF-14', hint: '13 或 14 位数字' },
]

export function validateBarcode(format: CardBarcodeFormat, raw: string): string {
  const value = raw.trim()
  if (!value) return '请输入条形码内容'
  if (format === 'CODE128') {
    if (value.length > 80) return 'Code128 内容不能超过 80 个字符'
    if (!/^[\x20-\x7E]+$/.test(value)) return 'Code128 只支持 ASCII 可见字符'
    return ''
  }
  if (format === 'CODE39') {
    if (!/^[0-9A-Z\-. $/+%]+$/.test(value)) return 'Code39 只支持数字、大写字母和 - . 空格 / + %'
    return ''
  }
  if (format === 'EAN13') {
    if (!/^\d{12,13}$/.test(value)) return 'EAN-13 需要 12 或 13 位数字'
    return ''
  }
  if (!/^\d{13,14}$/.test(value)) return 'ITF-14 需要 13 或 14 位数字'
  return ''
}

/** 前端矢量渲染的条形码；打印时保持 SVG，不会栅格化模糊 */
export function BarcodeSvg({
  format,
  value,
  showText = true,
  className = '',
}: {
  format: CardBarcodeFormat
  value: string
  showText?: boolean
  className?: string
}) {
  const ref = useRef<SVGSVGElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    setError('')
    const bad = validateBarcode(format, value)
    if (bad) {
      setError(bad)
      return
    }
    try {
      JsBarcode(svg, value.trim(), {
        format,
        displayValue: showText,
        width: 2,
        height: 60,
        margin: 10,
        background: '#ffffff',
        lineColor: '#111111',
        fontSize: 15,
        textMargin: 0,
        font: 'Arial, sans-serif',
      })
      svg.setAttribute('preserveAspectRatio', 'none')
    } catch (e) {
      setError(e instanceof Error ? e.message : '条形码生成失败')
    }
  }, [format, value, showText])

  return (
    <div className={`barcode-svg-wrap ${className}`}>
      <svg ref={ref} style={{ width: '100%', height: '100%', display: error ? 'none' : 'block' }} />
      {error && <span className="barcode-svg-error">{error}</span>}
    </div>
  )
}
