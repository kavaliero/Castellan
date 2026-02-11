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
  },
});