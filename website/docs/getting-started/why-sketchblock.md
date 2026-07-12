---
title: Why Sketchblock
description: Keep visual engineering decisions connected to the code, context, and history they belong to.
slug: /getting-started/why-sketchblock
---

# Why Sketchblock

Technical teams often build shared understanding on a visual canvas. Architecture reviews, system maps, and design discussions become easier when people can point, sketch, rearrange, and clarify ideas together.

The resulting diagram frequently loses its connection to the project. It remains in a separate SaaS workspace, becomes an exported image, or survives as a link that quietly becomes outdated while the code and documentation continue to evolve.

Sketchblock keeps visual decisions connected to the engineering work they explain.

## The gap between whiteboards and Git

### Whiteboards drift away from the project

The conversation happens on a canvas while implementation, documentation, and decisions live in Git. After the meeting, the team has to decide which version is authoritative and how the visual result belongs to the project.

### Git is not a live workshop

Git gives an Excalidraw file ownership, history, and reviewability. It does not provide a practical room where several people can work on that file together in real time.

### Guests need focused access

Customers, reviewers, and workshop participants often need access to one diagram for one conversation. They should not need Git knowledge or broad access to the repository that contains it.

### Sensitive context needs controlled infrastructure

Architecture diagrams can contain system boundaries, customer context, and operational details. Teams need a clear answer to where the artifact lives, who can open it, and how the collaboration runtime is operated.

## What Sketchblock changes

Sketchblock adds a focused collaboration layer around an ordinary `.excalidraw` file:

1. Select a board from a connected GitHub repository.
2. Open it as a live workspace.
3. Invite collaborators or viewers with role-specific access.
4. Review and refine the diagram together.
5. Save the agreed result back to the repository as a commit.

The repository remains the durable home of the artifact. The live room provides the temporary space for the conversation.

## The benefits

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
