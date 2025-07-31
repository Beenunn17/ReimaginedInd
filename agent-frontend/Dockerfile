# Stage 1: Build the React application with Vite
FROM node:20-alpine as build

WORKDIR /app

# Copy dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve the production build with NGINX
FROM nginx:1.25-alpine

# Copy built frontend from previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Use custom NGINX config to serve on port 8080 and support SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run expects the container to listen on port 8080
EXPOSE 8080

# Run NGINX in the foreground
CMD ["nginx", "-g", "daemon off;"]