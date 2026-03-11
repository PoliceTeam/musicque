import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'lunchVote',
      filename: 'remoteEntry.js',
      exposes: {
        './LunchVoteApp': './src/LunchVoteApp.jsx'
      },
      shared: ['react', 'react-dom', 'antd', 'react-router-dom']
    })
  ],
  server: {
    port: 5006,
    cors: true,
  },
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  }
})
