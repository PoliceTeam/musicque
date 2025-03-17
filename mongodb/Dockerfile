FROM mongo:latest

# Tạo thư mục cho dữ liệu và scripts
RUN mkdir -p /docker-entrypoint-initdb.d /data/db

# Copy script khởi tạo database
COPY init-mongo.js /docker-entrypoint-initdb.d/

# Thiết lập quyền
RUN chmod +x /docker-entrypoint-initdb.d/init-mongo.js

# Mở port mặc định của MongoDB
EXPOSE 27017

# Thiết lập volume cho dữ liệu
VOLUME ["/data/db"]

# Sử dụng CMD mặc định từ image mongo 