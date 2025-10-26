# Dev Server Troubleshooting Guide

## Quick Start (Normal)
```bash
cd apps/ui
npm run dev
```

## If Dev Server Won't Start (Recurrent Issue)

### 🧹 One-Command Nuclear Clean
Run the radical cleanup script that kills stale processes, clears node_modules, and rebuilds:

```bash
cd apps/ui
bash dev-server-clean.sh
```

This script:
1. Kills all stale vite/node/esbuild processes
2. Deletes node_modules and package-lock.json
3. Clears npm cache
4. Reinstalls dependencies
5. Verifies the build compiles
6. Starts the dev server

## Manual Steps (If script doesn't work)

### 1. Kill Stale Processes
```bash
pkill -9 -f "vite" || true
pkill -9 -f "esbuild" || true
sleep 1
```

### 2. Clean Dependencies
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### 3. Verify Build
```bash
npm run build
```

### 4. Start Dev Server
```bash
npm run dev
```

## What Causes the Recurrent Issue

1. **Stale processes** — Previous dev server runs don't cleanly exit, blocking ports
2. **Corrupted node_modules** — npm cache or partially installed packages
3. **Broken aliases** — vite.config.ts trying to resolve non-existent modules (@core)
4. **Port conflicts** — Multiple processes competing for the same port (5173, 4000, etc.)

## Prevention Checklist

- ✅ Use `dev-server-clean.sh` if you ever have startup issues
- ✅ Always `Ctrl+C` the dev server cleanly when done
- ✅ Don't run multiple dev servers simultaneously
- ✅ Keep vite.config.ts aliases pointing to real, built modules
- ✅ Commit fixes to vite.config.ts and shims so future clones don't have the issue

## Current Fixes Already Applied

- ✅ Disabled broken `@core` alias in vite.config.ts
- ✅ Fixed `@core` import in src/client/api.ts to use dynamic import with string concat
- ✅ Commented out @core module shim in src/types/shims.d.ts

## Dev Server URLs

- **Local:** http://localhost:4000 (or 4002 if 4000 is in use)
- **Network:** http://172.20.10.3:4000

