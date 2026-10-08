# Sketchblock roadmap

This roadmap communicates product direction rather than fixed delivery dates. Priorities may change as self-hosters and contributors put Sketchblock into real use.

## 🚀 0.1 — Public foundation (released)

- Publish the self-hosted web app and collaboration server under Apache 2.0.
- Provide a credential-free demo and a one-command Docker Compose quickstart.
- Support English and German, local users, multiple GitHub repositories, live sessions, role-specific invitations, system health, and audit history.
- Ship reproducible CI, GitHub Pages documentation, multi-architecture container images, and versioned release notes.

## ✅ 0.2 — Collaboration and security hardening (released)

- Save the live collaborative board with the session's Git base SHA and report conflicting upstream changes.
- Enforce session end, participant removal, role-specific invitation renewal, and per-user repository ownership.
- Harden signed tokens, request origins, login limits, dependency versions, and deployment defaults.
- Improve reconnect handling, text rendering, live document limits, and persistence during document eviction.
- Expand regression coverage for authentication, collaboration, repository ownership, and persistence.

Local collaboration has been checked with two separate browser profiles. Production deployment, upgrade, restore, and operational acceptance remain installation-specific checks.

## ✅ 0.3 — Local workspaces and facilitation (released)

- Start temporary ad-hoc rooms from an empty board or uploaded Excalidraw scene, with downloads and configurable expiry and retention.
- Let invited guests watch live boards without an account through an owner-controlled, read-only viewer flow.
- Create, upload, edit, and save boards in a private instance workspace with version history and restore.
- Facilitate sessions with viewport following, edit locks, shared timers, dot voting, results summaries, and emoji reactions. Facilitation state is live-only.
- Let invited collaborators and viewers join any session with a valid role-specific invitation using a local account or an existing GitHub sign-in. Owners connect GitHub for repository-backed access and saves.
- Apply application migrations V13–V16 and collaboration migration V2.

Release validation covers local-account and ad-hoc browser workflows, two-account collaboration, multi-client facilitation, guest revocation, interrupted reconnects, and the migration path. The browser evidence does not constitute GitHub OAuth acceptance; production GitHub OAuth, deployment, upgrade, restore, and operational acceptance remain installation-specific.

## ➡️ Next — Extend the Git workflow

- Replace broad OAuth repository access with a GitHub App and repository-scoped installation permissions.
- Add branch and pull-request save flows for teams that protect their default branch.
- Add guided conflict recovery and make failed saves easier to diagnose.
- Expand end-to-end coverage around repository switching, upgrades, and two-user workflows.

## 🧩 Later — Operate with confidence

- Add actionable metrics and documented retention controls for self-hosted installations.
- Strengthen backup, restore, upgrade, and rollback verification across supported releases.
- Improve session history and operational visibility for long-running installations.
- Refine contribution and community workflows from real public usage.

## 🔭 Explore — Visual review, formats, and providers

- Breakout boards, durable session results, dedicated read-only result links, and richer exports.
- Visual diffs and review workflows for changed Excalidraw files.
- GitLab, Gitea, and other source-of-truth adapters.
- Format adapters for Markdown and other text-, document-, and diagram-based artifacts that benefit from collaborative visual review.
- Reusable templates, shape libraries, annotations, and review comments.
- Optional scale-out building blocks for larger collaboration workloads.

## 💬 How to influence the roadmap

Open a focused GitHub issue describing the workflow, the current friction, and the outcome you need. Concrete self-hosting and team-review scenarios are especially useful. Please use [SECURITY.md](SECURITY.md) for vulnerabilities.
