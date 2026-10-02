import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  getCurrentOwner: vi.fn(),
  getOwnedSession: vi.fn(),
  validateSessionInvite: vi.fn(),
  validateSessionInviteGrant: vi.fn(),
  recordSessionParticipant: vi.fn(),
  upsertCollabSessionSnapshot: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => mocks.cookieJar.has(name) ? { value: mocks.cookieJar.get(name) } : undefined,
}) }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));
vi.mock("@/features/home/templates/HomeTemplate", () => ({ JoinSessionTemplate: () => null }));
vi.mock("@/lib/server/auth/owner-session", () => ({
  getCurrentOwner: mocks.getCurrentOwner,
  requireOwnerPageAuth: mocks.getCurrentOwner,
}));
vi.mock("@/lib/server/database/session-store", () => ({
  getSession: async () => ({ id: "workshop", repositoryId: "repo-1", drawingPath: "board.excalidraw" }),
  getOwnedSession: mocks.getOwnedSession,
}));
vi.mock("@/lib/server/database/session-invite-store", () => ({
  validateSessionInvite: mocks.validateSessionInvite,
  validateSessionInviteGrant: mocks.validateSessionInviteGrant,
  recordSessionParticipant: mocks.recordSessionParticipant,
  isParticipantRemoved: async () => false,
}));
vi.mock("@/lib/server/collab/collab-server-client", () => ({
  getCollabSessionSnapshot: async () => ({ status: "active", snapshot: { content: { elements: [] } }, audit: [{ actor: "owner" }] }),
  registerCollabSession: vi.fn(),
  upsertCollabSessionSnapshot: mocks.upsertCollabSessionSnapshot,
}));
vi.mock("@/lib/server/database/repository-store", () => ({ requireOwnedRepositoryById: vi.fn(), requireRepositoryById: vi.fn() }));
vi.mock("@/lib/server/application/drawing-use-cases", () => ({ openDrawing: vi.fn() }));

import { signPayload, verifySignedPayload } from "@/lib/server/auth/crypto";
import type { CollabTicketPayload } from "@/lib/server/auth/collab-ticket";
import JoinSessionPage from "@/app/join/[sessionId]/page";
import { GET as getState, PATCH as patchState } from "@/app/api/sessions/[sessionId]/state/route";
import { POST as getSocketToken } from "@/app/api/auth/socket-token/route";
import { GET as claimInvite } from "./route";

const context = { params: Promise.resolve({ sessionId: "workshop" }) };

describe("workshop claim and reload contract (signed cookies, mocked database and collab transport)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.cookieJar.clear();
    process.env.SKETCHBLOCK_AUTH_MODE = "github";
    process.env.APP_BASE_URL = "https://workshop.example.test";
    process.env.APP_AUTH_SECRET = "workshop-test-secret-long-enough-for-signing";
    mocks.cookieJar.set("sketchblock_auth", signPayload({ id: 42, login: "guest", name: "Guest", permission: "read", expiresAt: Date.now() + 60_000 }, "participant-auth"));
    mocks.getCurrentOwner.mockResolvedValue({ id: "foreign-local-user", username: "local" });
    mocks.getOwnedSession.mockResolvedValue(null);
    mocks.validateSessionInviteGrant.mockResolvedValue(true);
    mocks.upsertCollabSessionSnapshot.mockResolvedValue({ content: { elements: [] } });
  });

  it.each(["collaborator", "viewer"] as const)("claims, reloads and enforces %s access without the invite URL", async (role) => {
    mocks.validateSessionInvite.mockResolvedValue({ id: "invite-1", sessionId: "workshop", role, token: "raw-secret", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const claim = await claimInvite(new NextRequest("https://workshop.example.test/api/sessions/workshop/claim?invite=raw-secret"), context);
    expect(claim.headers.get("location")).toBe("https://workshop.example.test/join/workshop");
    for (const cookie of claim.cookies.getAll()) mocks.cookieJar.set(cookie.name, cookie.value);
    expect(claim.cookies.getAll()[0].value).not.toContain("raw-secret");

    await expect(JoinSessionPage({ params: context.params, searchParams: Promise.resolve({}) })).resolves.toMatchObject({ props: { role, identity: { login: "guest" } } });
    const state = await getState(new NextRequest("https://workshop.example.test/api/sessions/workshop/state"), context);
    expect(state.status).toBe(200);
    expect(await state.json()).toMatchObject({ audit: [], snapshot: { content: { elements: [] } } });

    const ticket = await socket("collaborator");
    expect(ticket.status).toBe(200);
    const { token } = await ticket.json();
    expect(verifySignedPayload<CollabTicketPayload>(token, "collab-ticket")).toMatchObject({ role, actor: "guest", sessionId: "workshop", permission: "read" });

    const patch = await patchState(new NextRequest("https://workshop.example.test/api/sessions/workshop/state", { method: "PATCH", headers: { origin: "https://workshop.example.test" }, body: JSON.stringify({ clientId: "guest-client", content: { elements: [] } }) }), context);
    expect(patch.status).toBe(role === "collaborator" ? 200 : 403);
    expect(mocks.upsertCollabSessionSnapshot).toHaveBeenCalledTimes(role === "collaborator" ? 1 : 0);
    expect((await socket("owner")).status).toBe(404);

    mocks.validateSessionInviteGrant.mockResolvedValue(false);
    expect((await socket("viewer")).status).toBe(401);
    expect((await getState(new NextRequest("https://workshop.example.test/api/sessions/workshop/state"), context)).status).toBe(401);
    await expect(JoinSessionPage({ params: context.params, searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

function socket(role: string) {
  return getSocketToken(new NextRequest("https://workshop.example.test/api/auth/socket-token", {
    method: "POST",
    body: JSON.stringify({ sessionId: "workshop", role, clientId: "guest-client" }),
  }));
}
