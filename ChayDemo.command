#!/bin/bash
# Bấm đúp file này (macOS) để chạy demo. Đóng cửa sổ Terminal để dừng.
cd "$(dirname "$0")/app" || exit 1
command -v node >/dev/null || { echo "Chưa cài Node.js: tải tại https://nodejs.org"; read -r; exit 1; }
[ -d node_modules ] || npm install
[ -d ../automation/node_modules ] || (cd ../automation && npm install)
[ -f .env ] || cp .env.example .env
if [ "$1" = "--reset" ] || [ ! -f data/app.db ]; then npm run reset; fi
(sleep 2; open "http://localhost:${PORT:-3000}") &
npm start
