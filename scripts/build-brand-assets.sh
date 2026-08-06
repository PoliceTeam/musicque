#!/usr/bin/env bash
#
# Xuất PNG từ bộ SVG thương hiệu.
#
# SVG là nguồn duy nhất — sửa logo thì sửa trong client/public/brand/*.svg rồi
# chạy lại script này, đừng sửa tay file PNG.
#
# PNG chỉ tồn tại vì hai chỗ không nhận SVG: apple-touch-icon của Safari iOS và
# icon trong web app manifest (Android/Chrome). Trình duyệt desktop dùng thẳng
# favicon.svg.
#
# Cần rsvg-convert:  brew install librsvg

set -euo pipefail

cd "$(dirname "$0")/.."
BRAND="client/public/brand"
OUT="client/public"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "Thiếu rsvg-convert. Cài bằng: brew install librsvg" >&2
  exit 1
fi

render() { # <nguồn> <kích thước> <đích>
  rsvg-convert -w "$2" -h "$2" "$1" -o "$3"
  echo "  $3 (${2}px)"
}

echo "Xuất icon:"
render "$BRAND/favicon.svg" 180 "$OUT/apple-touch-icon.png"
render "$BRAND/favicon.svg" 192 "$OUT/brand/icon-192.png"
render "$BRAND/favicon.svg" 512 "$OUT/brand/icon-512.png"

echo "Xuất ảnh chia sẻ mạng xã hội:"
rsvg-convert -w 1200 "$BRAND/logo-full.svg" -o "$OUT/brand/og-image.png"
echo "  $OUT/brand/og-image.png (1200px)"

echo "Xong."
