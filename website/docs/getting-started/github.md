---
title: Connect GitHub
---

import {ScreenshotFigure, GithubConfigExample} from '@site/src/components/GettingStartedVisuals';

# Connect GitHub

Demo mode is intentionally credential-free. To work with your own repositories, the operator switches the runtime to GitHub mode and configures a GitHub OAuth App. The owner then connects GitHub; invited participants can use a local account or an existing GitHub sign-in.

The operator configuration and the daily user flow are separate steps:

1. The operator puts the OAuth values in the local runtime.
2. The owner signs in and selects a repository where the connected GitHub account can write.
3. Collaborators and viewers join through valid role-specific invitations. A repository-backed save is performed by the owner.

## Create an OAuth App

Use these local values:

- Homepage URL: `http://localhost:4512`
- Callback URL: `http://localhost:4512/api/auth/github/callback`

Add the client ID and client secret to `.env`, then set:

```env
SKETCHBLOCK_AUTH_MODE=github
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
APP_BASE_URL=http://localhost:4512
```

<GithubConfigExample />

Restart the stack and complete the Instance Owner setup. Sketchblock lists only repositories where the authorized GitHub account can write.

<ScreenshotFigure
  src="/img/docs/getting-started/repositories.png"
  alt="Local Sketchblock demo workspace showing the repository selection area"
  caption="Workspace selection in the local demo. A connected GitHub owner selects an available repository in this area."
/>

## Saving a repository board

Open a board, invite the people who need to review it, and save the agreed canvas from the owner workspace. Sketchblock sends the current `.excalidraw` content back through the configured repository path and reports the resulting save state. After a real save, inspect the repository history in GitHub to review the commit.

## Security note

Keep `.env` outside Git. The current OAuth integration is the first public integration path. A GitHub App with narrower installation permissions is planned as a later feature.
