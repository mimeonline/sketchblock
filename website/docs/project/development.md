# Development

The web app and collaboration server use separate pnpm lockfiles.

```bash
cd apps/web
pnpm install --frozen-lockfile
pnpm run check

cd ../collab-server
pnpm install --frozen-lockfile
pnpm run check
```

Use demo mode for credential-free local development. Run database migrations through the documented Compose stack or `scripts/flyway-local.sh` when using an existing local Postgres instance.
