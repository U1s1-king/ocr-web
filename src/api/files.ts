import { request } from './client'
import type { UploadedFile } from './types'

const P = '/api/v1/files'

/** 上传单个文件（< 10 MiB），服务端按 SHA-256 去重，重复上传返回已存在的 fileId */
export function uploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData()
  form.append('file', file, file.name)
  return request<UploadedFile>(P, { method: 'POST', body: form })
}

/** 批量上传，逐个串行避免并发撞 hash */
export async function uploadFiles(
  files: File[],
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<UploadedFile[]> {
  const out: UploadedFile[] = []
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length, files[i].name)
    out.push(await uploadFile(files[i]))
  }
  onProgress?.(files.length, files.length, '')
  return out
}
