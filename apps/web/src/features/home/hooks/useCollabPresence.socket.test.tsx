import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = { connected: true, id: "socket-test", on: vi.fn((event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler)), emit: vi.fn(), disconnect: vi.fn(), timeout: vi.fn(), emitWithAck: vi.fn() };
  const ioOptions: Array<{ auth?: (callback: (auth: { token: string }) => void) => Promise<void> }> = [];
  const io = vi.fn((_url: string, options: { auth?: (callback: (auth: { token: string }) => void) => Promise<void> }) => {
    ioOptions.push(options);
    return socket;
  });
  socket.timeout.mockReturnValue(socket);
  return { socket, handlers, io, ioOptions };
});
vi.mock("socket.io-client", () => ({ io: mock.io }));
import { useCollabPresence } from "./useCollabPresence";
import * as Y from "yjs";

describe("snapshot acknowledgements", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); mock.handlers.clear(); vi.clearAllMocks(); });
  async function connectedHook() {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "test" }) }));
    mock.socket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "session:join") ack({ ok: true, snapshot: { revision: 1, content: "initial" } });
    });
    const hook = renderHook(() => useCollabPresence({ sessionId: "session-test", clientId: "client-test", role: "collaborator" }));
    await waitFor(() => expect(mock.handlers.has("connect")).toBe(true));
    act(() => mock.handlers.get("connect")!());
    return hook;
  }
  it("adopts a conflict revision once and does not retry the rejected local payload", async () => {
    const hook = await connectedHook();
    const latest = { revision: 2, content: "remote" };
    mock.socket.emitWithAck.mockResolvedValue({ ok: false, error: "snapshot_conflict", snapshot: latest });
    await act(async () => { await expect(hook.result.current.pushSnapshot("local pending edit")).rejects.toThrow("snapshot_conflict"); });
    expect(hook.result.current.snapshot).toEqual(latest);
    expect(mock.socket.emitWithAck).toHaveBeenCalledTimes(1);
    mock.socket.emitWithAck.mockResolvedValue({ ok: true, snapshot: { revision: 3, content: "merged" } });
    await act(async () => { await hook.result.current.pushSnapshot("merged"); });
    expect(mock.socket.emitWithAck.mock.calls[1][1]).toMatchObject({ baseRevision: 2, content: "merged" });
    hook.unmount();
  });
  it("keeps a newer broadcast when a successful acknowledgement arrives late", async () => {
    const hook = await connectedHook();
    let acknowledge!: (ack: unknown) => void;
    mock.socket.emitWithAck.mockImplementation(() => new Promise((resolve) => { acknowledge = resolve; }));
    const pending = hook.result.current.pushSnapshot("local");
    act(() => mock.handlers.get("canvas:update")!({ revision: 4, content: "newer remote" }));
    await act(async () => { acknowledge({ ok: true, snapshot: { revision: 2, content: "old ack" } }); await pending; });
    expect(hook.result.current.snapshot).toMatchObject({ revision: 4, content: "newer remote" });
    hook.unmount();
  });

  it("buffers disconnected changes as one merged update and replays after joining", async () => {
    const hook = await connectedHook();
    mock.socket.connected = false;
    act(() => mock.handlers.get("disconnect")!());
    const docs = [new Y.Doc(), new Y.Doc()];
    docs.forEach((doc, index) => doc.getMap("elements").set(`local-${index}`, index));
    act(() => {
      for (const doc of docs) hook.result.current.sendYjsUpdate(window.btoa(Array.from(Y.encodeStateAsUpdate(doc), (byte) => String.fromCharCode(byte)).join("")));
    });
    expect(mock.socket.emitWithAck).not.toHaveBeenCalled();
    mock.socket.emitWithAck.mockResolvedValue({ ok: true });
    mock.socket.connected = true;
    await act(async () => mock.handlers.get("connect")!());
    expect(mock.socket.emitWithAck).toHaveBeenCalledTimes(1);
    const sent = mock.socket.emitWithAck.mock.calls[0][1];
    const recovered = new Y.Doc();
    Y.applyUpdate(recovered, Uint8Array.from(window.atob(sent.updateBase64), (character) => character.charCodeAt(0)));
    expect([...recovered.getMap("elements").keys()].sort()).toEqual(["local-0", "local-1"]);
    docs.forEach((doc) => doc.destroy()); recovered.destroy(); hook.unmount();
  });

  it("retains an unacknowledged update and safely replays it after a transport timeout", async () => {
    const hook = await connectedHook();
    vi.useFakeTimers();
    const doc = new Y.Doc(); doc.getMap("elements").set("offline-edit", true);
    const update = window.btoa(Array.from(Y.encodeStateAsUpdate(doc), (byte) => String.fromCharCode(byte)).join(""));
    mock.socket.emitWithAck.mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({ ok: true });
    await act(async () => { hook.result.current.sendYjsUpdate(update); });
    expect(mock.socket.emitWithAck).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(mock.socket.emitWithAck).toHaveBeenCalledTimes(2);
    expect(mock.socket.emitWithAck.mock.calls[1][1].updateBase64).toBe(update);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(mock.socket.emitWithAck).toHaveBeenCalledTimes(2);
    doc.destroy(); hook.unmount();
  });

  it("replays an in-flight update after reconnect without waiting for another edit", async () => {
    const hook = await connectedHook();
    let rejectFirst!: (error: Error) => void;
    mock.socket.emitWithAck
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectFirst = reject; }))
      .mockResolvedValue({ ok: true });
    const doc = new Y.Doc(); doc.getMap("elements").set("interrupted-edit", true);
    const update = window.btoa(Array.from(Y.encodeStateAsUpdate(doc), (byte) => String.fromCharCode(byte)).join(""));

    act(() => { hook.result.current.sendYjsUpdate(update); });
    expect(mock.socket.emitWithAck).toHaveBeenCalledTimes(1);
    mock.socket.connected = false;
    act(() => mock.handlers.get("disconnect")!());
    mock.socket.connected = true;
    act(() => mock.handlers.get("connect")!());
    await act(async () => { rejectFirst(new Error("transport closed")); });

    expect(mock.socket.emitWithAck).toHaveBeenCalledTimes(2);
    expect(mock.socket.emitWithAck.mock.calls[1][1].updateBase64).toBe(update);
    doc.destroy(); hook.unmount();
  });

  it("refreshes socket authentication for reconnect handshakes", async () => {
    const hook = await connectedHook();
    const auth = mock.ioOptions.at(-1)?.auth;
    expect(auth).toBeTypeOf("function");
    const tokens: string[] = [];

    await act(async () => { await auth!((value) => tokens.push(value.token)); });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ token: "refreshed" }) } as Response);
    await act(async () => { await auth!((value) => tokens.push(value.token)); });

    expect(tokens).toEqual(["test", "refreshed"]);
    expect(fetch).toHaveBeenCalledTimes(2);
    hook.unmount();
  });

  it.each([
    ["session_closed", "closed"],
    ["participant_removed", undefined],
  ] as const)("stops reconnecting after terminal %s authentication", async (code, sessionStatus) => {
    const hook = await connectedHook();
    const auth = mock.ioOptions.at(-1)?.auth;
    await act(async () => { await auth!(() => {}); });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ code, error: code === "session_closed" ? "Ended." : "Removed." }),
    } as Response);

    const tokens: string[] = [];
    await act(async () => { await auth!((value) => tokens.push(value.token)); });
    act(() => mock.handlers.get("connect_error")!(new Error("collab_ticket_missing")));

    expect(tokens).toEqual([""]);
    expect(mock.socket.disconnect).toHaveBeenCalledTimes(1);
    expect(hook.result.current.status).toBe("disconnected");
    expect(hook.result.current.sessionStatus).toBe(sessionStatus);
    expect(hook.result.current.error).toBe(code === "participant_removed" ? "Removed." : undefined);
    hook.unmount();
  });

  it("settles an authentication callback that finishes after unmount", async () => {
    const hook = await connectedHook();
    const auth = mock.ioOptions.at(-1)?.auth;
    await act(async () => { await auth!(() => {}); });
    let resolveToken!: (response: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { resolveToken = resolve; }));
    const tokens: string[] = [];
    const pendingAuth = auth!((value) => tokens.push(value.token));

    hook.unmount();
    resolveToken({ ok: true, json: async () => ({ token: "late-token" }) } as Response);
    await pendingAuth;

    expect(tokens).toEqual([""]);
  });

  it("retains both remote updates when React batches socket events", async () => {
    const hook = await connectedHook();
    const docs = [new Y.Doc(), new Y.Doc()];
    docs.forEach((doc, index) => doc.getMap("elements").set(`remote-${index}`, index));
    act(() => {
      docs.forEach((doc, index) => mock.handlers.get("yjs:update")!({
        updatedBy: `remote-${index}`, updateBase64: window.btoa(Array.from(Y.encodeStateAsUpdate(doc), (byte) => String.fromCharCode(byte)).join("")),
      }));
    });
    const received = hook.result.current.remoteYjsUpdate!;
    const recovered = new Y.Doc();
    Y.applyUpdate(recovered, Uint8Array.from(window.atob(received.updateBase64), (character) => character.charCodeAt(0)));
    expect([...recovered.getMap("elements").keys()].sort()).toEqual(["remote-0", "remote-1"]);
    docs.forEach((doc) => doc.destroy()); recovered.destroy(); hook.unmount();
  });
});

