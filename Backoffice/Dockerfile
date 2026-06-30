# ── Stage 1 : Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_API_URL=http://localhost:3000/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2 : Serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
# nginx.conf utilise ${PORT} : l'entrypoint officiel l'injecte au démarrage
# (templates → conf.d). PORT par défaut = 80 pour docker-compose ; Railway l'override.
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV PORT=80

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
