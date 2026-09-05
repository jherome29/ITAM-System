# syntax=docker/dockerfile:1
#
# Build context = REPO ROOT (not Frontend/). npm-workspaces monorepo: the
# frontend imports packages/shared, so it must sit beside Frontend/ in the image.
# NEXT_PUBLIC_* values are inlined by `next build`, so the browser API URL must be
# supplied as a build arg, not a runtime env.
#
#   docker build -f Frontend/Dockerfile --target production \
#     --build-arg NEXT_PUBLIC_API_URL=https://aimrs.example/api -t aimrs-frontend .

# ── deps: workspace node_modules from the root lockfile ────────────────────
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY Backend/package.json ./Backend/
COPY Frontend/package.json ./Frontend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=frontend --include-workspace-root

# ── builder: next build -> Frontend/.next ─────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY Frontend ./Frontend
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_NAME=AIMRS
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
RUN npm run build --workspace=frontend

# ── development: source + full deps, next dev ─────────────────────────────
FROM node:22-alpine AS development
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared ./packages/shared
COPY Frontend ./Frontend
WORKDIR /repo/Frontend
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── production: .next + node_modules, next start, non-root ─────────────────
FROM node:22-alpine AS production
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json ./
COPY Frontend/package.json ./Frontend/package.json
COPY Frontend/next.config.ts ./Frontend/next.config.ts
COPY Frontend/public ./Frontend/public
COPY --from=builder /repo/Frontend/.next ./Frontend/.next
USER nextjs
WORKDIR /repo/Frontend
EXPOSE 3000
CMD ["npm", "start"]
