import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    host: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
      },
    },
  },
  resolve: {
    // Thêm cấu hình này để giúp Vite tìm thấy các modules
    alias: {
      'react-router-dom': 'react-router-dom',
    },
  },
  optimizeDeps: {
    // Thêm các dependencies cần được tối ưu hóa
    include: ['react-router-dom'],
  },
  build: {
    outDir: 'dist',
    // Thêm cấu hình này để xử lý các external modules
    rollupOptions: {
      external: [],
    },
  },
})
