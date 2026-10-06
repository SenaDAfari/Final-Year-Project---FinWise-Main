import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Shared so `npm run dev` and `npm run preview` both forward /api to Flask
const proxy = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 3000, proxy, allowedHosts: true },
  preview: { host: true, port: 3000, proxy, allowedHosts: true },
})