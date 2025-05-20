FROM node:20.11-alpine as build

# Tạo thư mục làm việc
WORKDIR /usr/src/app

RUN npm install

# Copy source code
COPY . .

# Tạo file .env cho build
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
ENV NODE_ENV=production

# Build ứng dụng
RUN npm run build

# Stage 2: Sử dụng Nginx để phục vụ ứng dụng đã build
FROM nginx:alpine

# Copy build từ stage trước
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Copy cấu hình Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Mở port
EXPOSE 80

# Khởi động Nginx
CMD ["nginx", "-g", "daemon off;"] 