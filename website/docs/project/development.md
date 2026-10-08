# Development

import {GuideFlow} from '@site/src/components/GuideVisuals';

Sketchblock has three independently checked packages: the web app, the collaboration server, and this documentation website. Each package owns its pnpm lockfile.

<GuideFlow
  label="Development workflow"
  steps={[
    {title: 'Run the product', description: 'Explore the complete workflow in the local Docker demo.'},
    {title: 'Choose a package', description: 'Install its locked dependencies and use the matching environment file.'},
    {title: 'Make the change', description: 'Keep UI, application logic, and infrastructure boundaries intact.'},
    {title: 'Verify', description: 'Run package checks and exercise the affected browser workflow.'},
  ]}
/>

## Prerequisites

Use Node.js 24 and pnpm 11.10.0 to match the current CI and application Docker builds. Docker with Compose v2 is needed for the complete local stack and the Flyway helper. Use package-local installs; there is no root dependency install for all three packages.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js routes, UI, server APIs, authentication, board providers, and owner saves. |
| `apps/collab-server` | NestJS HTTP and Socket.IO adapters, live Yjs documents, presence, and collaboration persistence. |
| `db/flyway/app/sql` | Application database migrations. |
| `db/flyway/collab/sql` | Collaboration database migrations. |
| `website` | Docusaurus documentation and public project pages. |
| `scripts` | Compose startup, diagnosis, and local migration helpers. |

See [Architecture](./architecture.md) for the system boundaries and runtime flows.

## Start with the complete demo

From the repository root:

```bash
./scripts/start.sh
```

Open [http://localhost:4512](http://localhost:4512). This runs the real web and collaboration services with Postgres and Flyway, using a shared demo identity. Follow [Quickstart](../getting-started/quickstart.md) for the product workflow and stop/reset commands.

## Work on application code

Install the package dependencies from the repository root:

```bash
pnpm --dir apps/web install --frozen-lockfile
pnpm --dir apps/collab-server install --frozen-lockfile
```

For native development, create `apps/web/.env.local` and `apps/collab-server/.env.local` from their respective `.env.example` files if they do not already exist. The root Compose `.env` is a separate configuration file.

Before starting native processes:

- Set the web authentication mode to `demo` for credential-free product exploration. The example's `dev` identity is intended for UI development.
- Set a random web `APP_AUTH_SECRET` and the same value in the collaboration server's `COLLAB_AUTH_SECRET`, or configure a separate matching collaboration secret in both services.
- Point both database URLs at a reachable local Postgres instance containing `sketchblock_app` and `sketchblock_collab`.
- Run both Flyway migration sets. The helper uses Docker and defaults to `host.docker.internal:5432`; configure its `SKETCHBLOCK_POSTGRES_*` variables for your database. It does not read the application `.env.local` files.
- Confirm that ports 4512 and 4513 are free. Reuse an existing matching native server; a running Compose stack already occupies those ports.

```bash
./scripts/flyway-local.sh all migrate
```

The standard Compose database is internal to the Docker network. Native applications need their own reachable database endpoint; copying the Compose service hostname into a native connection URL will not provide one.

Start each service in a separate terminal:

```bash
# Terminal 1, from the repository root
cd apps/collab-server
pnpm dev
```

```bash
# Terminal 2, from the repository root
cd apps/web
WATCHPACK_POLLING=true pnpm dev --port 4512
```

Use [http://localhost:4512](http://localhost:4512) for the web app and [http://localhost:4513/health](http://localhost:4513/health) for collaboration health. Keep `APP_BASE_URL`, the public collaboration URL, and allowed origins aligned with these addresses.

## Work on documentation

```bash
cd website
pnpm install --frozen-lockfile
pnpm start --host 127.0.0.1 --port 3000 --no-open
```

Open [the local documentation](http://127.0.0.1:3000/sketchblock/docs/getting-started/why-sketchblock). Changes reload automatically. Reuse the preview if port 3000 already serves this project; otherwise choose a free port and open the corresponding URL. The `/sketchblock/` base path is part of the local and published routes.

## Verify the affected packages

Run these from the repository root for the packages you changed:

```bash
pnpm --dir apps/web run check
pnpm --dir apps/collab-server run check
pnpm --dir website run check
docker compose config --quiet
```

| Package | Its check covers |
| --- | --- |
| Web | Route type generation, TypeScript, ESLint, Vitest, and the Next.js production build. |
| Collaboration | TypeScript, Vitest, production build, and AsyncAPI validation. |
| Website | TypeScript and the Docusaurus production build, including internal link validation. |

CI also runs a separate Postgres-backed collaboration persistence check. A passing unit suite does not replace browser acceptance through a deployed proxy. For changes to invites, presence, reconnect, or saves, follow the [two-user procedure](../guides/collaboration.md#checking-a-two-user-workflow).

## Keep changes maintainable

- Put web route composition in `src/app`, route-specific UI in `src/features`, and server-side integrations in the existing server modules.
- Keep collaboration domain and application code independent from HTTP, Socket.IO, and database implementations.
- Add a new Flyway migration for schema changes rather than rewriting an applied migration.
- Add meaningful regression tests for behavior changes and update the corresponding guide.
- Keep secrets, private board content, build output, and raw QA captures outside commits.

Continue with [Contributing](./contributing.md) for issue and pull-request expectations.
