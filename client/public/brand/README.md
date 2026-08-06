# Bộ nhận diện Musicque

SVG trong thư mục này là **nguồn duy nhất**. Sửa logo thì sửa SVG rồi chạy
`scripts/build-brand-assets.sh` để sinh lại PNG — đừng sửa tay file PNG.

| File | Dùng ở đâu |
|---|---|
| `favicon.svg` | Favicon, icon app trong sidebar, icon trong manifest |
| `politetech-mark.svg` | Dấu hiệu Politetech nằm giữa icon — **bản dựng lại**, xem mục cuối |
| `logo-wordmark.svg` | Chỉ chữ MUSICQUE — dùng khi đã có icon ở gần |
| `logo-lockup.svg` | Icon + chữ nằm ngang — header, ảnh social, README |
| `logo-full.svg` | Khoá logo dọc đầy đủ — màn hình chờ, slide, ảnh chia sẻ |
| `icon-192.png`, `icon-512.png` | Web app manifest (Android/Chrome không nhận SVG) |
| `og-image.png` | Ảnh xem trước khi chia sẻ link |
| `../apple-touch-icon.png` | Safari iOS (không nhận SVG) |

## Ba điều đừng làm hỏng

**1. Chữ phải dùng toạ độ tuyệt đối, không bọc từng chữ trong `transform`.**
Gradient là `gradientUnits="userSpaceOnUse"` trải từ `x=0` đến `x=928` — đúng
bề ngang wordmark. `userSpaceOnUse` được tính trong hệ toạ độ của phần tử tham
chiếu nó, nên bọc mỗi chữ một `translate` là mỗi chữ tự nhận gradient trong hệ
toạ độ riêng và chỉ lấy được lát màu đầu dải: cả từ mất sạch cầu vồng, chỉ còn
tím. Gói **cả cụm** trong một `<g transform>` chung thì vẫn đúng — đó là cách
`logo-lockup.svg` thu nhỏ chữ.

**2. Khoảng cách chữ là khoảng cách thị giác, không phải hình học.** Cạnh tròn
(S, C, Q) hụt sáng ở mép nên đứng sát hơn cạnh thẳng: 24 cho thẳng|thẳng, 18
cho thẳng|tròn, 12 cho cặp tròn|tròn (C|Q). Đặt đều 24 hết thì "MUSIC" và
"QUE" trông như hai từ rời nhau.

**3. `favicon.svg` không phải bản thu nhỏ của logo.** Nó được vẽ lại riêng cho
kích thước nhỏ: nét càng tai dày hơn, chụp tai to hơn, bỏ hẳn dải sóng âm. Tile
sẫm cũng không phải trang trí — nó là thứ duy nhất giữ cho icon còn hình khối
nhận ra được ở 16px trên cả tab sáng lẫn tab tối. Đĩa trắng ở giữa cũng vậy:
dấu hiệu Politetech gồm bốn màu bão hoà, đặt thẳng lên tile sẫm là bốn nhánh
dính vào nền.

## Giới hạn đã đo ở cỡ nhỏ

Đo trực tiếp trên trình duyệt ở 16 / 24 / 32 / 34 / 48 / 64 / 96px:

| Cỡ | Đọc được gì |
|---|---|
| 96px, 64px, 48px | Rõ cả bốn ngoặc lẫn bốn chấm |
| 34px (icon sidebar) | Thấy hình chữ thập bốn màu, chi tiết ngoặc thì nhoè |
| 32px, 24px (tab trình duyệt) | Còn phân biệt được bốn ô màu |
| 16px | Chỉ còn một đốm nhiều màu trên đĩa trắng |

Bóng tổng thể của icon (tile sẫm + vòng cầu vồng + đĩa trắng) vẫn nhận ra được
ở 16px nên favicon không hỏng. Chiều đặt ngoặc có ảnh hưởng thật tới độ rõ:
bản dựng sai chiều lúc đầu (khuỷu quay ra rìa) mất hình sớm hơn một nấc, vì
bốn khuỷu dồn vào giữa thành một khối đặc. Bản đúng chiều toả ngoặc ra ngoài
nên bốn ô màu tách nhau lâu hơn.

## Bảng màu

Dải cầu vồng của wordmark:

```
#7B3FE4  #D93A8B  #EA4335  #F58220  #FBBC05  #34A853  #12A0AE  #4285F4
```

Tile icon `#17181C`. Bốn màu Politetech (`#4285F4` `#34A853` `#EA4335` `#FBBC05`)
nằm trong dải trên nên hai hệ nhận diện vẫn đứng cạnh nhau được.

## Dấu hiệu Politetech

`politetech-mark.svg` được dựng lại theo ảnh chụp bản gốc, đúng cấu trúc:
**khuỷu ngoặc quay vào tâm, hai tay vươn ra rìa, chấm ở góc ngoài**. Đây là
chỗ dễ dựng ngược nhất — bản đầu tiên của repo làm ngược đúng chiều đó và vẫn
trông "hợp lý" nên không tự phát hiện được, phải đối chiếu ảnh gốc mới thấy.

Hình học đã khớp; riêng **mã màu vẫn là lấy bằng mắt từ ảnh** nên có thể lệch
vài đơn vị so với bảng màu chính thức. Có file gốc thì thay ở ba chỗ, nội dung
giống hệt nhau:

1. `politetech-mark.svg` — thay cả file
2. `favicon.svg` — khối `<g id="politetech">`
3. `logo-lockup.svg` — khối trong icon, đã chú thích sẵn

Xong thì chạy lại `scripts/build-brand-assets.sh` để PNG bám theo.
