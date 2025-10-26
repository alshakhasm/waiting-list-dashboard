#!/bin/bash
# Radical clean dev server restart script
# Prevents the recurrent issue of stale processes, corrupted node_modules, and broken builds

set -e

echo "========================================="
echo "🧹 Cleaning up stale processes..."
echo "========================================="
pkill -9 -f "vite --host" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "esbuild" 2>/dev/null || true
pkill -9 -f "node.*ui" 2>/dev/null || true
sleep 1
echo "✓ Processes cleaned"

echo ""
echo "========================================="
echo "📦 Clearing npm cache and reinstalling..."
echo "========================================="
rm -rf node_modules package-lock.json 2>/dev/null || true
npm cache clean --force --silent
npm install
echo "✓ Dependencies fresh"

echo ""
echo "========================================="
echo "🔨 Building to verify compilation..."
echo "========================================="
npm run build > /dev/null 2>&1
echo "✓ Build verified"

echo ""
echo "========================================="
echo "🚀 Starting clean dev server..."
echo "========================================="
npm run dev

