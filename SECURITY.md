# Security Policy

## Supported versions

Security fixes target the latest `0.2.x` release. Installations on `0.1.x` should upgrade to `0.2.0` to receive the authentication, session-access and save-conflict fixes described in [CHANGELOG.md](CHANGELOG.md).

## Report a vulnerability

Please do not open a public issue for a suspected vulnerability. Report it privately to [sketchblock@meierhoff-systems.de](mailto:sketchblock@meierhoff-systems.de) so a coordinated fix can be prepared.

Include the affected version, deployment mode, reproduction steps, impact, and any suggested mitigation. Do not include real credentials, private repository contents, invite tokens, or personal data.

## Secrets

Keep `.env`, OAuth credentials, authentication secrets, database passwords, invite URLs, backups, and production logs outside Git. The provided `.env.compose.example` contains placeholders only.
