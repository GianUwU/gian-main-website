import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests to the backend
      '/api': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      // Proxy auth endpoints
      '/token': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/register': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/refresh': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/change-password': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/transactions': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/user/info': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/admin/users': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/admin/reset-password': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/admin/update-admin-status': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:8002',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
