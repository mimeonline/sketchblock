# Security

Never commit tokens, OAuth secrets, database passwords, `.env` files, invite links, or production logs.

Sketchblock validates API input server-side, keeps GitHub credentials out of client bundles, signs short-lived collaboration tickets, limits collaboration payloads, and separates local roles from GitHub permissions.

Signed tokens are bound to their purpose, GitHub credentials are bound to the local user, and state-changing requests require the web app's origin. Ending sessions and removing participants revoke live access. Session audit trails are visible to their owners.

The collaboration server requires authentication by default. Production secrets must contain at least 32 random characters and must avoid example placeholders. `/metrics` requires a server ticket; the API documentation UI is disabled unless explicitly enabled. The web app sends baseline security headers, including a report-only Content Security Policy. Review [configuration](../operations/configuration.md) before exposing a deployment.

The website dependency audit records remaining build-tool findings, their static-site reachability, and the current upstream constraints in the [dependency audit note](../security/dependency-audit-2026-10-08.md).

Do not disclose suspected vulnerabilities in a public issue. Report them privately to [sketchblock@meierhoff-systems.de](mailto:sketchblock@meierhoff-systems.de) so a coordinated fix can be prepared.
