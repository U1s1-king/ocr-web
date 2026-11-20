import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 本地开发/预览：把同源 /api 代理到后端，规避浏览器 CORS 与混合内容限制。
 * 后端地址可用 .env 里的 VITE_API_TARGET 覆盖；生产由 Pages Functions 同源转发。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const target = env.VITE_API_TARGET || 'https://diffs-entered-goat-formula.trycloudflare.com'
  const proxy = {
    '/api': {
      target,
      changeOrigin: true,
      timeout: 60_000,
      proxyTimeout: 60_000,
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true,
      allowedHosts: ['.trycloudflare.com', '.anonchihaya.ccwu.cc', '.tomori.ccwu.cc'],
      proxy,
    },
    preview: {
      port: 4173,
      proxy,
    },
    build: {
      outDir: 'dist',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // 只拆 React 基础包；其余交给 Rollup 按依赖顺序打包，
          // 避免 framer-motion / tsparticles / antd-mobile 混在同一 chunk 时出现 TDZ 初始化错误。
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react'
            return undefined
          },
        },
      },
    },
    esbuild: { legalComments: 'none' },
  }
})
