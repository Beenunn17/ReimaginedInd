# Stage 1: Build the React application
FROM node:20-alpine AS build

# Accept the API URL as a build argument from the GitHub Actions workflow
ARG VITE_API_BASE_URL

# --- DEBUGGING STEP ---
# This will print the value of the variable to the build logs.
# If it shows as empty, the GitHub secret is not set correctly.
RUN echo "The API URL passed to the build is: [${VITE_API_BASE_URL}]"

# Fail the build if the secret is missing or empty
RUN if [ -z "${VITE_API_BASE_URL}" ]; then echo "Error: VITE_API_BASE_URL is not set. Please check your GitHub repository secrets." && exit 1; fi

WORKDIR /app

# Create the .env.production file that Vite will use for the build
RUN echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > .env.production

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the built application with NGINX
FROM nginx:1.25-alpine

# Copy the static files from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the custom NGINX configuration to support single-page app routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose the port Cloud Run expects
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
