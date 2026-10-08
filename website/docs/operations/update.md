# Update

Before updating, create a database backup and read the release notes.

```bash
git pull --ff-only
docker compose pull
docker compose up --build -d
```

Flyway services run before the application services and apply pending migrations. Use explicit image tags in long-running installations when reproducibility matters.

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
