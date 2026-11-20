// 路由冒烟：只检查页面能否渲染、有没有前端运行时错误，不依赖后端可用。
// 用法：先 npm run dev，然后 npm run smoke
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const BASE = process.env.BASE || 'http://127.0.0.1:5173'
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ROUTES = [
  '/#/exams',
  '/#/papers',
  '/#/papers/studio',
  '/#/papers/templates',
  '/#/papers/print',
  '/#/papers/local/edit',
  '/#/m',
  '/#/m/capture',
  '/#/m/history',
  '/#/m/mine',
  '/#/m/settings',
  '/#/m/results',
  '/#/m/papers',
  '/#/results',
  '/#/check',
  '/#/check/history',
  '/#/settings',
  '/#/settings/diagnostics',
  '/#/files',
  '/#/students',
  '/#/reviews',
  '/#/logs',
  '/#/batches',
  '/#/legacy',
]

fs.mkdirSync('shots/smoke', { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push({ url: page.url(), error: String(e) }))
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text()
    if (/Failed to load resource|net::ERR|Request failed|WebSocket|CORS/i.test(t)) return
    errors.push({ url: page.url(), error: t.slice(0, 300) })
  }
})

const results = []
for (const r of ROUTES) {
  errors.length = 0
  await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => {
    results.push({ route: r, ok: false, reason: String(e).slice(0, 120) })
  })
  await page.waitForTimeout(600)
  const finalUrl = page.url()
  const body = await page.evaluate(() => document.body.innerText.trim().slice(0, 120)).catch(() => '')
  const name = r.replace(/[#/]/g, '_').replace(/^_/, '') || 'root'
  await page.screenshot({ path: `shots/smoke/${name}.png`, fullPage: false }).catch(() => {})
  results.push({ route: r, finalUrl, len: body.length, errors: [...errors] })
}

console.table(results.map((r) => ({ route: r.route, len: r.len, errors: (r.errors || []).length, finalUrl: r.finalUrl })))
console.log('legacy redirected:', results.find((x) => x.route === '/#/legacy')?.finalUrl?.endsWith('/exams'))
console.log('total runtime errors:', results.reduce((s, r) => s + (r.errors?.length || 0), 0))
for (const r of results) for (const e of r.errors || []) console.log('ERR', r.route, '→', e.error)
await browser.close()
