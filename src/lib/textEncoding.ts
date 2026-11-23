/** 读取本地 CSV/JSON，兼容 UTF-8、UTF-8 BOM、GBK/GB18030。 */
export async function readFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)

  // UTF-16 BOM
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return stripBom(new TextDecoder('utf-16le').decode(buf))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return stripBom(new TextDecoder('utf-16be').decode(buf))
  }

  const utf8 = stripBom(new TextDecoder('utf-8', { fatal: false }).decode(buf))
  if (!utf8.includes('\uFFFD')) return utf8

  // Excel 导出的中文 CSV 常见 GBK/GB18030，UTF-8 解码失败时回退
  try {
    const gbk = stripBom(new TextDecoder('gb18030', { fatal: false }).decode(buf))
    if (!gbk.includes('\uFFFD')) return gbk
    return gbk
  } catch {
    return utf8
  }
}

export function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '')
}
