# Security Policy

## Supported versions

Security fixes target the latest `0.3.x` release. Installations on older releases should follow the [update guide](https://mimeonline.github.io/sketchblock/docs/operations/update) and review the authentication, session-access, guest-revocation, and reconnect fixes described in [CHANGELOG.md](CHANGELOG.md).

## Report a vulnerability

Please do not open a public issue for a suspected vulnerability. Report it privately to [sketchblock@meierhoff-systems.de](mailto:sketchblock@meierhoff-systems.de) so a coordinated fix can be prepared.

Include the affected version, deployment mode, reproduction steps, impact, and any suggested mitigation. Do not include real credentials, private repository contents, invite tokens, or personal data.

## Secrets

Keep `.env`, OAuth credentials, authentication secrets, database passwords, invite URLs, backups, and production logs outside Git. The provided `.env.compose.example` contains placeholders only.
