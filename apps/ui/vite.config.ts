import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // GitHub Pages: use relative base when building in Actions so main and PR previews work
  base: process.env.GITHUB_ACTIONS ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
  '@core': path.resolve(__dirname, '../../dist/src/index.js'),
    }
  },
  server: {
    port: 5173,
    fs: {
      // Allow serving files from monorepo folders in dev
      allow: [
        path.resolve(__dirname), // apps/ui
        path.resolve(__dirname, '..', '..'), // workspace root
        path.resolve(__dirname, '../../dist'), // built core
      ]
    }
  }
});
