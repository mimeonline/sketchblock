# Sketchblock Web

The Sketchblock web application is built with Next.js, React, TypeScript, Excalidraw, and shadcn/ui.

It provides the local account flow, repository and board selection, the Excalidraw workspace, live-session management, system diagnostics, and administration views.

## Local development

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm dev
```

Next.js uses port 3000 by default. Configure `APP_BASE_URL`, `COLLAB_SERVER_URL`, and `NEXT_PUBLIC_COLLAB_SERVER_URL` in `.env.local` when the collaboration server runs on another origin.

The default local configuration uses the credential-free development identity. Real GitHub repositories require a GitHub OAuth App and `SKETCHBLOCK_AUTH_MODE=github`.

## Quality gate

```bash
pnpm run check
```

This runs type generation, TypeScript, ESLint, Vitest, and the production build.

## Persistence

The web application stores accounts, repository connections, sessions, audit entries, and demo data in the configured Postgres application database. Flyway migrations under `../../db/flyway/app/sql` are the schema source of truth.

GitHub files remain in GitHub and are loaded or saved through the GitHub API.
