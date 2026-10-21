#!/bin/bash
# Chạy tại repo trên server; không SSH, không sửa volume hoặc dịch vụ project khác.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f docker-compose.prod.yml)
[[ ! -f .env.prod ]] || COMPOSE+=(--env-file .env.prod)
[[ -f docker-compose.prod.yml ]] || { echo 'Thiếu docker-compose.prod.yml trên server'; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Cây git chưa sạch; dừng deploy'; exit 1; }
# Compose production phải khai báo image: musicque-api:latest và musicque-client:latest.
# `config --images <service>` lists every image on Compose v2.32, so read the per-service image from JSON;
# without an explicit `image:` Compose names builds `<project>-<service>` (tag latest).
# The resolved config contains secrets: pipe it through stdin, never argv (visible in the process list).
for service in api client; do
  expected="musicque-$service:latest"
  actual=$("${COMPOSE[@]}" config --format json | python3 -c 'import json,sys
config = json.load(sys.stdin); service = sys.argv[1]
image = config["services"][service].get("image") or "{}-{}".format(config["name"], service)
print(image if ":" in image.rsplit("/", 1)[-1] else image + ":latest")' "$service")
  [[ "$actual" == "$expected" ]] || { echo "Compose phải dùng image $expected; dừng trước recreate"; exit 1; }
done
case "${1:-}" in
  --rollback)
    # Kiểm tra đủ cả hai bản trước khi thay bất kỳ tag nào.
    ROLLBACKS=()
    for repository in musicque-api musicque-client; do
      reference=$(docker image ls --format '{{.Repository}}:{{.Tag}}' "$repository" | LC_ALL=C sort -r | sed -n "/^$repository:rollback-/p" | head -1)
      [[ -n "$reference" ]] || { echo "Thiếu rollback: $repository"; exit 1; }
      docker image inspect "$reference" >/dev/null
      ROLLBACKS+=("$reference")
    done
    docker tag "${ROLLBACKS[0]}" musicque-api:latest
    docker tag "${ROLLBACKS[1]}" musicque-client:latest
    ;;
  '')
    STAMP=$(date -u +%Y%m%d%H%M%S)
    for repository in musicque-api musicque-client; do
      if docker image inspect "$repository:latest" >/dev/null 2>&1; then
        docker tag "$repository:latest" "$repository:rollback-$STAMP"
      fi
    done
    git fetch origin main
    if [[ -n "${EXPECTED_DEPLOY_SHA:-}" && "$(git rev-parse refs/remotes/origin/main)" != "$EXPECTED_DEPLOY_SHA" ]]; then
      echo 'origin/main đã đổi; chạy lại từ local để xác minh HEAD'; exit 1
    fi
    [[ "$(git branch --show-current)" == main ]] || { echo 'Server phải ở nhánh main'; exit 1; }
    git pull --ff-only origin main
    [[ -z "${EXPECTED_DEPLOY_SHA:-}" || "$(git rev-parse HEAD)" == "$EXPECTED_DEPLOY_SHA" ]] || {
      echo 'HEAD server không khớp bản đã kiểm tra; dừng trước build'; exit 1;
    }
    "${COMPOSE[@]}" build api client
    ;;
  *) echo 'Cách dùng: bash scripts/deploy-prod.sh [--rollback]'; exit 1 ;;
esac
"${COMPOSE[@]}" up -d --no-build --force-recreate api client
API_ID=$("${COMPOSE[@]}" ps -q api)
[[ -n "$API_ID" ]] || { echo 'Không tìm thấy container API'; exit 1; }
HEALTHY=false
for attempt in {1..90}; do
  state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$API_ID")
  if [[ "$state" == healthy ]]; then HEALTHY=true; break; fi
  if [[ "$state" == unhealthy || "$state" == missing ]]; then break; fi
  sleep 2
done
[[ "$HEALTHY" == true ]] || { echo 'API chưa healthy; giữ image để điều tra/rollback'; exit 1; }
# Rollback không dọn để tránh mất phiên bản phục hồi đang dùng.
if [[ "${1:-}" != --rollback ]]; then bash scripts/prune-prod-images.sh; fi
echo 'Không prune build cache dùng chung. Chỉ dọn cache >7 ngày sau khi xác minh builder riêng cho Musicque.'
"${COMPOSE[@]}" ps
