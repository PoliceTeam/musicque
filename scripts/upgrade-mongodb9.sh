#!/usr/bin/env bash
# Nâng volume FCV 8.2 qua 8.3 để chạy Mongo 9.0.2, giữ bản sao trước nâng cấp.
set -euo pipefail
cd "$(dirname "$0")/.."
compose_file="${1:-docker-compose.prod.yml}"
[[ -f "$compose_file" ]] || { echo "Không tìm thấy $compose_file" >&2; exit 1; }
compose=(docker compose -f "$compose_file")
mongo_id=$("${compose[@]}" ps -aq mongodb)
[[ -n "$mongo_id" ]] || { echo 'Không tìm thấy container Mongo hiện tại.' >&2; exit 1; }
backup_dir=$(mktemp -d "$PWD/../musicque-mongo-backup-XXXXXXXX")
echo "Dừng API và Mongo. Sao lưu dữ liệu vào: $backup_dir"
"${compose[@]}" stop -t 120 api mongodb
docker cp "$mongo_id:/data/db" "$backup_dir/"
[[ -s "$backup_dir/db/WiredTiger" ]] || { echo 'Bản sao dữ liệu không hợp lệ; dừng nâng cấp.' >&2; exit 1; }
echo 'Đã sao lưu. Giữ thư mục này để phục hồi nếu cần.'

mongo_eval() {
  docker exec "$mongo_id" sh -c '
    exec mongosh --quiet --host 127.0.0.1 --authenticationDatabase admin \
      --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" \
      --eval "$1"
  ' sh "$1"
}
start_mongo() {
  "${compose[@]}" build --pull --build-arg "MONGO_IMAGE=$1" mongodb
  "${compose[@]}" up -d --no-deps --force-recreate mongodb
  mongo_id=$("${compose[@]}" ps -aq mongodb)
  for ((attempt=0; attempt<60; attempt++)); do
    if mongo_eval 'if (db.adminCommand({ping:1}).ok !== 1) quit(1)' >/dev/null 2>&1; then return; fi
    sleep 2
  done
  echo 'Mongo chưa sẵn sàng; giữ API dừng. Kiểm tra log Mongo và bản sao dữ liệu.' >&2
  return 1
}

echo 'Chạy bản trung gian Mongo 8.3 để nâng FCV từ 8.2.'
start_mongo mongo:8.3
mongo_eval 'const f=db.adminCommand({getParameter:1,featureCompatibilityVersion:1}).featureCompatibilityVersion;
if (!["8.2","8.3"].includes(f.version) || f.targetVersion) throw new Error("FCV ngoài phạm vi nâng cấp hoặc đang chuyển đổi");
if (f.version === "8.2") {
  const r=db.adminCommand({setFeatureCompatibilityVersion:"8.3",confirm:true});
  if (r.ok !== 1) throw new Error(JSON.stringify(r));
}
printjson(db.adminCommand({getParameter:1,featureCompatibilityVersion:1}));'
"${compose[@]}" stop -t 120 mongodb
echo 'Chạy Mongo 9.0.2 với FCV 8.3 theo giai đoạn kiểm chứng của MongoDB.'
start_mongo mongo:9.0.2
mongo_eval 'if (!db.version().startsWith("9.0.")) throw new Error("Sai phiên bản Mongo");
const f=db.adminCommand({getParameter:1,featureCompatibilityVersion:1}).featureCompatibilityVersion;
if (f.version !== "8.3" || f.targetVersion) throw new Error("FCV không đúng sau nâng cấp");
printjson({version:db.version(),featureCompatibilityVersion:f});'
"${compose[@]}" up -d --no-deps api
echo "Đã chạy Mongo 9.0.2 và khởi động API. Bản sao dữ liệu: $backup_dir"
echo 'Kiểm tra log API và chức năng ứng dụng trước khi bật FCV 9.0.'
