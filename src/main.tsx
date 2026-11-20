import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { unstableSetRender } from 'antd-mobile'
import { HashRouter } from 'react-router-dom'
import App from './App'
import 'antd-mobile/es/global'
import './styles/app.css'
import './styles/mobile.css'
import { initTheme } from './lib/theme'
import { initCache } from './m/cache'
import { setApiBase, setApiToken } from './api/client'

// antd-mobile v5 的命令式弹层（Dialog/Toast）在 React 19 下需要 createRoot 适配
unstableSetRender((node, container) => {
  const host = container as Element & { __admRoot?: Root }
  if (!host.__admRoot) host.__admRoot = createRoot(host)
  host.__admRoot.render(node)
  return async () => {
    await new Promise((r) => setTimeout(r, 0))
    host.__admRoot?.unmount()
    delete host.__admRoot
  }
})

// 视觉回退版本：清掉旧版本测试留下的主题色，恢复默认视觉
try {
  const k = 'ac.visualReset.v7'
  if (!localStorage.getItem(k)) {
    localStorage.removeItem('ac.themeColor')
    localStorage.removeItem('ac.themeActive')
    localStorage.removeItem('ac.mobileTheme')
    localStorage.setItem(k, '1')
  }
} catch {
  /* ignore */
}

/**
 * 运行时接口地址覆盖：隧道地址会变，无需重新构建也能切后端
 * - https://site/?api=https://xxx.trycloudflare.com
 * - https://site/#/m?api=https://xxx.trycloudflare.com&token=...
 * 地址只写入本机 localStorage，之后所有请求动态读取。
 */
function applyRuntimeApi() {
  try {
    const fromSearch = new URLSearchParams(location.search)
    const hash = location.hash
    const q = hash.indexOf('?')
    const fromHash = q >= 0 ? new URLSearchParams(hash.slice(q + 1)) : new URLSearchParams()
    const base = fromHash.get('api') || fromSearch.get('api')
    const token = fromHash.get('token') || fromSearch.get('token')
    if (base) setApiBase(base)
    if (token) setApiToken(token)
  } catch {
    /* ignore */
  }
}

applyRuntimeApi()
initTheme()
initCache()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
