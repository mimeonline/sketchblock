# Sketchblock

<p align="center">
  <img src="docs/assets/sketchblock-demo-editor.png" alt="Sketchblock demo workspace with a Git-backed Excalidraw board open in the editor" width="920" />
</p>

<p align="center">
  <a href="https://github.com/mimeonline/sketchblock/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/mimeonline/sketchblock/actions/workflows/ci.yml/badge.svg" /></a>
  <a href="https://github.com/mimeonline/sketchblock/releases"><img alt="Release" src="https://img.shields.io/github/v/release/mimeonline/sketchblock?display_name=tag" /></a>
  <a href="LICENSE"><img alt="License: Apache 2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" /></a>
  <a href="https://mimeonline.github.io/sketchblock/"><img alt="Documentation" src="https://img.shields.io/badge/docs-GitHub%20Pages-0f766e.svg" /></a>
</p>

Self-hosted collaborative whiteboards for Git-backed Excalidraw files.

Sketchblock keeps visual artifacts where engineering work already lives: in Git. Open `.excalidraw` files in the browser, collaborate in focused live sessions, and save reviewed results back as commits.

## 🎯 Why Sketchblock

- **Git-native:** boards remain ordinary Excalidraw files in repositories you control.
- **Realtime:** invite collaborators or viewers with role-specific links and QR codes.
- **Self-hosted:** run the web app, collaboration server, Postgres, and migrations with Docker Compose.
- **Credential-free demo:** try the editor and live collaboration before configuring GitHub.
- **Multi-repository:** connect several repositories and switch the active work context globally.
- **Local administration:** manage users, system health, and a persistent audit log.

## 🚀 Quickstart

Requirements: Docker with Compose v2, Git, `curl`, and `openssl`.

```bash
git clone https://github.com/mimeonline/sketchblock.git
cd sketchblock
./scripts/start.sh
```

Open [http://localhost:4512](http://localhost:4512). Demo mode is enabled by default and does not require GitHub credentials.

Stop or reset the stack:

```bash
./scripts/stop.sh
./scripts/reset.sh
```

## 🔗 Connect GitHub

Create a GitHub OAuth App with this local callback:

```text
http://localhost:4512/api/auth/github/callback
```

Then set `SKETCHBLOCK_AUTH_MODE=github`, `GITHUB_OAUTH_CLIENT_ID`, and `GITHUB_OAUTH_CLIENT_SECRET` in `.env` and restart the stack.

## 🏗️ Architecture

```text
Next.js web app
        │
        ├── GitHub REST API
        ├── sketchblock_app (Postgres)
        └── NestJS / Socket.IO collaboration server
                        └── sketchblock_collab (Postgres)
```

Flyway migrations under `db/flyway` are the schema source of truth.

## 🛠️ Development

```bash
cd apps/web
pnpm install --frozen-lockfile
pnpm run check

cd ../collab-server
pnpm install --frozen-lockfile
pnpm run check
```

The public website and documentation live under `website`:

```bash
cd website
pnpm install --frozen-lockfile
pnpm run build
```

## 🗂️ Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js 16 application: workspace, GitHub integration, users, boards, sessions, and administration |
| `apps/collab-server` | NestJS and Socket.IO collaboration service with Postgres persistence |
| `website` | Docusaurus landing page and public documentation, built statically for GitHub Pages |
| `db/flyway` | Versioned App and Collaboration database migrations |
| `docker` and `docker-compose.yml` | Self-contained local runtime with Postgres, migrations, Web, and Collaboration |
| `scripts` | Start, stop, reset, diagnostics, and local migration helpers |
| `examples` | Public example boards |
| `.github/workflows` | CI, GitHub Pages, and versioned container release automation |

## 📚 Documentation

- [Quickstart](website/docs/getting-started/quickstart.md)
- [Connect GitHub](website/docs/getting-started/github.md)
- [Configuration](website/docs/operations/configuration.md)
- [Architecture](website/docs/project/architecture.md)
- [Roadmap](ROADMAP.md)
- [Release process](RELEASING.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## ⚖️ License

Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for project attribution.

Questions about Sketchblock, security coordination, or public project governance can be sent to [sketchblock@meierhoff-systems.de](mailto:sketchblock@meierhoff-systems.de).
