#!/bin/sh
# ルートの app.js を作り直す（Node.js が必要）
# 使い方: sh src/build.sh
set -e
cd "$(dirname "$0")/.."
npm i --no-save react react-dom esbuild
npx esbuild src/main.jsx --bundle --minify --jsx=automatic --format=iife \
  --target=safari15 --define:process.env.NODE_ENV='"production"' \
  --outfile=app.js --legal-comments=none
echo "app.js を更新しました。sw.js の VERSION も変えてください。"
