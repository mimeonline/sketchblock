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
