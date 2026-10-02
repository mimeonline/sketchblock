import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuestJoinForm } from "./GuestJoinForm";
import messages from "../../../../messages/en.json";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

function render() {
  return rtlRender(
    <NextIntlClientProvider locale="en" messages={messages}>
      <GuestJoinForm sessionId="s1" inviteToken="tok" boardTitle="My board" />
    </NextIntlClientProvider>,
  );
}

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("GuestJoinForm", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders title, board and GitHub link", () => {
    render();
    expect(screen.getByRole("heading", { name: "Join as a guest" })).toBeInTheDocument();
    expect(screen.getByText("My board")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in with GitHub instead" })).toHaveAttribute(
      "href",
      `/api/auth/github/start?returnTo=${encodeURIComponent("/join/s1?invite=tok")}`,
    );
  });

  it("validates an empty name without calling the API", () => {
    const fetchMock = mockFetch(200, {});
    render();
    fireEvent.click(screen.getByRole("button", { name: "Watch board" }));
    expect(screen.getByRole("alert")).toHaveTextContent("1 to 40");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the claim and navigates on success", async () => {
    const fetchMock = mockFetch(200, { ok: true, redirect: "/join/s1?role=viewer" });
    render();
    fireEvent.change(screen.getByLabelText("Your display name"), { target: { value: " Alex " } });
    fireEvent.click(screen.getByRole("button", { name: "Watch board" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/join/s1?role=viewer"));
    expect(refresh).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sessions/s1/claim-guest");
    expect(JSON.parse(init.body)).toEqual({ invite: "tok", displayName: "Alex" });
  });

  it.each([
    [403, "guests_disabled", "not allowed viewing"],
    [404, "invalid_invite", "invalid or has expired"],
    [410, "session_closed", "has ended"],
    [429, "rate_limited", "Too many attempts"],
    [400, "invalid_name", "1 to 40"],
  ])("maps %s %s", async (status, code, text) => {
    mockFetch(status, { code });
    render();
    fireEvent.change(screen.getByLabelText("Your display name"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Watch board" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(replace).not.toHaveBeenCalled();
  });
});
