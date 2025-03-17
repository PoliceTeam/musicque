FROM node:20-alpine as build

# Tạo thư mục làm việc
WORKDIR /usr/src/app

# Copy package.json và package-lock.json
COPY package*.json ./

# Cài đặt dependencies
# Thêm --legacy-peer-deps để tránh các vấn đề về phiên bản
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Tạo file .env cho build
RUN echo "VITE_API_URL=http://localhost" > .env
RUN echo "VITE_SOCKET_URL=http://localhost" >> .env

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