describe("facilitation events", () => {
  afterEach(() => { vi.unstubAllGlobals(); mock.handlers.clear(); vi.clearAllMocks(); });

  it("reads moderation/votes from the join ack and applies broadcasts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "test" }) }));
    const initial = { followOwner: false, editingLocked: false, timer: null, voting: { open: false, votesPerParticipant: 3 } };
    mock.socket.emit.mockImplementation((event, _payload, ack) => {
      if (event === "session:join") ack({ ok: true, moderation: initial, votes: { a: ["x"] } });
    });
    const hook = renderHook(() => useCollabPresence({ sessionId: "s", clientId: "c", role: "collaborator" }));
    await waitFor(() => expect(mock.handlers.has("connect")).toBe(true));
    act(() => mock.handlers.get("connect")!());
    expect(hook.result.current.votes).toEqual({ a: ["x"] });
    act(() => mock.handlers.get("moderation:state")!({ moderation: { ...initial, editingLocked: true } }));
    expect(hook.result.current.moderation.editingLocked).toBe(true);
    act(() => mock.handlers.get("votes:state")!({ votes: { b: ["y", "z"] } }));
    expect(hook.result.current.votes).toEqual({ b: ["y", "z"] });
    act(() => mock.handlers.get("viewport:update")!({ scrollX: 1, scrollY: 2, zoom: 1.5 }));
    expect(hook.result.current.remoteViewport).toMatchObject({ scrollX: 1, scrollY: 2, zoom: 1.5 });
    act(() => mock.handlers.get("reaction")!({ emoji: "🎉", pointer: { x: 1, y: 2 } }));
    expect(hook.result.current.reactions).toHaveLength(1);
    mock.socket.emitWithAck.mockResolvedValue({ ok: false, error: "vote_limit_reached" });
    let ack: unknown;
    await act(async () => { ack = await hook.result.current.toggleVote("a"); });
    expect(ack).toEqual({ ok: false, error: "vote_limit_reached" });
    expect(mock.socket.emitWithAck).toHaveBeenCalledWith("vote:toggle", { sessionId: "s", elementId: "a" });
    hook.unmount();
  });

  it("does not raise the sync error for editing_locked yjs acks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "test" }) }));
    mock.socket.emit.mockImplementation((event, _payload, ack) => { if (event === "session:join") ack({ ok: true }); });
    mock.socket.emitWithAck.mockResolvedValue({ ok: false, error: "editing_locked" });
    const hook = renderHook(() => useCollabPresence({ sessionId: "s", clientId: "c", role: "collaborator" }));
    await waitFor(() => expect(mock.handlers.has("connect")).toBe(true));
    act(() => mock.handlers.get("connect")!());
    const doc = new Y.Doc(); doc.getMap("e").set("k", 1);
    await act(async () => { hook.result.current.sendYjsUpdate(window.btoa(Array.from(Y.encodeStateAsUpdate(doc), (b) => String.fromCharCode(b)).join(""))); });
    expect(mock.socket.emitWithAck).toHaveBeenCalledTimes(1);
    expect(hook.result.current.syncError).toBeUndefined();
    hook.unmount();
  });
});
