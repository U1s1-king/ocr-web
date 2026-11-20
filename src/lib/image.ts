/**
 * 图片处理：上传前压缩、旋转、裁切，以及本机下载。
 * 全部基于 Canvas，不引入图像处理库。
 */

/** File/Blob → dataURL */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(blob)
  })
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

export interface PreparedImage {
  blob: Blob
  preview: string
  width: number
  height: number
}

/** 上传前压缩：长边限制 + JPEG 质量压缩，避免大图超过 10 MiB 限制 */
export async function prepareImage(file: File | Blob, maxSide = 2400, quality = 0.9): Promise<PreparedImage> {
  const sourceURL = await blobToDataURL(file)
  const img = await loadImage(sourceURL)

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { blob: file, preview: sourceURL, width: img.width, height: img.height }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, quality)
  return { blob, preview: canvas.toDataURL('image/jpeg', quality), width, height }
}

/** 顺时针旋转任意角度（90 的倍数），返回新的 dataURL 与 Blob */
export async function rotateDataURL(
  src: string,
  degrees: 90 | 180 | 270,
  quality = 0.92,
): Promise<{ dataURL: string; blob: Blob; width: number; height: number }> {
  const img = await loadImage(src)
  const swap = degrees === 90 || degrees === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? img.height : img.width
  canvas.height = swap ? img.width : img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 Canvas')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(img, -img.width / 2, -img.height / 2)
  const blob = await canvasToBlob(canvas, quality)
  return { dataURL: canvas.toDataURL('image/jpeg', quality), blob, width: canvas.width, height: canvas.height }
}

export interface CropRect {
  /** 均为 0–1 的比例 */
  x: number
  y: number
  w: number
  h: number
}

/** 按比例裁切图片，返回新的 dataURL 与 Blob */
export async function cropDataURL(
  src: string,
  rect: CropRect,
  quality = 0.92,
): Promise<{ dataURL: string; blob: Blob; width: number; height: number }> {
  const img = await loadImage(src)
  const sx = Math.round(rect.x * img.naturalWidth)
  const sy = Math.round(rect.y * img.naturalHeight)
  const sw = Math.max(1, Math.round(rect.w * img.naturalWidth))
  const sh = Math.max(1, Math.round(rect.h * img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持 Canvas')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  const blob = await canvasToBlob(canvas, quality)
  return { dataURL: canvas.toDataURL('image/jpeg', quality), blob, width: sw, height: sh }
}

/** 把任意图片 dataURL（含 SVG）转成 JPEG 位图，方便直接下载 */
export async function toRasterDataURL(dataURL: string, quality = 0.92): Promise<string> {
  if (/^data:image\/(jpeg|jpg|png|webp)/i.test(dataURL)) return dataURL
  try {
    const img = await loadImage(dataURL)
    const canvas = document.createElement('canvas')
    canvas.width = img.width || 800
    canvas.height = img.height || 1100
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataURL
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return dataURL
  }
}

/* ---------------- 下载 ---------------- */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadDataURL(dataURL: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataURL
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片编码失败'))),
      'image/jpeg',
      quality,
    )
  })
}
