# Backup and restore

import {GuideFlow} from '@site/src/components/GuideVisuals';

Sketchblock stores application data and persisted collaboration state in two databases inside the Postgres volume. Back up both, together with the configuration and release information needed to recover them.

<GuideFlow
  label="Recovery workflow"
  steps={[
    {title: 'Save and pause', description: 'Finish live work, save as owner, and stop web and collaboration writes.'},
    {title: 'Back up', description: 'Dump both databases and retain the matching release and configuration.'},
    {title: 'Restore separately', description: 'Load the backup into a fresh, isolated recovery stack.'},
    {title: 'Verify', description: 'Check migrations, accounts, board content, versions, and a new live session.'},
  ]}
  caption="A completed dump is a backup artifact. A successful recovery rehearsal establishes that it can be restored."
/>

## What to retain

| Artifact | What it preserves |
| --- | --- |
| `sketchblock_app` dump | Users, repository records, boards, versions, sessions, and application audit data. |
| `sketchblock_collab` dump | Persisted collaboration documents and collaboration data. |
| Protected `.env` and Compose overrides | Secrets, URLs, database credentials, and installation settings. |
| Release revision and image tags | The application and migration sources matching the backup. |
| GitHub repository backup policy | Repository-backed board files remain in GitHub; the database backup does not replace their backup. |

Live-only state such as moderation timers and reactions is not a durable recovery artifact. Save pending board changes before stopping the services.

## Create a backup

The following commands use the supplied Compose stack and its standard database names. Run them from the repository root. Keep any custom project name, environment-file, and override flags consistent. A custom database layout needs corresponding database names.

First announce a maintenance window, finish live sessions, and save the result as owner. Stop both writers to keep the two database dumps aligned:

```bash
docker compose stop web collab-server
umask 077
backup_dir="../sketchblock-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -Fc sketchblock_app' \
  > "$backup_dir/sketchblock_app.dump"
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -Fc sketchblock_collab' \
  > "$backup_dir/sketchblock_collab.dump"
```

Confirm that **both commands exited successfully** and retain only completed dumps. Keep the backup directory outside the public repository, protect it like the user database, and copy it to independent storage. Retain `.env`, overrides, and the matching release information in protected storage too.

Inspect both archive inventories before resuming service:

```bash
docker compose exec -T postgres pg_restore --list \
  < "$backup_dir/sketchblock_app.dump"
docker compose exec -T postgres pg_restore --list \
  < "$backup_dir/sketchblock_collab.dump"
docker compose start collab-server web
```

An archive inventory checks that the file is readable; use a separate restore rehearsal to verify data recovery. These custom-format dumps contain database objects and data, not cluster-wide role definitions. Retain the database user configuration; back up any additional custom database roles separately.

## Restore into an isolated stack

Use a separate checkout, Compose project, volume, and free ports with the **matching release**. Configure its database user and credentials, and keep it isolated from normal users. The commands below assume your shell already targets this recovery installation, with its correct Compose flags.

1. Start only Postgres so initialization creates the two empty databases.
2. Restore both archives before starting Flyway or the application services.
3. Start the matching stack and inspect its migrations and health.

```bash
docker compose up -d --wait postgres

# Set this to the completed backup directory you intend to restore.
backup_dir="../sketchblock-backups/REPLACE_WITH_BACKUP_TIMESTAMP"

docker compose exec -T postgres sh -c \
  'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d sketchblock_app' \
  < "$backup_dir/sketchblock_app.dump"
docker compose exec -T postgres sh -c \
  'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d sketchblock_collab' \
  < "$backup_dir/sketchblock_collab.dump"
```

Both restore commands must succeed before continuing. This procedure targets fresh databases; an existing populated database can cause object conflicts. Keep a failed recovery stack isolated and investigate the error before retrying.

```bash
docker compose up --build -d
docker compose ps -a
docker compose logs --tail=120 flyway-app flyway-collab
```

For matching prebuilt images, use `docker compose up -d --no-build` instead. Both Flyway services must complete successfully. Restore the matching release first; apply a newer release through the separate [update procedure](./update.md).

## Verify recovery

- Sign in with an expected account and inspect its repository or instance workspace.
- Open a known board and compare its content with the saved result.
- Check retained instance-workspace versions and audit records.
- Start a new live session with two accounts, edit, reconnect, and save.
- Confirm the newly saved local version or GitHub commit.

Use a test repository for GitHub write checks. Record the backup date, release, recovery result, and any gaps before approving a switch to the recovered installation.
