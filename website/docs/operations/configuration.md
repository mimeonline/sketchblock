# Configuration

import {GuideFlow} from '@site/src/components/GuideVisuals';
import styles from '@site/src/components/OperationsReference.module.css';

Copy `.env.compose.example` to `.env` when you need to customize the defaults. `scripts/start.sh` creates the file automatically for a fresh demo installation and generates a random authentication secret.

<GuideFlow
  label="Configure an installation"
  steps={[
    {title: 'Choose the mode', description: 'Use the demo for exploration; configure GitHub for repository-backed work.'},
    {title: 'Match the URLs', description: 'Set browser-facing URLs, allowed origins, and the OAuth callback together.'},
    {title: 'Protect access', description: 'Generate secrets and configure the trusted reverse proxy for production.'},
    {title: 'Verify', description: 'Validate Compose, start the services, and test a live session from a participant browser.'},
  ]}
/>

## Browser URLs and internal connections

<div className={styles.reference}>

| Connection | Setting | Local default |
| --- | --- | --- |
| Browser → web app | `APP_BASE_URL` | `http://localhost:4512` |
| Browser → collaboration server | `NEXT_PUBLIC_COLLAB_SERVER_URL` | `http://localhost:4513` |
| Web app → collaboration server | `COLLAB_SERVER_URL` in Compose | `http://collab-server:4513` |
| Allowed browser origin | `COLLAB_ALLOWED_ORIGINS` | `http://localhost:4512` |
| GitHub → OAuth callback | OAuth App configuration | `APP_BASE_URL` + `/api/auth/github/callback` |

</div>

Use browser-reachable HTTPS URLs for a public installation. A participant's `localhost` refers to their own computer. The internal Compose hostname is only for service-to-service traffic. The public collaboration URL is also a web build argument: rebuild the web image after changing it.

## Runtime and authentication


<div className={styles.reference}>

| Variable | Purpose |
| --- | --- |
| `SKETCHBLOCK_AUTH_MODE` | `demo`, `dev`, or `github` |
| `SKETCHBLOCK_WEB_PORT` | Published web port, default `4512` |
| `SKETCHBLOCK_COLLAB_PORT` | Published collaboration port, default `4513` |
| `APP_AUTH_SECRET` | Signs app sessions and collaboration tickets. In production: at least 32 random characters, no `change-me` placeholders |
| `COLLAB_AUTH_SECRET` | Optional separate secret for collaboration tickets. Must be identical for the web app and the collaboration server; falls back to `APP_AUTH_SECRET` |
| `COLLAB_ALLOWED_ORIGINS` | Browser origins allowed to connect to the collaboration server |
| `SKETCHBLOCK_BIND_ADDRESS` | Compose published bind address, default `127.0.0.1` |
| `POSTGRES_PASSWORD` | Local Postgres password |
| `GITHUB_OAUTH_CLIENT_ID` | Required in GitHub mode |
| `GITHUB_OAUTH_CLIENT_SECRET` | Required in GitHub mode |

</div>

## Optional application limits

These application settings are read by the web runtime. The supplied Compose file does **not** forward them. Add the variables to the `web.environment` section in a Compose override as well as setting their values in `.env`.

<div className={styles.reference}>

| Variable | Purpose |
| --- | --- |
| `SKETCHBLOCK_ADHOC_TTL_HOURS` | Session lifetime for ad-hoc rooms in hours, default `168` (7 days) |
| `SKETCHBLOCK_ADHOC_RETENTION_HOURS` | Retention period for ad-hoc room content after session expiry or closure in hours, default `24` |
| `SKETCHBLOCK_MAX_UPLOAD_BYTES` | Maximum size for uploaded sketches in bytes, default `10000000` (10 MB) |
| `SKETCHBLOCK_WORKSPACE_MAX_VERSIONS` | Maximum number of versions retained per workspace board, default `50`; older versions are pruned automatically |

</div>

For example, create `compose.limits.yaml` alongside `docker-compose.yml`:

```yaml
services:
  web:
    environment:
      SKETCHBLOCK_WORKSPACE_MAX_VERSIONS: ${SKETCHBLOCK_WORKSPACE_MAX_VERSIONS:-50}
```

Include that override in each Compose command used for this installation:

```bash
docker compose -f docker-compose.yml -f compose.limits.yaml config --quiet
```

Keep `.env` outside Git. Store a protected copy with your recovery configuration. If you change `POSTGRES_PASSWORD`, keep both database connection URLs consistent; changing the environment alone does not rotate a password inside an existing database volume.

## Authentication secrets

Every signed value (sign-in cookies, owner cookies, OAuth state, session grants, collaboration tickets) is bound to its purpose, so one kind of token never validates as another. The collaboration server refuses to start without a secret, and in production it rejects secrets shorter than 32 characters or containing `change-me`; the web app applies the same rule when `SKETCHBLOCK_DEPLOYMENT_ENV` resolves to production. Generate a value with `openssl rand -base64 48`.

Upgrading from 0.1 to 0.2 invalidates existing sign-in cookies once, so everyone has to sign in again.

## Single-instance operation

Run exactly one web and one collaboration-server instance per deployment. Active Yjs documents, session presence, Socket.IO rooms, rate limits, and generated first-run setup code live in process memory and are not replicated across instances. With the Postgres persistence driver, collaboration state is persisted and loaded when needed. Idle documents are released after pending state is persisted; this does not provide shared live state across replicas.

For horizontal scaling, you would need sticky sessions on the load balancer, a Socket.IO adapter (such as Redis), and a mechanism to ensure a single owner per live document. These features are not yet implemented.

## Reverse proxy and client IPs

Behind a reverse proxy, set both `SKETCHBLOCK_TRUST_PROXY=true` (web) and `COLLAB_TRUST_PROXY=true` (collaboration server). Without them every request appears to come from the proxy, so login rate limits degrade to per username and can be used to lock an account out. Leave them `false` when clients connect directly. The collaboration server also reads `SKETCHBLOCK_DEPLOYMENT_ENV` (`local` or `production`, falling back to `NODE_ENV`) to decide whether production secret and origin checks apply.

## Port binding

By default, ports bind to `127.0.0.1` (loopback only). Set `SKETCHBLOCK_BIND_ADDRESS=0.0.0.0` to expose them on all interfaces, but only when the deployment is behind a TLS-terminating reverse proxy.

## Optional collaboration settings

<div className={styles.reference}>

| Variable | Default | Purpose |
| --- | --- | --- |
| `COLLAB_MAX_YJS_DOCUMENT_BYTES` | `25000000` bytes | Limit the encoded live document size. |
| `COLLAB_EXPOSE_API_DOCS` | `false` | Enable the collaboration API documentation UI. |
| `COLLAB_ALLOW_INSECURE_NO_AUTH` | `false` | Local experiments only: allow startup without a secret. Ignored in production. |

</div>

The collaboration document limit and API docs flag are collaboration-server settings. The supplied Compose file does not forward these optional variables; add them explicitly to the `collab-server` service environment when overriding their defaults. Keep `/metrics` access limited to clients with a server ticket and expose API docs only in trusted environments.


## Validate before opening the instance

```bash
docker compose config --quiet
./scripts/doctor.sh
```

These checks validate configuration and Docker availability. Follow the [update verification steps](./update.md#verify-the-running-stack) to check migrations, service health, and the browser workflow. Keep any installation-specific `--env-file`, project name, and override flags consistent across commands.
