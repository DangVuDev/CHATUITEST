# Stage 1: Build the application
FROM node:16 AS build
WORKDIR /app

# Copy package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install

# Copy mã nguồn và build dự án
COPY . .
RUN npm run build

# Stage 2: Serve static files using Nginx
FROM nginx:alpine
# Copy build output từ stage 1 sang thư mục Nginx
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
