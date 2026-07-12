# Security

Never commit tokens, OAuth secrets, database passwords, `.env` files, invite links, or production logs.

Sketchblock validates API input server-side, keeps GitHub credentials out of client bundles, signs short-lived collaboration tickets, limits collaboration payloads, and separates local roles from GitHub permissions.

Do not disclose suspected vulnerabilities in a public issue. Report them privately to [sketchblock@meierhoff-systems.de](mailto:sketchblock@meierhoff-systems.de) so a coordinated fix can be prepared.
