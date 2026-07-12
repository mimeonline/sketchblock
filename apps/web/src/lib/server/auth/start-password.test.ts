import { describe, expect, it } from "vitest";

import { generateStartPassword } from "./start-password";

describe("einmaliges Startpasswort", () => {
  it("erzeugt unabhängige, URL-sichere Passwörter mit ausreichender Entropie", () => {
    const first = generateStartPassword();
    const second = generateStartPassword();

    expect(first).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(first).not.toBe(second);
  });
});
