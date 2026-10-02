# Troubleshooting

Start with:

```bash
./scripts/doctor.sh
docker compose ps
docker compose logs --tail=120 web collab-server flyway-app flyway-collab postgres
```

## Port already in use

Change `SKETCHBLOCK_WEB_PORT`, `SKETCHBLOCK_COLLAB_PORT`, `APP_BASE_URL`, and the public collaboration URL in `.env`.

## Migration failed

Inspect the Flyway service logs. Do not run `repair` until you understand whether the failure came from connectivity, permissions, or a partially applied migration.

## GitHub login failed

Confirm that the OAuth callback URL exactly matches `APP_BASE_URL` plus `/api/auth/github/callback`.

## Live session stays disconnected

Check that the public collaboration URL is reachable from the participant's browser and that `COLLAB_ALLOWED_ORIGINS` includes the web origin. Behind a reverse proxy, verify WebSocket forwarding and HTTPS URLs. The web app and collaboration server must use the same collaboration signing secret. Ended sessions and removed participants cannot reconnect; use an active session and a valid invitation.

## Save conflict or rejected update

A save conflict means the GitHub file changed from the session's base SHA. Export the live board, inspect the upstream change, and reconcile it before starting a new session from the current GitHub file. For an oversized update, export the board and reduce its content or review the collaboration server's document limit. Treat an unsynchronized canvas as pending work until the connection and save result have been checked.
