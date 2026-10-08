# Instance Workspace

import {GuideFlow} from '@site/src/components/GuideVisuals';

Every local user has a private workspace in the repository switcher. Create boards without GitHub—store sketches in the Sketchblock database, edit them live, and manage versions. Ideal for ad-hoc collaboration and local exploration.

<GuideFlow
  label="Instance workspace flow"
  steps={[
    {title: 'Create', description: 'Create or upload a board in the private workspace.'},
    {title: 'Invite', description: 'Share a live session with local collaborators or viewers.'},
    {title: 'Version', description: 'Save changes and open version history in the editor.'},
    {title: 'Restore', description: 'Restore an earlier version as a new saved version when needed.'},
  ]}
  caption="Local accounts can collaborate in an instance workspace without a GitHub connection."
/>

## Creating and Uploading

Create a new board or upload an Excalidraw file (`.excalidraw`, `.json`, or image with embedded scene) directly in the workspace. The board opens in the editor ready to work.

## Live Sessions

Start a live session from within the editor. Invite local accounts as collaborators or viewers using the share dialog; GitHub access is not required. Presence, live editing, and role-based access work as usual.

## Version History

Every save creates a new version. Open version history in the editor to:

- List all saved versions
- Restore an older version (creates a new version from the restored state)
- View when each version was saved

The version history remains available after saving. The editor labels the action as saving a version in the instance workspace, and its hint describes local versioning.

At most `SKETCHBLOCK_WORKSPACE_MAX_VERSIONS` (default 50) versions are kept per board; older versions are pruned automatically.

## Managing Boards

Rename a board only when it has no active sessions. Delete a board to end any running sessions and remove it permanently.

<details>
<summary>Operator note</summary>

Workspace boards are stored in the application Postgres database. Include the database in your backups. The feature requires database migration V15.

</details>
