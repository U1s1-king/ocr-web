import type { LocalRequestLog } from './requestLog'

export interface Diagnosis {
  tone: 'error' | 'warn' | 'ok'
  title: string
  desc: string
}

/** 把最近一次失败请求翻译成「接口不通 / 配置错误 / 鉴权 / 路径 / 后端异常」 */
export function diagnoseRequest(last?: LocalRequestLog): Diagnosis {
  if (!last) {
    return {
      tone: 'ok',
      title: '暂无失败记录',
      desc: '最近没有接口错误。若页面没有数据，先启动后端，再回到这里点「测试连接」。',
    }
  }
  if (!last.status || last.status === 0 || last.code === 'NETWORK') {
    return {
      tone: 'error',
      title: '接口不通',
      desc: '后端服务没有启动，或接口地址 / 代理不可达。请先启动后端，再确认地址填写正确。',
    }
  }
  if (last.code === 'BAD_CONTENT_TYPE' || /html/i.test(last.error ?? '')) {
    return {
      tone: 'warn',
      title: '地址配置错误',
      desc: '接口返回了 HTML 页面，通常是把地址写成了站点首页，或 /api 代理没有指向后端。检查地址末尾斜杠与 /api 前缀。',
    }
  }
  if (last.status === 401 || last.status === 403) {
    return {
      tone: 'warn',
      title: '鉴权配置错误',
      desc: '后端可达但 Token 无效或缺失，请填写正确的 API Token 后重新测试。',
    }
  }
  if (last.status === 404) {
    return {
      tone: 'warn',
      title: '接口路径错误',
      desc: '请求路径不存在，检查接口地址与 /api/v1 前缀是否匹配后端部署路径。',
    }
  }
  if (last.status >= 500) {
    return {
      tone: 'error',
      title: '后端服务异常',
      desc: '后端已启动但接口返回 5xx，请查看后端日志，确认数据库与依赖服务正常。',
    }
  }
  return {
    tone: 'warn',
    title: '接口请求失败',
    desc: '请求未成功，可在「接口日志 / 识别诊断」中查看具体路径、状态码与错误信息。',
  }
}
