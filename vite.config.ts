import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/pivot-view-/',
  server: {
    port: 5173,
    host: 'localhost'
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
}); 