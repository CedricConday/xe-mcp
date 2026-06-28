FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime image
FROM node:22-alpine AS runtime

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# MCP server uses stdio — expose via health check port for ECS
EXPOSE 3001

ENV NODE_ENV=production

# Default: stdio MCP server (for local use via Claude Code)
CMD ["node", "dist/index.js"]
