# Users and roles

The first production setup creates one Instance Owner. The Instance Owner manages local accounts, system diagnostics, and the audit log. Regular users connect and use their own repositories without administrator approval. They can also collaborate on instance-workspace boards with local accounts; that flow does not require GitHub.

New users receive a one-time start password and must replace it on first login. Accounts can be disabled, reactivated, or reset by the Instance Owner.

Session collaborators and viewers remain bound to a valid role-specific invitation. They can join with a local account or an existing GitHub sign-in, including sessions backed by GitHub repositories. The owner connects GitHub for repository access and saves on GitHub-backed boards.
