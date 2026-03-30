import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // 將大型依賴分離成獨立 chunk，避免首屏下載全部
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-echarts': ['echarts', 'echarts-for-react'],
          'vendor-datepicker': ['react-datepicker', 'date-fns'],
        }
      }
    }
  }
})
