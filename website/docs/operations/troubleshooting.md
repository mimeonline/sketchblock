# Troubleshooting

import {GuideFlow} from '@site/src/components/GuideVisuals';

Identify the failing layer before changing settings. Keep a copy of pending canvas work when synchronization or saving is affected.

<GuideFlow
  label="Find the failing layer"
  steps={[
    {title: 'Runtime', description: 'Check Docker, the Compose configuration, and service status.'},
    {title: 'Startup', description: 'Inspect Postgres and both Flyway jobs before app logs.'},
    {title: 'Connection', description: 'Check browser URLs, origins, proxy forwarding, and invitations.'},
    {title: 'Persistence', description: 'Confirm a saved version or GitHub commit after synchronization recovers.'},
  ]}
/>

## First checks

Run from the repository root, using the same Compose project, environment file, and overrides as the installation:

```bash
./scripts/doctor.sh
docker compose ps -a
docker compose logs --tail=120 web collab-server flyway-app flyway-collab postgres
```

`doctor.sh` checks prerequisites and Compose configuration; its final message is not an end-to-end collaboration test. Flyway jobs should have exited successfully; Postgres, web, and collaboration services should be healthy.

## Choose the symptom

| Symptom | Check first | Expected result |
| --- | --- | --- |
| Stack does not start | Docker daemon, Compose configuration, port bindings | Services start; both Flyway jobs exit with code 0. |
| Login redirects or fails | `APP_BASE_URL` and OAuth callback | Callback exactly matches the public web URL. |
| Board opens, live room stays offline | Public collaboration URL, allowed origin, WebSocket proxy | Browser connects and participants appear. |
| A participant disappears after rejoining | Session status, invitation, browser connection | Both profiles show the active participants again. |
| Canvas changes arrive late or remain pending | Connection and synchronization indicators; collab logs | Both canvases converge without needing another edit. |
| Saving reports a conflict | GitHub file SHA changed upstream | Preserve local work and reconcile the two versions. |

## Port already in use

Identify the process using the port before changing the installation. For the default ports on systems with `lsof`:

```bash
lsof -nP -iTCP:4512 -sTCP:LISTEN
lsof -nP -iTCP:4513 -sTCP:LISTEN
```

Update `SKETCHBLOCK_WEB_PORT`, `SKETCHBLOCK_COLLAB_PORT`, `APP_BASE_URL`, `NEXT_PUBLIC_COLLAB_SERVER_URL`, and `COLLAB_ALLOWED_ORIGINS` together. Update the GitHub OAuth callback when the web URL changes. Rebuild the web image because the public collaboration URL is embedded at build time.

## Migration failed

Inspect the Flyway service logs. Determine whether the failure came from connectivity, permissions, or a partially applied migration before using `repair`. Preserve the failing log and the previous backup for recovery.

## GitHub login failed

Confirm that the OAuth callback URL exactly matches `APP_BASE_URL` plus `/api/auth/github/callback`. Check the configured OAuth client and deployment mode. Reconnect GitHub when requested by the workspace.

## Live session stays disconnected

Check that `NEXT_PUBLIC_COLLAB_SERVER_URL` is reachable from the participant's browser and that `COLLAB_ALLOWED_ORIGINS` includes the web origin. Behind a reverse proxy, verify WebSocket forwarding and HTTPS URLs. The web app and collaboration server must use the same collaboration signing secret. Ended sessions and removed participants cannot reconnect; use an active session and a valid invitation.

## Missing participants or delayed changes

1. Check the connection indicator in both profiles and confirm that both opened the same live session.
2. Keep the affected tab open while the socket reconnects; reloading can discard unsent edits.
3. Inspect collaboration logs around the interruption and check for rejected or oversized updates.
4. After recovery, verify both participant lists and both canvases before saving as owner.
5. Repeat the [two-user workflow](../guides/collaboration.md#checking-a-two-user-workflow), including the owner leaving and rejoining.

## Save conflict or rejected update

A save conflict means the GitHub file changed from the session's base SHA. Export the live board, inspect the upstream change, and reconcile it before starting a new session from the current GitHub file. For an oversized update, export the board and reduce its content or review the collaboration server's document limit. Treat an unsynchronized canvas as pending work until the connection and save result have been checked.

When reporting a problem, include the Sketchblock version, deployment mode, affected role, approximate time, and relevant redacted logs. Remove secrets, cookies, and invitation links.
