# Third-party notices

## Xiangqi board and pieces

The assets in `client/public/xiangqi/gmchess-wood/` are the **gmchess style wood
piece set and board** from
[`Kadagaden/chess-pieces`](https://github.com/Kadagaden/chess-pieces), licensed
under **Creative Commons Attribution 4.0 International (CC BY 4.0)**. A copy of
the license is included beside the assets as `LICENSE.txt`.

## Xiangqi rules library

The API uses [`lengyanyu258/xiangqi.js`](https://github.com/lengyanyu258/xiangqi.js)
at commit `f9019ac2303d4b80ef0b82fd0515bfb55a80a62b`, licensed under the
**BSD 2-Clause License**. The package and its license are installed through the
locked API dependency.

## Endgame positions

The initial MVP catalog was selected from `endgames_all.json` in
[`dffge552/xiangqi-pwa-offline`](https://github.com/dffge552/xiangqi-pwa-offline).
The imported records retain their source classification and first suggested
move; gameplay after that move is generated dynamically by the NPC engine.
The source project is licensed under the **MIT License**; its license is kept
at `api/data/xiangqi/LICENSE-source.txt`.

## Hall (`/hall`) assets

Assets live in `client/public/models/hall/` and `client/public/audio/hall/`. The
source attribution file is kept unchanged beside them as `ATTRIBUTION.md`, and
the original per-file notes as `client/public/audio/hall/*.license.txt`. The
in-app link is "Nguồn hình ảnh và âm thanh" on the `/hall` page.

### Có giấy phép rõ ràng — bắt buộc ghi công

**Tượng Phật và hai Bồ Tát** — `models/buddha.glb`, `models/avalokitesvara.glb`,
`models/mahastamaprapta.glb`

> Hình tượng dựng từ bản số hoá của Bảo tàng Quốc gia Hàn Quốc: 금동불좌상 (tượng Phật ngồi)
> và 금동보살입상 (덕수2116). Giấy phép 공공누리 제1유형 (KOGL Type 1) — được dùng, kể cả thương mại,
> với điều kiện ghi nguồn. Đã điều chỉnh kích thước, texture và nén cho web. Cách bài trí hai vị
> Bồ Tát hai bên là bố cục của bản dựng này.

**Tiếng tụng kinh** — `audio/hall/temple-chant-review-v1.mp3`

> 염불소리1 · 김용배 · 한국저작권위원회 공유마당 · CC BY 4.0
> https://creativecommons.org/licenses/by/4.0/
> Đã chỉnh: giữ nguyên toàn bộ đoạn thu, encode mono MP3 112 kbps/48 kHz, chuẩn hoá âm lượng
> 2-pass loudnorm về khoảng -20 LUFS, true peak dưới -2 dBTP, bỏ metadata của bản encode.
> Không đổi thứ tự, tốc độ, cao độ; không cắt giữa câu; không khử ồn mạnh.

**Tiếng mõ** — `models/hall/moktak-*.webp` + file âm thanh mõ

> 목탁2 · 김용배 · 한국저작권위원회 공유마당 · CC BY 4.0
> https://creativecommons.org/licenses/by/4.0/
> Đã chỉnh: trích một tiếng gõ, chuyển mono, chuẩn hoá âm lượng, fade hai đầu.

The kit does not currently include the moktak audio file itself (only
`moktak-natural.license.txt`); the page synthesises its knock with Web Audio.

### Chưa xác định được giấy phép

These files have **no** accompanying licence. They are not public domain and
not declared free; their status is "chưa xác định" (undetermined).

- `monk.glb`, `monk-remote-lod.glb` — nhân vật. **No longer shipped:** the files were removed from
  `client/public/models/hall/`; the hall character is now built in code for Musicque
  (`client/src/three/hall/chibi.js`), so it carries no third-party licence.
- `materials/**` — 21 texture PBR
- `models/pine.glb` — cây thông
- `altar-devotion.jpg`, `altar-wall-calm-20261102.jpg`, `environment/woodland.jpg`
- `audio/hall/moonlight/*.mp3` — 4 bản nhạc (and their cover images)

Trạng thái: dùng nội bộ, chưa phát hành công khai. Trước khi đưa lên production cần thay bằng
asset có giấy phép hoặc tự dựng lại.
