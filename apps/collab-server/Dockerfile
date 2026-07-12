FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV COLLAB_SERVER_PORT=4513
RUN addgroup -S collab && adduser -S collab -G collab
COPY --from=prod-deps --chown=collab:collab /app/node_modules ./node_modules
COPY --from=build --chown=collab:collab /app/dist ./dist
COPY --from=build --chown=collab:collab /app/package.json ./package.json
USER collab
EXPOSE 4513
CMD ["node", "dist/main.js"]
