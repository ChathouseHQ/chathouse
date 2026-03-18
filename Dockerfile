# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy workspace config and package files for dependency install
COPY package*.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/database/package.json packages/database/
COPY packages/database/prisma packages/database/prisma
COPY packages/database/prisma.config.ts packages/database/
RUN npm ci

# Copy source and build
COPY . .
RUN npx turbo build --filter=@chathouse/web --filter=@chathouse/worker

# Production stage
FROM node:24-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/database/package.json packages/database/
COPY packages/database/prisma packages/database/prisma
COPY packages/database/prisma.config.ts packages/database/
RUN npm ci --omit=dev

# Copy built assets and generated Prisma client
COPY --from=builder /app/apps/web/build apps/web/build
COPY --from=builder /app/apps/worker/dist apps/worker/dist
COPY --from=builder /app/packages/database/dist packages/database/dist
COPY --from=builder /app/packages/database/generated packages/database/generated

# Create data directory
RUN mkdir -p data/uploads

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start", "-w", "@chathouse/web"]
