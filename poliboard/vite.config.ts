import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'poliboard',
      filename: 'remoteEntry.js',
      exposes: {
        './Board': './src/components/Board.tsx',
      },
      shared: ['react', 'react-dom']
    })
  ],
  server: {
    port: 5002, // Different from host
    cors: true
  },
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  }
})
