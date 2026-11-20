/**
 * 移动端确认弹层：用 Ant Design Mobile 的 Dialog，统一视觉与交互；
 * 返回 Promise<boolean>，调用方式和 window.confirm 一致。
 */
import { Dialog } from 'antd-mobile'

export function confirmAction(title: string, content?: string, confirmText = '删除'): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: boolean) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    Dialog.confirm({
      title,
      content,
      confirmText,
      cancelText: '取消',
      onConfirm: () => finish(true),
      onCancel: () => finish(false),
      closeOnMaskClick: true,
    })
  })
}
