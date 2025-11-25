import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')         // lê .env
  const API_TARGET = env.VITE_PROXY_TARGET || 'http://api:5252' // porta real da API

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      watch: { usePolling: true },
      hmr: { host: 'localhost', clientPort: 5174 },
      proxy: {
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      // evita cache quebrado do optimizer com libs grandes
      exclude: ['echarts', 'echarts-wordcloud'],
    },
  }
})
