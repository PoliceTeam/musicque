FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package.json và package-lock.json
COPY package*.json ./

# Xóa node_modules nếu có
RUN rm -rf node_modules

# Cài đặt dependencies
RUN npm install

# Copy source code
COPY . .

# Mở port
EXPOSE 5000

# Khởi động ứng dụng
CMD ["npm", "start"] 