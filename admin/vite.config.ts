import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VERCEL === '1' ? '/' : '/admin/',
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:4000' } },
});
