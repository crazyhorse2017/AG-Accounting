import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Builds the static site into ./dist. Wrangler serves ./dist as assets and bundles
// the Worker from src/worker/index.ts itself (see wrangler.jsonc).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
