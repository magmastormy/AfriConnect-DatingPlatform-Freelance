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
# On managed Postgres (Aiven) the 20260822 provision_rls_app_role migration
# fails with `permission denied to alter role` when the deploy user is not a
# superuser. The migration is now wrapped to be Aiven-safe, but the previous
# failed run is still recorded as `failed` in _prisma_migrations (P3009) and
# blocks `migrate deploy` until it is resolved. Auto-resolve it as rolled back
# so the fixed migration can be retried; the `|| true` keeps the container
# bootable even if the DB is temporarily unreachable.
CMD ["sh", "-c", "pnpm --filter @africonnect/api exec prisma migrate resolve --rolled-back \"20260822000000_provision_rls_app_role\" || true; pnpm --filter @africonnect/api exec prisma migrate deploy || true; node packages/api/dist/server.js"]
