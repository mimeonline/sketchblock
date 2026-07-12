---
title: Why Sketchblock
description: Open Excalidraw files from GitHub, edit them together in the browser, and save the result directly as a commit.
slug: /getting-started/why-sketchblock
---

# Why Sketchblock

Technical teams often store architecture diagrams and system maps as `.excalidraw` files beside their code and documentation. Git gives those files a clear home, a reviewable history, and a connection to the project they explain.

Updating the diagram interrupts that connection. The file must be downloaded or opened separately, edited in Excalidraw, exported again, placed back into the repository, and committed. A collaborative whiteboard session creates an additional workspace whose latest result still has to return to Git.

Sketchblock turns that manual round trip into one browser workflow: open from GitHub, edit alone or together, and commit the reviewed `.excalidraw` file back to the project.

## The manual round trip

Without a repository-connected workspace, a small diagram update typically requires these steps:

1. Find the `.excalidraw` file in the repository.
2. Download or open the file in a separate Excalidraw workspace.
3. Edit the diagram or move the work into a collaboration session.
4. Export or download the updated file.
5. Replace the existing file in the project.
6. Create a Git commit for the result.

Every handoff creates room for an outdated file, a lost result, or uncertainty about which version belongs to the project.

## The gaps around that workflow

### Git stores the file but does not provide a live canvas

Git gives an Excalidraw file ownership, history, and reviewability. It does not provide a practical room where several people can work on that file together in real time.

### Shared whiteboards do not update the repository file

A live session can produce the newest and most useful version of a diagram. The `.excalidraw` file in Git remains unchanged until someone manually transfers and commits that result.

### Guests need focused access

Customers, reviewers, and workshop participants often need access to one diagram for one conversation. They should not need Git knowledge or broad access to the repository that contains it.

### Sensitive context needs controlled infrastructure

Architecture diagrams can contain system boundaries, customer context, and operational details. Teams need a clear answer to where the artifact lives, who can open it, and how the collaboration runtime is operated.

## What Sketchblock changes

Sketchblock connects the repository file, the editor, the live session, and the commit:

1. Select a board from a connected GitHub repository.
2. Open it as a live workspace.
3. Invite collaborators or viewers with role-specific access.
4. Review and refine the diagram together.
5. Save the agreed result back to the repository as a commit.

The same repository-backed artifact moves through the complete workflow. The repository remains its durable home, and the live room provides the focused space for editing and discussion.

## The benefits

- **Manual file handling decreases:** downloads, exports, and file replacement leave the normal editing path.
- **The repository stays current:** the reviewed `.excalidraw` file returns directly as a commit.
- **Context stays intact:** diagrams remain beside the code, documentation, and decisions they explain.
- **Access stays focused:** participants work with the shared artifact through defined owner, collaborator, and viewer roles.
- **Results stay traceable:** the reviewed board returns to Git as a versioned file.
- **Infrastructure stays controllable:** the complete stack can run on infrastructure you operate.
- **Adoption starts safely:** the included demo works without GitHub credentials.

## Where it fits

Sketchblock is designed for work where a visual conversation should produce a durable engineering artifact:

- architecture and design reviews;
- system and dependency maps;
- customer or partner workshops;
- technical discovery sessions;
- open-source project diagrams.

## Try the complete flow

The credential-free demo lets you edit an included board, start a live session, and verify collaborator and viewer access locally.

[Run the quickstart](./quickstart.md)
