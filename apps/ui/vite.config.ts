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
    // GitHub Pages: use relative base when building in Actions so main and PR previews work
    base: process.env.GITHUB_ACTIONS ? './' : '/',
    // Ensure Vite reads env files from this directory (apps/ui)
    envDir: __dirname_esm,
    // Explicitly define env to guarantee availability in both dev and build
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
    },
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
