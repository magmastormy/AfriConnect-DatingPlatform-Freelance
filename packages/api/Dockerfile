# ---- deps ----
FROM node:20-slim AS deps
ENV PNPM_HOME="/pnpm" && PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/api/package.json packages/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

# ---- build ----
FROM deps AS build
WORKDIR /app
COPY . .
ENV NODE_ENV=production
RUN pnpm --filter @africonnect/shared build \
 && pnpm --filter @africonnect/api exec prisma generate \
 && pnpm --filter @africonnect/api build

# ---- runtime ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
ENV PORT=4000
ENV PNPM_HOME="/pnpm" && PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml* ./
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/prisma ./packages/api/prisma
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Prisma client + engines are needed at runtime
RUN pnpm --filter @africonnect/api exec prisma generate || true

EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @africonnect/api exec prisma migrate deploy && node packages/api/dist/api/src/server.js"]
