import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const lunchVoteRemote =
    env.VITE_LUNCH_VOTE_REMOTE_URL || 'http://localhost:5006/assets/remoteEntry.js'
  const poliboardRemote =
    env.VITE_POLIBOARD_REMOTE_URL || 'http://localhost:5002/assets/remoteEntry.js'

  return {
    plugins: [
      react(),
      federation({
        name: 'client-host',
        remotes: {
          lunchVote: lunchVoteRemote,
          poliboard: poliboardRemote,
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
      alias: {
        'react-router-dom': 'react-router-dom',
      },
    },
    optimizeDeps: {
      include: ['react-router-dom'],
    },
    build: {
      outDir: 'dist',
      modulePreload: false,
      target: 'esnext',
      minify: false,
      cssCodeSplit: false,
    },
  }
})
