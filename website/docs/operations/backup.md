# Backup and restore

Sketchblock stores application and collaboration data in the Postgres volume.

## Create a backup

```bash
docker compose exec -T postgres pg_dumpall -U sketchblock > sketchblock-backup.sql
```

Store the resulting file outside the repository and protect it like any other user database.

## Restore

Restore into a fresh stack before normal use:

```bash
cat sketchblock-backup.sql | docker compose exec -T postgres psql -U sketchblock -d postgres
```

Run `docker compose up -d` afterward so Flyway can validate and apply newer migrations.
