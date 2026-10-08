# Repositories

import {ScreenshotFigure} from '@site/src/components/GettingStartedVisuals';
import {GuideFlow} from '@site/src/components/GuideVisuals';

Each local user can connect multiple writable GitHub repositories. Exactly one repository is the active work context at a time.

<ScreenshotFigure
  src="/img/docs/getting-started/repositories.png"
  alt="Local Sketchblock demo workspace showing the repository selection area"
  caption="Workspace selection in the local demo. A connected GitHub owner selects an available repository in this area."
/>

<GuideFlow
  label="Repository context"
  steps={[
    {title: 'Connect', description: 'Connect GitHub and add a writable repository to the local account.'},
    {title: 'Select', description: 'Choose one connected repository as the active work context.'},
    {title: 'Scan', description: 'Rescan files so boards and their Found status reflect the repository.'},
    {title: 'Open and save', description: 'Work in the selected repository; reconnect GitHub when an expired connection requires it.'},
  ]}
  caption="The local demo illustrates the selection area; repository availability depends on the connected owner."
/>

## Select the active repository

Use the repository switcher in the page header to change the active context. Dashboard metrics, boards, sessions, editor reads, and saves follow that selection. Existing sessions keep their original repository association.

The repository page lets you add, activate, rescan, and disconnect your own repositories. Server-side ownership checks protect every mutation.

Repository records belong to each local user. Two users can connect the same GitHub repository independently without transferring the other's record. Each user needs their own GitHub connection and repository permissions.

## Scan and reconnect

A board marked **Found** (previously **Indexed**) has been discovered during the repository scan. Open it to load its content; this status does not confirm a live connection or a successful save. Rescan after adding or moving files outside Sketchblock.

If GitHub access expires or you sign in again after an upgrade, use **Reconnect GitHub**. The selected repository remains available in the workspace, and its boards can load and save once access is restored.
