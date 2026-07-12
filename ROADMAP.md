# Sketchblock roadmap

This roadmap communicates product direction rather than fixed delivery dates. Priorities may change as self-hosters and contributors put Sketchblock into real use.

## 🚀 0.1 — Public foundation

- Publish the self-hosted web app and collaboration server under Apache 2.0.
- Provide a credential-free demo and a one-command Docker Compose quickstart.
- Support English and German, local users, multiple GitHub repositories, live sessions, role-specific invitations, system health, and audit history.
- Ship reproducible CI, GitHub Pages documentation, multi-architecture container images, and versioned release notes.

## ➡️ Next — Harden the Git workflow

- Replace broad OAuth repository access with a GitHub App and repository-scoped installation permissions.
- Add branch and pull-request save flows for teams that protect their default branch.
- Improve conflict handling and make failed saves easier to diagnose and recover.
- Expand regression coverage around authentication, repository switching, collaboration, and upgrades.

## 🧩 Later — Operate with confidence

- Add actionable metrics and documented retention controls for self-hosted installations.
- Strengthen backup, restore, upgrade, and rollback verification across supported releases.
- Improve session history and operational visibility for long-running installations.
- Refine contribution and community workflows from real public usage.

## 🔭 Explore — Visual review, formats, and providers

- Visual diffs and review workflows for changed Excalidraw files.
- GitLab, Gitea, and other source-of-truth adapters.
- Format adapters for Markdown and other text-, document-, and diagram-based artifacts that benefit from collaborative visual review.
- Reusable templates, shape libraries, annotations, and review comments.
- Optional scale-out building blocks for larger collaboration workloads.

## 💬 How to influence the roadmap

Open a focused GitHub issue describing the workflow, the current friction, and the outcome you need. Concrete self-hosting and team-review scenarios are especially useful. Please use [SECURITY.md](SECURITY.md) for vulnerabilities.
