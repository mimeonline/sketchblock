# Security

Security fixes target the current `0.3.x` release line. Follow the repository’s [security policy](https://github.com/mimeonline/sketchblock/blob/main/SECURITY.md) and the [update guide](../operations/update.md) for supported versions and upgrade preparation.

## Keep sensitive material private

Never commit tokens, OAuth secrets, database passwords, `.env` files, invite links, or production logs.

## Application boundaries

Sketchblock validates API input server-side, keeps GitHub credentials out of client bundles, signs short-lived collaboration tickets, limits collaboration payloads, and separates local roles from GitHub permissions.

Signed tokens are bound to their purpose, GitHub credentials are bound to the local user, and state-changing requests require the web app's origin. Ending sessions and removing participants revoke live access. Session audit trails are visible to their owners.

| Boundary | How access is constrained |
| --- | --- |
| Local account → workspace | Repository records and private instance boards belong to the local user. |
| Invitation → session | The invitation selects a collaborator or viewer role for a specific session. |
| Browser → collaboration server | Signed, short-lived tickets authorize the live connection. |
| Owner → GitHub save | The owner's GitHub connection and repository permissions govern the write. |
| Guest → canvas | Guest viewing must be enabled by the owner and remains read-only for board edits. |

A session invitation does not grant general repository or workspace access. Review the [architecture flows](./architecture.md) alongside these boundaries.

## Deployment controls

The collaboration server requires authentication by default. Production secrets must contain at least 32 random characters and must avoid example placeholders. `/metrics` requires a server ticket; the API documentation UI is disabled unless explicitly enabled. The web app sends baseline security headers, including a report-only Content Security Policy. Review [configuration](../operations/configuration.md) before exposing a deployment.

## Dependency findings

The website dependency audit records remaining build-tool findings, their static-site reachability, and the current upstream constraints in the [dependency audit note](../security/dependency-audit-2026-10-08.md).

## Report a vulnerability

Do not disclose suspected vulnerabilities in a public issue. Report them privately to [sketchblock@meierhoff-systems.de](mailto:sketchblock@meierhoff-systems.de) so a coordinated fix can be prepared.


Include the affected release, deployment mode, reproduction steps using synthetic data, expected and actual behavior, and the potential impact. Share redacted evidence and suggested mitigations when available. The repository policy defines the reporting route; this page does not promise a response or fix deadline.
