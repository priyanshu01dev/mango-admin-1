# Mango Invoice: one container serves the API and the built web app.
# Build:  docker build -t mango-invoice --build-arg VITE_COMPANY_NAME="..." .
# Run:    docker run -p 4000:4000 --env-file .env.production mango-invoice

# ---------- build ----------
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# company details printed on the legal pages (baked into the web build)
ARG VITE_COMPANY_NAME=""
ARG VITE_COMPANY_ADDRESS=""
ARG VITE_SUPPORT_EMAIL=""
ARG VITE_SUPPORT_PHONE=""
ARG VITE_GRIEVANCE_OFFICER=""
ARG VITE_GRIEVANCE_EMAIL=""
ARG VITE_JURISDICTION_CITY=""
RUN npm run build && npm run server:build

# ---------- runtime ----------
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    STATIC_DIR=/app/dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/index.js"]
