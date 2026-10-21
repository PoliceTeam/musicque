#!/bin/bash
# Lối tắt vận hành từ máy local, không thay tooling của api/client.
set -euo pipefail
cd "$(dirname "$0")/.."
SERVER="${SERVER:-ptdevs@167.86.125.164}"
SSH_KEY="${SSH_KEY-$HOME/.ssh/police}"
REMOTE_DIR="${REMOTE_DIR:-/home/ptdevs/internal/musicque}"
[[ "$REMOTE_DIR" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo 'REMOTE_DIR không hợp lệ'; exit 1; }
SSH_OPTS=(-o ServerAliveInterval=15)
[[ -z "$SSH_KEY" ]] || SSH_OPTS+=(-i "$SSH_KEY")
case "${1:-}" in
  deploy)
    git fetch origin main
    [[ "$(git rev-parse HEAD)" == "$(git rev-parse refs/remotes/origin/main)" ]] || {
      echo 'Dừng deploy: local HEAD khác origin/main. Commit/push phần cần triển khai hoặc cập nhật local trước.'; exit 1;
    }
    # Chặn origin/main đổi giữa fetch local và pull server: script server kiểm SHA lần nữa.
    sha=$(git rev-parse HEAD)
    ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$REMOTE_DIR' && EXPECTED_DEPLOY_SHA='$sha' bash scripts/deploy-prod.sh"
    ;;
  rollback)
    ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$REMOTE_DIR' && bash scripts/deploy-prod.sh --rollback"
    ;;
  status)
    ssh "${SSH_OPTS[@]}" "$SERVER" 'set -euo pipefail; docker ps -a --filter name=music-order-; docker image ls --format "{{.Repository}}:{{.Tag}} {{.ID}}" | awk '\''$1 ~ /^musicque-(api|client):(latest|rollback-)/'\'
    for url in https://musicque.politetech.com/ https://musicque.politetech.com/api/auth/sso/status; do
      curl --fail --silent --show-error --location --max-time 30 --output /dev/null --write-out '%{http_code} %{url_effective}\n' "$url"
    done
    ;;
  logs)
    shift
    [[ "${1:-}" != -- ]] || shift
    service="${1:-api}"
    case "$service" in api|client) ;; *) echo 'Service: api|client'; exit 1 ;; esac
    ssh "${SSH_OPTS[@]}" "$SERVER" "docker logs --tail 100 'music-order-$service'"
    ;;
  env-check)
    ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$REMOTE_DIR' && bash scripts/check-prod-env.sh"
    ;;
  *) echo 'Cách dùng: remote.sh deploy|rollback|status|logs [api|client]|env-check'; exit 1 ;;
esac
