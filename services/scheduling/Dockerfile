# Build context is the repository root (see docker-compose.yml).
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --no-frozen-lockfile
# Build this service together with its workspace dependencies, in order.
RUN pnpm --filter "@learn-and-build/scheduling-service..." run build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3004
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/services/scheduling
EXPOSE 3004
CMD ["node", "dist/main.js"]
