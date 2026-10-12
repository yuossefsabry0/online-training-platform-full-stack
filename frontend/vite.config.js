import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-server proxy for `/api` -> backend (default http://localhost:3000).
// Same-origin in dev, so no backend CORS change is ever needed.
// In production, set VITE_API_URL to the absolute backend API base
// (e.g. https://api.example.com/api) and configure backend CORS_ORIGINS
// accordingly. The backend itself is never modified by this project.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
  },
});
