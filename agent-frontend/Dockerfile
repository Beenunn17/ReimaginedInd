# Stage 1: Build the React application with Vite
FROM node:20-alpine AS build

# This line tells Docker to expect a build-time variable named VITE_API_BASE_URL
ARG VITE_API_BASE_URL

WORKDIR /app

# This command creates the .env.production file inside the Docker container
# It ensures the production build uses the correct API URL from your GitHub Secret
RUN echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > .env.production

# Copy dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve the production build with NGINX
FROM nginx:1.25-alpine

# Copy built frontend from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Use custom NGINX config to serve on port 8080 and support SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run expects the container to listen on port 8080
EXPOSE 8080

# Run NGINX in the foreground
CMD ["nginx", "-g", "daemon off;"]
