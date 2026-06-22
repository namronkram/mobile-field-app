#!/bin/bash
# Fix + run Expo in managed mode (no native build)

cd /Users/normangordon/mobile-field-app

# Stop any running Expo
pkill -f "expo start" 2>/dev/null

# Remove broken prebuild artifacts
rm -rf ios android

# Clear all caches
rm -rf .expo .metro node_modules/.cache

# Reinstall deps (clean)
npm install --legacy-peer-deps

# Start Expo in managed mode
echo ""
echo "========================================="
echo "Expo starting in managed mode..."
echo "Press 'i' when you see the QR code"
echo "========================================="
echo ""

npx expo start --clear
