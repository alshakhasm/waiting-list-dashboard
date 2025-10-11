import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';

// ESM-safe dirname for this config file
const __dirname_esm = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // Load only VITE_ variables from env files in apps/ui
  const env = loadEnv(mode, __dirname_esm, 'VITE_');
  return {
    // Use a relative base in production so it works on GitHub Pages (project subpath)
    // and any static hosting where the app is not served from domain root.
    base: mode === 'production' ? './' : '/',
    // Ensure Vite reads env files from this directory (apps/ui)
    envDir: __dirname_esm,
    // Do not hard-override import.meta.env.*; let Vite expose VITE_* from .env and CI process.env
    plugins: [react()],
    resolve: {
      alias: {
        '@core': path.resolve(__dirname_esm, '../../dist/src/index.js'),
      }
    },
    server: {
      port: 5173,
      fs: {
        // Allow serving files from monorepo folders in dev
        allow: [
          path.resolve(__dirname_esm), // apps/ui
          path.resolve(__dirname_esm, '..', '..'), // workspace root
          path.resolve(__dirname_esm, '../../dist'), // built core
        ]
      }
    }
  };
});
