# syntax=docker/dockerfile:1

# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN --mount=type=secret,id=DATABASE_URL \
	DATABASE_URL="$(cat /run/secrets/DATABASE_URL)" npx prisma generate

RUN npm run build

RUN npm prune --omit=dev

# Production stage
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/src/main.js"]