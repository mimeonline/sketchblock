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
