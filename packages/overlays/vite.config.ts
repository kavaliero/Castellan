import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Port fixe pour que les Browser Sources OBS pointent toujours au même endroit
    port: 3000,
    // Permet les connexions depuis OBS (qui est techniquement un "autre" client)
    cors: true,
    proxy: {
      // Proxy /media vers le serveur Express (port 3001)
      // pour les sons de challenge (horn, heartbeat, thriller-end-laugh)
      '/media': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Proxy /api vers Express pour les appels REST
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});