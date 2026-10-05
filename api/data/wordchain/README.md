# Dữ liệu nối từ

`catalog.json` gồm 28.396 cụm hai tiếng, hợp nhất hai nguồn Kaikki/Wiktionary:

- 17.888 cụm từ catalog tiếng Việt trên **enwiktionary**, snapshot đã dùng ngày 2026-08-28.
- 10.508 cụm bổ sung từ **viwiktionary**, dump ngày 2026-09-01, trích xuất ngày 2026-10-03,
  tải ngày 2026-10-05. Nguồn này bổ sung những cụm phổ biến như “vụ án”.

Nguồn và giấy phép CC BY-SA 4.0 / GFDL được ghi tại `LICENSE-source.txt`.
Mục bổ sung có `source: 'kaikki-viwiktionary'`; mục cũ không có trường `source`
được hiểu là `kaikki-wiktionary` (enwiktionary).

Catalog chỉ giữ mục tiếng Việt gồm đúng hai tiếng, thuộc nhóm noun/verb/adj/adv/phrase
và có ít nhất một định nghĩa. Tên riêng, ký hiệu, phiên âm, mục không dấu cách và mục
không có nghĩa đã bị loại. File raw không nằm trong repository.

Tạo lại catalog từ snapshot mới:

```bash
cd api
npm run build:wordchain-catalog -- /path/to/kaikki-vietnamese.jsonl
npm run build:wordchain-catalog -- /path/to/kaikki-viwiktionary.jsonl --merge --source=kaikki-viwiktionary
```

`--merge` giữ các mục hiện có, thêm mục thiếu và tính lại số từ nối tiếp trên toàn bộ
catalog; chạy lại với cùng dữ liệu không tạo mục trùng.

Khi game khởi tạo sau mỗi lần server khởi động, catalog được đồng bộ idempotent vào
MongoDB collection `wordentries`, kể cả DB đã có từ điển cũ. Chỉ mục mới được thêm;
trạng thái kiểm duyệt và định nghĩa của mục hiện có được giữ nguyên, số từ nối tiếp
được cập nhật. Cần triển khai bản API mới và khởi động lại để dữ liệu mới được áp dụng.
`starter-words.json` chỉ là fallback nếu catalog rỗng.
