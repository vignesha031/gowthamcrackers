import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: process.env.VERCEL === '1' ? '/' : '/admin/',
    plugins: [react()],
    define: { __API_URL__: JSON.stringify(env.API_URL ?? process.env.API_URL ?? '') },
    server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
    preview: { port: 4173, proxy: { '/api': 'http://localhost:4000' } },
  };
});
