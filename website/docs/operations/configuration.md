# Configuration

Copy `.env.compose.example` to `.env` when you need to customize the defaults. `scripts/start.sh` creates the file automatically for a fresh demo installation and generates a random authentication secret.

Key settings include:

| Variable | Purpose |
| --- | --- |
| `SKETCHBLOCK_AUTH_MODE` | `demo`, `dev`, or `github` |
| `SKETCHBLOCK_WEB_PORT` | Published web port, default `4512` |
| `SKETCHBLOCK_COLLAB_PORT` | Published collaboration port, default `4513` |
| `APP_AUTH_SECRET` | Signs app sessions and collaboration tickets |
| `POSTGRES_PASSWORD` | Local Postgres password |
| `GITHUB_OAUTH_CLIENT_ID` | Required in GitHub mode |
| `GITHUB_OAUTH_CLIENT_SECRET` | Required in GitHub mode |

Do not commit `.env`.

## Single-instance operation

Run exactly one web and one collaboration-server instance per deployment. Session presence, live Yjs documents, Socket.IO rooms, rate limits, and generated first-run setup code live in process memory and are not persisted or replicated across instances.

For horizontal scaling, you would need sticky sessions on the load balancer, a Socket.IO adapter (such as Redis), and a mechanism to ensure a single owner per live document. These features are not yet implemented.

## Port binding

By default, ports bind to `127.0.0.1` (loopback only). Set `SKETCHBLOCK_BIND_ADDRESS=0.0.0.0` to expose them on all interfaces, but only when the deployment is behind a TLS-terminating reverse proxy.
