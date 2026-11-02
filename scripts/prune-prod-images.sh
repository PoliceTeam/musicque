#!/bin/bash
# Chỉ dọn image của project; giữ rollback mới nhất và mọi image có container tham chiếu.
set -euo pipefail
CONTAINERS=$(docker ps -aq)
USED_IMAGES=''
if [[ -n "$CONTAINERS" ]]; then
  USED_IMAGES=$(docker inspect --format '{{.Image}}' $CONTAINERS)
fi
in_use() {
  local id
  id=$(docker image inspect --format '{{.Id}}' "$1")
  [[ -n "$id" ]] || return 0
  while IFS= read -r used; do [[ "$used" != "$id" ]] || return 0; done <<< "$USED_IMAGES"
  return 1
}
for repository in musicque-api musicque-client; do
  REFERENCES=$(docker image ls --format '{{.Repository}}:{{.Tag}}' "$repository")
  ROLLBACKS=$(printf '%s\n' "$REFERENCES" | sed -n "/^$repository:rollback-/p" | LC_ALL=C sort -ru)
  KEEP=true
  while IFS= read -r reference; do
    [[ -n "$reference" ]] || continue
    if [[ "$KEEP" == true ]]; then KEEP=false; continue; fi
    if in_use "$reference"; then echo "Giữ image có container sử dụng: $reference"; continue; fi
    docker image rm "$reference"
  done <<< "$ROLLBACKS"
done
# Docker chỉ xóa dangling image không được container nào dùng, lọc đúng label project.
docker image prune --force --filter label=com.musicque.project=app
