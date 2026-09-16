import { defineConfig } from 'vite';
export default defineConfig({
  root: 'src/client',
  build: { outDir: '../../dist', emptyOutDir: true },
  server: { proxy: { '/v2': 'http://127.0.0.1:8787', '/mcp': 'http://127.0.0.1:8787' } }
});
