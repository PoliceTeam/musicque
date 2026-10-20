# SSO với form trong Musicque

Tài khoản lưu tại Keycloak 26.8.1 realm `sso`. Form đăng nhập/đăng ký/quên mật khẩu nằm trong Musicque;
menu user dùng lại ChangePasswordModal và có mục Farm. Khách bấm Farm sẽ mở modal đăng nhập.
Không có popup SSO hoặc đoạn giới thiệu tài khoản chung. Route `/api/auth/sso` và callback vẫn giữ cho đăng nhập web/broker tương lai.

## Môi trường backend

Xem `api/.env.sso.example` và biến SSO trong docker-compose*.yml:

- SSO_ISSUER, SSO_CLIENT_ID, SSO_CLIENT_SECRET (client confidential `musicque`).
- SSO_REDIRECT_URI (callback), SSO_WEB_ORIGIN (origin web).
- SSO_TOKEN_KEY: khóa AES-256-GCM riêng backend, 32 byte ngẫu nhiên dạng hex 64 ký tự.
- SSO_HANDOFF_TARGETS: `musicque-farm=https://farm.example/api/auth/handoff/accept`; phân cách nhiều mục bằng dấu phẩy.
- SSO_ADMIN_URL: URL Keycloak nội bộ cho Admin REST (đăng ký, quên/đổi mật khẩu), vd `http://sso:8080/sso` qua network Docker; production chặn `/sso/admin` từ Internet.
- SSO_HANDOFF_ORIGINS: web origin đối tác được POST bàn giao vào Musicque (ví dụ origin Farm); thiếu/sai Origin bị từ chối.

Secret/key không đưa vào VITE hoặc log. Không cấu hình SSO thì auth cục bộ/JWT vẫn dùng như trước.
Có SSO thì chỉ cookie opaque `musicque_session` xác thực; **không nhận bearer JWT** ở HTTP/socket.
Cookie HttpOnly, SameSite=Lax, Secure ở production; dữ liệu session Mongo có TTL 8 giờ.

## API

- POST `/api/auth/login`: `{username,password}`. Password grant `openid profile` qua openid-client v6,
  xác minh chữ ký/iss/aud/exp ID token; cấp cookie app, trả user public, không JWT/Keycloak token.
- POST `/api/auth/register`: `{username,password,displayName,email?}`. Service account gọi Admin REST tạo user,
  firstName=displayName, mật khẩu non-temporary, rồi đăng nhập. Trùng username/email → 409, không hợp lệ → 400;
  password policy/user profile do Keycloak áp. Không claim hay gộp user cục bộ dựa trên username/email.
- POST `/api/auth/forgot-password`: `{identifier}` username hoặc email. Trả `{ok:true}` chung; nếu user có email,
  yêu cầu execute-actions-email UPDATE_PASSWORD về web. Chưa SMTP vẫn trả chung, cảnh báo không chứa user.
- PATCH `/api/auth/me/password`: `{currentPassword,newPassword}`; session + Origin, password grant xác minh mật khẩu cũ,
  reset-password qua Admin REST. Modal đổi mật khẩu hiện có gọi đúng endpoint này.
- POST `/api/auth/handoff`: `{target}`; session + Origin. Làm mới token server, exchange audience target, trả `{url,token}`.
- POST `/api/auth/handoff/accept`: form-urlencoded `{token}`; verify JWT qua JWKS, iss/aud/azp tin cậy,
  exp/iat ngắn (60 giây), jti unique một lần trong ssohandoffs (TTL); exchange lấy refresh bằng chính client Musicque,
  map `(iss,sub)`, tạo cookie rồi redirect về web. Lỗi về `?auth=handoff-failed`, mở form đăng nhập.

UI gửi token bằng form ẩn top-level POST; token không nằm URL. CORS chỉ được bỏ qua tại POST accept
để nhận điều hướng form từ origin khác; token vẫn được kiểm đầy đủ. Không chia sẻ cookie giữa Farm/Musicque,
chạy được cả cùng origin và tên miền khác. URL đích chỉ lấy từ env, không redirect tùy ý.
Refresh token gốc mã hóa at-rest trong ssosessions; lease Mongo serialize refresh, token gốc không ra browser.
findUser giữ user cũ qua `(iss,sub)`, nhận username Keycloak nếu hợp lệ/chưa trùng, còn lại fallback `sso_<hash>`.

## Keycloak và mở rộng

Nguồn cấu hình ở `musicque-farm/apps/sso/clients.json` và sync-realm.mjs. Service account chỉ có
realm-management manage-users, view-users, query-users. Direct access grants + Standard Token Exchange V2,
`standard.token.exchange.enableRefreshRequestedTokenType=SAME_SESSION`, audience mapper đối tác, access token 60 giây.
Dùng online refresh với realm idle 30 ngày/max 90 ngày: Keycloak V2 không cấp refresh từ offline session.
Đăng xuất chỉ thu hồi session app và refresh material, không mở trang Keycloak.
SMTP/themes/plugin chibi-legacy nằm ở repo Farm. Hash bcrypt cũ tiếp tục xác minh qua password grant;
không thay mật khẩu cũ hoặc tự gộp user có cùng email.

Thêm nền tảng chỉ cấu hình clients.json/env và triển khai giao thức trong
`musicque-farm/docs/sso-integration.md`; không cần sửa mã Farm/Musicque.
Tham khảo [Keycloak token exchange](https://www.keycloak.org/securing-apps/token-exchange).

## Test

`npm --prefix api test`; `cd client && npx vitest run src/components/Auth`;
eslint những file sửa. Backend tests dùng provider giả, kiểm grant/admin/password/handoff/expiry/signature/replay và origin.
Khi test thật chỉ tạo user cx-, dọn Keycloak/Mongo/Farm theo chính ID fixture; không xóa volume/container/dữ liệu khác.
