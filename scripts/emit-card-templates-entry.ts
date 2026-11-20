// 供 scripts/emit-card-templates.mjs 打包的入口（浏览器代码在 Node 下只用到纯函数部分）
export { CARD_TEMPLATES } from '../src/lib/card/catalog'
export { generateCard } from '../src/lib/card/generator'
export { contentForBackend } from '../src/lib/card/store'
