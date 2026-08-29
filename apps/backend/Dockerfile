# Build context is the monorepo ROOT (not apps/backend) — see render.yaml.
# The backend consumes @torpreca/shared via bun's `workspace:*` protocol,
# which only resolves if `bun install` runs where the root package.json's
# `workspaces` array is visible, i.e. at the repo root.
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json

# --production skips devDependencies (husky, biome, @types/bun — unused at
# runtime); --ignore-scripts skips the root "prepare" (husky) lifecycle
# script, which fails here anyway since there's no .git in the build context.
RUN bun install --frozen-lockfile --production --ignore-scripts

COPY apps/backend apps/backend
COPY packages/shared packages/shared

WORKDIR /app/apps/backend

# Render injects its own PORT env var at runtime — apps/backend/src/core/config/env.ts
# reads it (default 3000 only applies if unset, e.g. local dev).
CMD ["bun", "src/index.ts"]