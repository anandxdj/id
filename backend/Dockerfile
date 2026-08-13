# syntax=docker/dockerfile:1

# Pinned once and threaded through every stage. Tracks the Node major used by CI and
# local dev — bumping it here is the whole change.
ARG NODE_VERSION=22

# ── base ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS base
# pnpm resolves from the `packageManager` field, so the image cannot drift from the
# version the lockfile was written with.
RUN corepack enable
WORKDIR /app

# ── dependencies ─────────────────────────────────────────────────────────────
# Two installs from one lockfile. The full tree compiles TypeScript; the pruned tree is
# all that ships. This is cheaper than installing everything and pruning afterwards
# (a prune pass leaves dev packages in the layer below it), and both layers invalidate
# only when the manifest or lockfile changes.
#
# --ignore-scripts: no production dependency here needs a postinstall, so lifecycle
# scripts are pure supply-chain surface during an unattended build.
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# ── build ────────────────────────────────────────────────────────────────────
# Test files never enter the context (see .dockerignore), so dist/ holds runtime code
# only without a post-compile cleanup step.
FROM deps AS build
COPY . .
RUN pnpm build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

# tini is PID 1. Node as PID 1 neither reaps orphaned children nor gets the default
# signal dispositions, and the app's graceful shutdown — drain in-flight requests, close
# Mongo and Redis — only runs if SIGTERM actually arrives. Without this, every deploy
# severs live requests, which is the exact bug that shutdown path exists to prevent.
RUN apk add --no-cache tini

ARG PORT=4000
ENV NODE_ENV=production \
    PORT=${PORT}

WORKDIR /app

# uid 1000 `node` ships with the image. Ownership is set during COPY so the runtime user
# never needs write access to anything it did not bring with it.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

USER node

EXPOSE ${PORT}

# Liveness only. /ready deliberately checks Mongo, and wiring that in here would let a
# database blip restart processes that are serving fine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/health`).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# Exec form on both lines: shell form would make /bin/sh PID 1, and it forwards nothing.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
