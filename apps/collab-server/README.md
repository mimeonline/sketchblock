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

Redis and horizontal scaling are outside the current `0.2.0` scope.

Canvas snapshot writers should send `baseRevision`, including `0` for a session without a snapshot. The store checks that revision while holding a transaction-scoped session lock. A stale write receives `{ ok: false, error: "snapshot_conflict", snapshot }` with the current snapshot and creates no snapshot audit event. Clients refresh their revision and preserve local Yjs edits; they must not retry the rejected full payload blindly. Legacy clients that omit the revision retain serialized last-write-wins behavior.

During a live editor session, the merged Yjs document owns editable scene state. Full snapshots provide seeds and durable checkpoints. Reconnect checkpoints merge into the existing document, retaining unacknowledged local edits. The browser consolidates outgoing updates into one buffer until acknowledged, replays it after joining, and retries transport failures with capped backoff. That buffer lives in the loaded browser session; closing the tab does not preserve it. The registry shares one initial document load, returns current in-memory state on join, serializes persistence, and skips older snapshot mirrors. PostgreSQL merges persisted Yjs updates so concurrent full-state persistence retains both clients' operations. Presence and realtime broadcasts still require a single collaboration server process.

The default suite exercises multi-client Socket.IO polling, viewer permissions, stale-write rejection, actor identity, and reconnect state. Real PostgreSQL concurrency tests are opt-in with `SKETCHBLOCK_TEST_DATABASE_URL` pointing at an isolated database migrated with the collab Flyway schema. They create unique test sessions and remove only those sessions afterward.
