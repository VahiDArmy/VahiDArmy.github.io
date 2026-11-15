import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const extraHosts = (process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3008,
    strictPort: false,
    allowedHosts: ['localhost', ...extraHosts],
  },
  preview: {
    host: '0.0.0.0',
    port: 3008,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
  },
});
