import { defineConfig } from 'vite';

// Allowed hosts for preview environments can be extended with the built-in
// env var: __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=host1,host2
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 3012,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 3012,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
