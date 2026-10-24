#!/bin/bash
# Chạy toàn bộ kiểm thử tự động: unit + API, E2E Playwright, Playwright mẫu trên Sauce Demo
cd "$(dirname "$0")/app" || exit 1
echo "=== 1. Unit + API test ===";              npm test 2>&1 | grep -E "^# (tests|pass|fail)"
echo "=== 2. E2E Playwright (hệ thống) ===";    npm run test:e2e 2>&1 | grep -E "passed|failed|✘"
echo "=== 3. Playwright mẫu (Sauce Demo) ===";  (cd ../automation && npx playwright test specs/samples 2>&1 | grep -E "passed|failed|✘")
echo "Xong. Nhấn Enter để đóng."; read -r
