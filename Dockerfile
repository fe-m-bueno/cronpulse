FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install backend deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Install frontend deps
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./frontend/
RUN cd frontend && pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json tsup.config.ts biome.json ./
COPY src/ ./src/
COPY frontend/ ./frontend/

# Build backend then frontend
RUN pnpm build:backend
RUN cd frontend && pnpm build

# --- Production ---
FROM node:20-alpine AS production

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm install --frozen-lockfile --prod \
    && apk del python3 make g++

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV CRONPULSE_DOCKER=true
ENV CRONPULSE_PORT=7575

EXPOSE 7575

CMD ["node", "dist/cli.js", "--no-open"]
