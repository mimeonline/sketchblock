# AGENTS.md

## Purpose

This file defines the collaboration rules for the public Sketchblock repository. Keep changes understandable to external contributors and suitable for an open-source project.

## Project scope

1. Sketchblock is a self-hosted collaboration layer for Excalidraw files stored in Git repositories.
2. The public repository contains product code, public documentation, Docker Compose, database migrations, and public CI workflows.
3. Do not add private infrastructure, operator credentials, personal configuration, internal planning documents, or deployment targets.
4. The join flow, realtime presence, save flow, and repository ownership boundaries are security-sensitive. Preserve their contracts unless a change explicitly includes migration and compatibility work.

## Language

1. Public documentation, UI documentation, release notes, and contributor-facing text use English.
2. Code identifiers, APIs, URLs, and externally defined names remain unchanged.
3. Write concise, direct, publishable prose.

## Frontend architecture

1. `apps/web` uses Next.js, React, TypeScript, and shadcn/ui.
2. Check shadcn/ui before creating reusable UI primitives.
3. Keep route-local UI under `src/features/<route>/{atoms,molecules,organisms,templates}`.
4. Keep global components under `src/components/{atoms,molecules,organisms}` and shadcn/ui primitives under `src/components/ui`.
5. Keep global helpers under `src/lib` and global types under `src/types`.
6. Do not create generic feature buckets such as `src/features/shared` or `src/features/common`.
7. Preserve responsive behavior, keyboard access, visible focus states, and reduced-motion preferences.

## Collab server architecture

1. `apps/collab-server` uses NestJS with hexagonal architecture.
2. Domain code must not import NestJS, Socket.IO, HTTP, database drivers, filesystem APIs, or other infrastructure concerns.
3. Application use cases orchestrate workflows through ports.
4. Concrete HTTP, realtime, persistence, authentication, configuration, and logging adapters belong in `infrastructure`.
5. Controllers and gateways validate and map input, call use cases, and map output. Business rules belong in the domain or application layers.

## Local development

1. Use pnpm and the package-local lockfiles.
2. `cd apps/web && pnpm dev` starts the web app with the Next.js default port.
3. `cd apps/collab-server && pnpm dev` starts the collaboration server. Copy `.env.example` to `.env.local` for local configuration.
4. `./scripts/start.sh` is the public Docker Compose quickstart and starts the complete stack.
5. Store Playwright screenshots and visual QA artifacts under `.playwright/screenshots/`. The complete `.playwright/` directory remains untracked.
6. Local `.env`, `.env.local`, database data, build outputs, `.DS_Store`, and `node_modules` must remain untracked.

## Required checks

Run the relevant checks before handing off a change:

```bash
cd apps/web && pnpm run check
cd apps/collab-server && pnpm run check
cd website && pnpm run check
```

For scoped changes, run at least typecheck, lint where available, tests, and build for every affected package.

## Git and releases

1. Use Conventional Commits.
2. Do not commit secrets or local artifacts.
3. Do not push, tag, or publish unless explicitly requested.
4. Releases use SemVer tags in the form `vX.Y.Z` and require an updated `CHANGELOG.md`.
5. Keep the working tree status explicit in the final handoff.
