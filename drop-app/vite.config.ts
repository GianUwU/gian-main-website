import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/files': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/storage-info': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/users': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/token': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
