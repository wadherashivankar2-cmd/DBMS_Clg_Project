# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

RUN npm install

COPY apps/api ./apps/api
COPY tsconfig.json ./

WORKDIR /usr/src/app/apps/api
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

RUN npm install --omit=dev

COPY --from=builder /usr/src/app/apps/api/dist ./apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/src/main.js"]
