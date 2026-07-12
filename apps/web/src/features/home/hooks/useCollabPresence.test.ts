import { describe, expect, it } from "vitest";

import { resolveBrowserCollabServerUrl } from "./useCollabPresence";

describe("resolveBrowserCollabServerUrl", () => {
  it("uses the local collab server during localhost development", () => {
    expect(
      resolveBrowserCollabServerUrl(undefined, {
        hostname: "localhost",
        origin: "http://localhost:4512",
      }),
    ).toBe("http://localhost:4513");
  });

  it("uses the browser origin on public hosts when no public collab URL is configured", () => {
    expect(
      resolveBrowserCollabServerUrl(undefined, {
        hostname: "sketchblock.example.com",
        origin: "https://sketchblock.example.com",
      }),
    ).toBe("https://sketchblock.example.com");
  });

  it("guards public hosts from stale localhost socket URLs baked into the client build", () => {
    expect(
      resolveBrowserCollabServerUrl("http://localhost:4513", {
        hostname: "sketchblock.example.com",
        origin: "https://sketchblock.example.com",
      }),
    ).toBe("https://sketchblock.example.com");
  });

  it("keeps explicitly configured public collab URLs", () => {
    expect(
      resolveBrowserCollabServerUrl("https://collab.example.test", {
        hostname: "sketchblock.example.com",
        origin: "https://sketchblock.example.com",
      }),
    ).toBe("https://collab.example.test");
  });
});
