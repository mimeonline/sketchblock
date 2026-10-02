# Configuration

Copy `.env.compose.example` to `.env` when you need to customize the defaults. `scripts/start.sh` creates the file automatically for a fresh demo installation and generates a random authentication secret.

Key settings include:

| Variable | Purpose |
| --- | --- |
| `SKETCHBLOCK_AUTH_MODE` | `demo`, `dev`, or `github` |
| `SKETCHBLOCK_WEB_PORT` | Published web port, default `4512` |
| `SKETCHBLOCK_COLLAB_PORT` | Published collaboration port, default `4513` |
| `APP_AUTH_SECRET` | Signs app sessions and collaboration tickets. In production: at least 32 random characters, no `change-me` placeholders |
| `COLLAB_AUTH_SECRET` | Optional separate secret for collaboration tickets. Must be identical for the web app and the collaboration server; falls back to `APP_AUTH_SECRET` |
| `COLLAB_ALLOW_INSECURE_NO_AUTH` | Local experiments only: lets the collaboration server start without a secret. Ignored in production |
| `POSTGRES_PASSWORD` | Local Postgres password |
| `GITHUB_OAUTH_CLIENT_ID` | Required in GitHub mode |
| `GITHUB_OAUTH_CLIENT_SECRET` | Required in GitHub mode |
| `SKETCHBLOCK_ADHOC_TTL_HOURS` | Session lifetime for ad-hoc rooms in hours, default `168` (7 days) |
| `SKETCHBLOCK_ADHOC_RETENTION_HOURS` | Retention period for ad-hoc room content after session expiry or closure in hours, default `24` |
| `SKETCHBLOCK_MAX_UPLOAD_BYTES` | Maximum size for uploaded sketches in bytes, default `10000000` (10 MB) |

Do not commit `.env`.

## Authentication secrets

Every signed value (sign-in cookies, owner cookies, OAuth state, session grants, collaboration tickets) is bound to its purpose, so one kind of token never validates as another. The collaboration server refuses to start without a secret, and in production it rejects secrets shorter than 32 characters or containing `change-me`; the web app applies the same rule when `SKETCHBLOCK_DEPLOYMENT_ENV` resolves to production. Generate a value with `openssl rand -base64 48`.

Upgrading to this version invalidates existing sign-in cookies once, so everyone has to sign in again.

## Single-instance operation

Run exactly one web and one collaboration-server instance per deployment. Session presence, live Yjs documents, Socket.IO rooms, rate limits, and generated first-run setup code live in process memory and are not persisted or replicated across instances.

For horizontal scaling, you would need sticky sessions on the load balancer, a Socket.IO adapter (such as Redis), and a mechanism to ensure a single owner per live document. These features are not yet implemented.

## Reverse proxy and client IPs

Behind a reverse proxy, set both `SKETCHBLOCK_TRUST_PROXY=true` (web) and `COLLAB_TRUST_PROXY=true` (collaboration server). Without them every request appears to come from the proxy, so login rate limits degrade to per username and can be used to lock an account out. Leave them `false` when clients connect directly. The collaboration server also reads `SKETCHBLOCK_DEPLOYMENT_ENV` (`local` or `production`, falling back to `NODE_ENV`) to decide whether production secret and origin checks apply.

## Port binding

By default, ports bind to `127.0.0.1` (loopback only). Set `SKETCHBLOCK_BIND_ADDRESS=0.0.0.0` to expose them on all interfaces, but only when the deployment is behind a TLS-terminating reverse proxy.
