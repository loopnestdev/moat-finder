import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    {
      // Cloudflare Pages serves 404.html for all unmatched routes.
      // Copying index.html → 404.html gives the SPA router a clean entry point
      // without triggering the _redirects infinite-loop validator.
      name: 'copy-index-to-404',
      closeBundle() {
        copyFileSync(
          resolve(__dirname, 'dist/index.html'),
          resolve(__dirname, 'dist/404.html'),
        );
      },
    },
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
