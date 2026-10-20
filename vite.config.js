import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const API_PORT = process.env.API_PORT || 8787;

export default defineConfig({
  root: 'app',
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
});
