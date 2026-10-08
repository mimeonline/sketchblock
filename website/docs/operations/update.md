# Update

import {GuideFlow} from '@site/src/components/GuideVisuals';

Update the web app and collaboration server together. Keep the previous release and a database backup available until the new installation has passed its checks.

<GuideFlow
  label="Release update"
  steps={[
    {title: 'Prepare', description: 'Read release notes and retain configuration, source revision, image tags, and a backup.'},
    {title: 'Apply', description: 'Update the selected release and allow both Flyway jobs to complete.'},
    {title: 'Verify', description: 'Check healthy services, two browser profiles, and a durable save.'},
    {title: 'Retain recovery', description: 'Keep the matching backup and previous release until acceptance is complete.'},
  ]}
/>

## Choose one update path

Before updating, finish active sessions and [create a database backup](./backup.md). Use the same Compose project, environment file, and overrides throughout.

### Build from source

For a checkout that follows its configured branch:

```bash
git pull --ff-only
docker compose up --build -d
```

For a reproducible release installation, select the intended release tag and retain its matching Compose file and migrations before building. Check for local changes before changing revisions.

### Use published images

Set `SKETCHBLOCK_IMAGE_TAG` to the intended published release and use the matching release's Compose file and migration sources:

```bash
docker compose pull web collab-server
docker compose up -d --no-build
```

The supplied Compose file mounts migration SQL from the checkout. Updating only the image tag can leave those migrations behind. `NEXT_PUBLIC_COLLAB_SERVER_URL` is also a web build argument; use an image built for your public collaboration URL, or build it from source.

## Verify the running stack

```bash
docker compose ps -a
docker compose logs --tail=120 flyway-app flyway-collab web collab-server
```

| Check | Expected result |
| --- | --- |
| Database | Postgres is healthy. |
| Migrations | Both Flyway jobs completed with exit code 0. |
| Services | Web and collaboration server are healthy. |
| Browser access | Login and the expected board source work through the real public URL. |
| Live collaboration | Two profiles see edits and participant presence after reconnecting. |
| Durable save | The owner can verify a new local version or the resulting GitHub file and commit. |

Use the [two-user procedure](../guides/collaboration.md#checking-a-two-user-workflow) for browser acceptance. Container health alone covers only part of this check.

## Recovery

Restore the retained backup with its matching application version in a separate stack. Rehearse that path before treating it as a rollback plan. Starting an older application image against a migrated database is not a verified rollback.

## Upgrading from 0.1 to 0.2

- Back up both application and collaboration databases and retain the previous configuration and image tags.
- Configure a random authentication secret of at least 32 characters for production. A separate `COLLAB_AUTH_SECRET` must match on the web app and collaboration server.
- Expect all users to sign in again: signed tokens now include their purpose. Reconnect GitHub when prompted; repository records remain selected.
- Flyway applies V10–V12 for per-user repositories, the session base SHA, and participant removal. Inspect both Flyway services for successful completion.
- Check the published bind address: Compose now defaults to `127.0.0.1`. Review public URLs, allowed origins, and trusted-proxy settings before exposing the stack.

After the upgrade, use two separate browser profiles to check owner and collaborator access, simultaneous edits, reconnect, and saving to GitHub. Check viewer restrictions, invitation renewal, participant removal, and ending the session. Confirm the saved file and commit in GitHub. A local two-profile check does not validate a production proxy or database restore.

Avoid starting older application images against the migrated database as an assumed rollback. Rehearse recovery using the retained backup and matching application version in a separate stack.

## Upgrading from 0.2 to 0.3

- Back up both application and collaboration databases and retain the previous configuration and image tags.
- Flyway applies application migrations V13–V16 and collaboration migration V2. Inspect both Flyway services for successful completion before opening the web app.
- V13 adds ad-hoc room persistence, V14 adds guest viewers, V15 adds private instance-workspace boards and versions, and V16 assigns stable local session identities.
- Verify that local accounts can collaborate on an instance-workspace board without GitHub. Verify separately that a GitHub-backed board still loads, saves, and reports its commit.
- Save an instance board, confirm that its version history remains visible, and check that the editor describes a local version save. Check long text and labels in the canvas after the upgrade.

Production deployment, rollback, and restore remain installation-specific checks. The remaining website build-tool dependency advisories are documented in the [dependency audit](../security/dependency-audit-2026-10-08.md).
