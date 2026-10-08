# Collaboration

import {ScreenshotFigure} from '@site/src/components/GettingStartedVisuals';
import {GuideFlow} from '@site/src/components/GuideVisuals';

Start a live session from a board in the active workspace. Invite people to review the same canvas, then save the agreed result as owner.

<ScreenshotFigure
  src="/img/docs/getting-started/collaboration.png"
  alt="Local Sketchblock collaboration demo showing the shared canvas, participant presence, and session controls"
  caption="Local demo collaboration view: the shared canvas and participant state stay visible while the room is active."
/>

<GuideFlow
  label="Live collaboration"
  steps={[
    {title: 'Open', description: 'The owner starts a session from the active board and keeps its source context.'},
    {title: 'Invite', description: 'Share a role-specific collaborator or viewer link with the people who need access.'},
    {title: 'Work', description: 'Collaborators edit together while viewers follow the current canvas.'},
    {title: 'Save', description: 'The owner saves a local version or GitHub commit after reviewing the shared result.'},
  ]}
  caption="A valid invitation plus local or existing GitHub sign-in is enough for a participant to join."
/>

## Roles and invitations

| Role | Access |
| --- | --- |
| **Owner** | Opens and controls the board; saves the result. |
| **Collaborator** | Edits the shared canvas. |
| **Viewer** | Follows the session without editing. |

The invite dialog provides role-specific links and a QR code, defaults to viewer access, and shows invitation expiry. Owners can renew links and remove participants. A valid role-specific invitation lets collaborators and viewers join any session with a local account or an existing GitHub sign-in. The owner connects GitHub for repository access and saves on GitHub-backed boards. Ending a session revokes invitations and disconnects the live room while preserving its audit trail.

## Saving and reconnecting

The live-session header shows the active source of truth and file where the owner saves. Instance-workspace saves create a new local version in Postgres; GitHub-backed saves commit the live collaborative board using the file's session base SHA. Changes committed upstream during a GitHub session produce a conflict instead of being overwritten. Export the current board before resolving an upstream conflict or starting a replacement session.

The socket attempts to reconnect after a connection interruption and merges session state with pending local edits. Keep the tab open until the connection and synchronization indicators recover. Browser reloads and closing a tab can lose unsent edits; offline editing is not a durable backup. A rejected or oversized update requires attention before saving or leaving.

## Checking a two-user workflow

Use two different accounts in separate browser profiles and a new test board. The shared demo identity is useful for exploring the UI; use individual accounts to check permissions.

1. Sign in as Owner in profile A and create the session.
2. Open the collaborator invitation in profile B with a local account or existing GitHub sign-in; confirm both participants appear.
3. Edit in both profiles and confirm each change appears in the other canvas.
4. Disconnect and reconnect profile B; confirm the latest content and participant list return without another edit.
5. Save as Owner and verify persistence: check the new instance-workspace version, or inspect the resulting GitHub file and commit for a GitHub-backed board.
6. After saving successfully, Owner A leaves the room and opens the same session link again while profile B stays connected. Confirm both participants and the last saved board state return without another edit.
7. Repeat with a viewer invitation and verify read-only access. Then test participant removal and session end.

For the separate guest path, follow [Guest Viewers](./guest-viewers.md).
