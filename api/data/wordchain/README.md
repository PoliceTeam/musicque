# Dữ liệu nối từ

`catalog.json` được tạo từ bản Kaikki Vietnamese machine-readable dictionary ngày
2026-08-28. Nguồn Kaikki được trích xuất từ Wiktionary và phát hành theo CC BY-SA
4.0 / GFDL; xem `LICENSE-source.txt`.

Catalog chỉ giữ mục tiếng Việt gồm đúng hai tiếng, thuộc nhóm noun/verb/adj/adv/phrase
và có ít nhất một định nghĩa. Tên riêng, ký hiệu, phiên âm, mục không dấu cách và mục
không có nghĩa đã bị loại. File raw 75 MB không nằm trong repository.

Tạo lại catalog từ snapshot mới:

```bash
cd api
npm run build:wordchain-catalog -- /path/to/kaikki-vietnamese.jsonl
```

Khi server khởi động lần đầu, catalog được seed idempotent vào MongoDB collection
`wordentries`. `starter-words.json` chỉ là fallback nếu catalog không tồn tại.
