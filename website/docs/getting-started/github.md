---
title: Connect GitHub
---

# Connect GitHub

Demo mode is intentionally credential-free. To work with your own repositories, switch the runtime to GitHub mode and configure a GitHub OAuth App.

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

Restart the stack and complete the Instance Owner setup. Sketchblock lists only repositories where the authorized GitHub account can write.

## Security note

Keep `.env` outside Git. The current OAuth integration is the first public integration path. A GitHub App with narrower installation permissions is planned as a later feature.
