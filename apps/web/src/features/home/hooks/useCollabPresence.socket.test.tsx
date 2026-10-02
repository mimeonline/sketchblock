import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const socket = { connected: true, id: "socket-test", on: vi.fn((event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler)), emit: vi.fn(), disconnect: vi.fn(), timeout: vi.fn(), emitWithAck: vi.fn() };
  socket.timeout.mockReturnValue(socket);
  return { socket, handlers };
});
vi.mock("socket.io-client", () => ({ io: () => mock.socket }));
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
