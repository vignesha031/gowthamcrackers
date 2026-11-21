import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The panel lives at /admin/ (the API server serves the built files there).
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:4000' } },
});
