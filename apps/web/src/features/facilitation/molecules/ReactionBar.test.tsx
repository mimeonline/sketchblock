import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "../../../../messages/en.json";
import { ReactionBar } from "./ReactionBar";

describe("ReactionBar", () => {
  afterEach(cleanup);

  it("sends the emoji with the last pointer position and shows rate-limit errors", async () => {
    const onSend = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "reaction_rate_limited" });
    rtlRender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ReactionBar onSend={onSend} getPointer={() => ({ x: 4, y: 9 })} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Send reaction 🎉" }));
    expect(onSend).toHaveBeenCalledWith("🎉", { x: 4, y: 9 });
    fireEvent.click(screen.getByRole("button", { name: "Send reaction 👍" }));
    await waitFor(() => expect(screen.getByText("Slow down a little.")).toBeInTheDocument());
  });
});
