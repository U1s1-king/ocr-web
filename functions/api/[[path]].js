// Pages Function：同源 /api/* 转发到后端。
// 后端通过 Cloudflare Tunnel 暴露，生产默认走这里；也允许 GitHub Pages 等
// 跨域静态站点直接调用本代理（已带 CORS）。
// 临时切换后端：改 UPSTREAM、配环境变量 API_ORIGIN，或前端设置接口地址。

const UPSTREAM = 'https://jstestapi.bakabaka.dpdns.org'

const PASS_HEADERS = [
  'accept',
  'accept-language',
  'authorization',
  'client-cookie',
  'content-type',
  'user-agent',
]

// 这些头由 fetch/Response 自己处理，透传会出错
const DROP_HEADERS = ['content-length', 'content-encoding', 'transfer-encoding', 'connection', 'host']

function corsHeaders(request) {
  const origin = request.headers.get('origin') || '*'
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type, client-cookie',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const cors = corsHeaders(request)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }

  const origin = (env && env.API_ORIGIN) || UPSTREAM
  const target = origin.replace(/\/$/, '') + url.pathname + url.search

  const headers = new Headers()
  for (const [k, v] of request.headers) {
    if (PASS_HEADERS.includes(k.toLowerCase())) headers.set(k, v)
  }

  const init = { method: request.method, headers, redirect: 'manual' }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  try {
    const res = await fetch(target, init)
    const out = new Headers()
    for (const [k, v] of res.headers) {
      if (!DROP_HEADERS.includes(k.toLowerCase())) out.set(k, v)
    }
    for (const [k, v] of Object.entries(cors)) out.set(k, v)
    out.set('cache-control', 'no-store')
    return new Response(res.body, { status: res.status, headers: out })
  } catch (err) {
    return new Response(
      JSON.stringify({ code: 'PROXY_FAILED', message: err && err.message ? err.message : String(err) }),
      {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors },
      },
    )
  }
}
