# syntax=docker/dockerfile:1.6

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Install dependencies
COPY astra-web-client/package.json astra-web-client/package-lock.json ./
RUN npm ci

# Copy sources
COPY astra-web-client ./

# Build-time configuration (optional overrides via --build-arg)
ARG VITE_API_BASE_URL=/api
ARG VITE_ADMIN_BASE_URL=/admin
ARG VITE_WS_BASE_URL=
ARG VITE_DEBUG_LOGS=false

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_ADMIN_BASE_URL=${VITE_ADMIN_BASE_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}
ENV VITE_DEBUG_LOGS=${VITE_DEBUG_LOGS}
ENV NODE_ENV=production

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY deploy/astra-web-client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
