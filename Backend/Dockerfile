# syntax=docker/dockerfile:1
#
# Build context = REPO ROOT (not Backend/). This is an npm-workspaces monorepo:
# the backend imports packages/shared by relative path / @aimrs/shared alias, so
# packages/shared must sit beside Backend/ inside the image and node_modules must
# be installed from the single root lockfile.
#
#   docker build -f Backend/Dockerfile --target production -t aimrs-backend .

# ── builder: install workspace deps, compile Nest -> Backend/dist ───────────
FROM node:22-alpine AS builder
WORKDIR /repo
# bcrypt is a native addon and has no musl prebuild — needs a toolchain
RUN apk add --no-cache python3 make g++
# manifests first for a cacheable install layer
COPY package.json package-lock.json ./
COPY Backend/package.json ./Backend/
COPY Frontend/package.json ./Frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=backend --include-workspace-root
COPY packages/shared ./packages/shared
COPY Backend ./Backend
RUN npm run build --workspace=backend

# ── development: full deps + source, Nest watch mode ───────────────────────
FROM node:22-alpine AS development
WORKDIR /repo
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY Backend/package.json ./Backend/
COPY Frontend/package.json ./Frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=backend --include-workspace-root
COPY packages/shared ./packages/shared
COPY Backend ./Backend
WORKDIR /repo/Backend
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

# ── production: dist + prod deps only, non-root ────────────────────────────
FROM node:22-alpine AS production
WORKDIR /repo
ENV NODE_ENV=production
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
  && addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs
COPY package.json package-lock.json ./
COPY Backend/package.json ./Backend/
COPY Frontend/package.json ./Frontend/
COPY packages/shared/package.json ./packages/shared/
# webpack externalises bcrypt / pdfkit / pg / typeorm — they load from
# node_modules at runtime, so they must be in the prod install (all are
# runtime `dependencies`). --workspace scopes the install to the backend only.
RUN npm ci --omit=dev --workspace=backend --include-workspace-root \
  && npm cache clean --force && apk del .build-deps
# node_modules / dist are world-readable; the app writes nothing to disk
# (PDFs are buffered and stored in the DB), so no chown is needed.
COPY --from=builder /repo/Backend/dist ./Backend/dist
USER nestjs
WORKDIR /repo/Backend
EXPOSE 3001
CMD ["node", "dist/main.js"]
