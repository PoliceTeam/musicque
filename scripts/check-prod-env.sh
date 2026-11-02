#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.prod.yml)
[[ ! -f .env.prod ]] || COMPOSE+=(--env-file .env.prod)
# Không để Compose in nội dung/giá trị env trong lỗi. Lỗi cấu hình chỉ báo chung.
"${COMPOSE[@]}" config --format json 2>/dev/null | python3 scripts/check-prod-env.py
