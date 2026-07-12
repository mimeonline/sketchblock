import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../messages/de.json";

import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders a human-readable status label", () => {
    render(<NextIntlClientProvider locale="de" messages={messages}><StatusBadge value="ready" /></NextIntlClientProvider>);

    expect(screen.getByText("Bereit")).toBeInTheDocument();
  });

  it("uses the error color family for error states", () => {
    render(<NextIntlClientProvider locale="de" messages={messages}><StatusBadge value="error" /></NextIntlClientProvider>);

    expect(screen.getByText("Fehler")).toHaveClass("border-destructive/25");
  });
});
