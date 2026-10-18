# ==============================================================================
# STAGE 1: Build React 19 + TypeScript + Tailwind CSS v4 Static Bundle
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Cache package dependencies
COPY package.json ./
RUN npm install

# Build static bundle
COPY . .
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# ==============================================================================
# STAGE 2: High-Performance Lightweight Nginx Web Server
# ==============================================================================
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled static assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy optimized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
