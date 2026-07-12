FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG SKETCHBLOCK_VERSION=local
ARG NEXT_PUBLIC_COLLAB_SERVER_URL=http://localhost:4513
ENV NEXT_PUBLIC_SKETCHBLOCK_VERSION=${SKETCHBLOCK_VERSION}
ENV NEXT_PUBLIC_COLLAB_SERVER_URL=${NEXT_PUBLIC_COLLAB_SERVER_URL}
COPY . .
RUN pnpm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
