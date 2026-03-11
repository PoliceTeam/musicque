import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'client-host',
      remotes: {
        lunchVote: import.meta.env.VITE_LUNCH_VOTE_REMOTE_URL || 'http://localhost:5006/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'antd', 'react-router-dom'],
    }),
  ],
  server: {
    port: 8080,
    host: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
      },
      '/api': {
        target: 'http://localhost:5005',
        changeOrigin: true,
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
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
})
