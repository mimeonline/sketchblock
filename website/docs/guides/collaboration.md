# Collaboration

Start a live session from a board in the active repository. Sketchblock creates three access paths:

- **Owner** opens and controls the board.
- **Collaborator** can edit the shared canvas.
- **Viewer** follows the session without editing.

The invite dialog provides role-specific links and a QR code, defaults to viewer access, and shows invitation expiry. Owners can renew links and remove participants. A valid role-specific invitation lets collaborators and viewers join any session with a local account or an existing GitHub sign-in. The owner connects GitHub for repository access and saves on GitHub-backed boards. Ending a session revokes invitations and disconnects the live room while preserving its audit trail.

## Saving and reconnecting

The live-session header shows the active source of truth and file where the owner saves. Instance-workspace saves create a new local version in Postgres; GitHub-backed saves commit the live collaborative board using the file's session base SHA. Changes committed upstream during a GitHub session produce a conflict instead of being overwritten. Export the current board before resolving an upstream conflict or starting a replacement session.

The socket attempts to reconnect after a connection interruption and merges session state with pending local edits. Keep the tab open until the connection and synchronization indicators recover. Browser reloads and closing a tab can lose unsent edits; offline editing is not a durable backup. A rejected or oversized update requires attention before saving or leaving.

## Checking a two-user workflow

For an instance-workspace board, use two local accounts in separate browser profiles. Open the session as owner in one profile and follow a collaborator invitation in the other. Edit in both profiles, check that changes appear on both canvases, reconnect one profile, and save a new local version as owner. For a GitHub-backed board, use separate profiles to keep GitHub identities independent and verify the resulting file and commit. Repeat with a viewer invitation to check read-only access, then test removal and session end.
