// 独立 Cloudflare Worker：把 /api/* 同源代理到后端隧道，并补上 CORS。
// 用途：Cloudflare Pages 直接上传（不经过 Git 构建）时不会带 functions，
// 所以前端通过这个 Worker 访问接口；Git 部署仍可用 functions/api/[[path]].js。
const UPSTREAM = 'https://jstestapi.bakabaka.dpdns.org'

const PASS_HEADERS = ['accept', 'accept-language', 'authorization', 'client-cookie', 'content-type', 'user-agent']
const DROP_HEADERS = ['content-length', 'content-encoding', 'transfer-encoding', 'connection', 'host']

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'access-control-allow-headers': 'authorization, client-cookie, content-type, accept, accept-language',
  'access-control-max-age': '86400',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
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
      const out = new Headers(CORS)
      for (const [k, v] of res.headers) {
        if (!DROP_HEADERS.includes(k.toLowerCase())) out.set(k, v)
      }
      out.set('cache-control', 'no-store')
      return new Response(res.body, { status: res.status, headers: out })
    } catch (err) {
      return new Response(
        JSON.stringify({ code: 'PROXY_FAILED', message: err && err.message ? err.message : String(err) }),
        {
          status: 502,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
        },
      )
    }
  },
}
