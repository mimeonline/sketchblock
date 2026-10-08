# Users and roles

import {GuideFlow} from '@site/src/components/GuideVisuals';

The first production setup creates one Instance Owner. The Instance Owner manages local accounts, system diagnostics, and the audit log. Regular users connect and use their own repositories without administrator approval. They can also collaborate on instance-workspace boards with local accounts; that flow does not require GitHub.

<GuideFlow
  label="Account and invitation flow"
  steps={[
    {title: 'Set up', description: 'Create the first Instance Owner and manage local accounts.'},
    {title: 'Sign in', description: 'Use a local account or an existing GitHub sign-in.'},
    {title: 'Invite', description: 'Issue a valid role-specific invitation for the session.'},
    {title: 'Participate', description: 'Join with the invited role and its matching access.'},
  ]}
  caption="A valid invitation scopes the session; it does not grant a general workspace or repository entitlement."
/>

## Account roles and session roles

| Scope | Role | Responsibility |
| --- | --- | --- |
| **Account** | Instance Owner | Manages local accounts, diagnostics, and the audit log. |
| **Account** | Regular user | Uses their own repositories and instance-workspace boards. |
| **Session** | Owner | Controls the live board and saves the result. |
| **Session** | Collaborator | Edits the shared canvas. |
| **Session** | Viewer | Follows the session without editing. |

## First sign-in and account management

New users receive a one-time start password and must replace it on first login. Accounts can be disabled, reactivated, or reset by the Instance Owner.

Session collaborators and viewers remain bound to a valid role-specific invitation. They can join with a local account or an existing GitHub sign-in, including sessions backed by GitHub repositories. The owner connects GitHub for repository access and saves on GitHub-backed boards.
