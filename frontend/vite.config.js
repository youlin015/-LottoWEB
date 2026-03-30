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
        // Vite 8 (rolldown) 需要 function 格式
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('echarts')) return 'vendor-echarts';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('react-datepicker') || id.includes('date-fns')) return 'vendor-datepicker';
          if (id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
        }
      }
    }
  }
})
