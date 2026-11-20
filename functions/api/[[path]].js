// Pages Function：同源 /api/* 转发到后端。
// 后端已改为 Cloudflare Tunnel 暴露（https://diffs-entered-goat-formula.trycloudflare.com），
// 走标准 443 + HTTPS，直接用 fetch 即可，不再需要手写 TCP socket。
// 如需临时切换后端，改 UPSTREAM 或配环境变量 API_ORIGIN。

const UPSTREAM = 'https://diffs-entered-goat-formula.trycloudflare.com'

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

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
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
    out.set('cache-control', 'no-store')
    return new Response(res.body, { status: res.status, headers: out })
  } catch (err) {
    return new Response(
      JSON.stringify({ code: 'PROXY_FAILED', message: err && err.message ? err.message : String(err) }),
      { status: 502, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } },
    )
  }
}
