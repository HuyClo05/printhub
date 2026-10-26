FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN echo "Installing frontend npm dependencies..." && npm ci --no-audit --no-fund --loglevel=notice

COPY . .

ARG VITE_API_URL=/api/v1
ARG VITE_OIDC_ISSUER
ARG VITE_OIDC_AUTH_URL
ARG VITE_OIDC_TOKEN_URL
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_REDIRECT_URI
ARG VITE_OIDC_SCOPE

ENV VITE_API_URL=$VITE_API_URL \
    VITE_OIDC_ISSUER=$VITE_OIDC_ISSUER \
    VITE_OIDC_AUTH_URL=$VITE_OIDC_AUTH_URL \
    VITE_OIDC_TOKEN_URL=$VITE_OIDC_TOKEN_URL \
    VITE_OIDC_CLIENT_ID=$VITE_OIDC_CLIENT_ID \
    VITE_OIDC_REDIRECT_URI=$VITE_OIDC_REDIRECT_URI \
    VITE_OIDC_SCOPE=$VITE_OIDC_SCOPE

RUN echo "Building the React frontend..." && npm run build

FROM caddy:2.10-alpine
COPY --from=build /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile
