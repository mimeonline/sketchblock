# Sketchblock Collaboration Server

The collaboration server is a NestJS and Socket.IO service for realtime presence, cursor updates, Excalidraw snapshots, and Yjs state.

It follows a hexagonal architecture: domain and application code remain independent of HTTP, Socket.IO, Postgres, and other infrastructure adapters.

## Local development

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

The server uses port 4513 by default. Its health endpoint is available at `http://localhost:4513/health`, and OpenAPI documentation is available at `http://localhost:4513/docs`.

## Quality gate

```bash
pnpm run check
```

This runs TypeScript, Vitest, the production build, and AsyncAPI validation.

## Persistence and security

Session lifecycle, snapshots, Yjs state, and audit events are stored in the configured Postgres collaboration database. Flyway migrations under `../../db/flyway/collab/sql` are the schema source of truth.

The web application issues short-lived signed collaboration tickets. The collaboration server validates those tickets and enforces session roles; it does not implement a separate user login flow.

Redis and horizontal scaling are outside the current `0.1.0` scope.
