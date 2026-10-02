import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";

import { AppSidebar } from "./AppSidebar";
import messages from "../../../../messages/de.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/repositories",
}));

describe("AppSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  function renderSidebar(role: "instance_owner" | "user", deploymentEnvironment: "local" | "production" = "local") {
    return render(
      <NextIntlClientProvider locale="de" messages={messages}>
        <AppSidebar deploymentEnvironment={deploymentEnvironment} role={role} />
      </NextIntlClientProvider>,
    );
  }

  it("submits logout through the backend POST route", () => {
    renderSidebar("instance_owner");

    const logoutButton = screen.getByRole("button", { name: "Abmelden" });
    const form = logoutButton.closest("form");

    expect(form).toHaveAttribute("action", "/api/auth/logout");
    expect(form).toHaveAttribute("method", "post");
  });

  it("blendet die Owner-Verwaltung für reguläre User aus", () => {
    renderSidebar("user");

    expect(screen.queryByRole("link", { name: "Benutzer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "System" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Repository" })).not.toHaveLength(0);
  });

  it("kennzeichnet eine Produktionsumgebung eindeutig", () => {
    renderSidebar("instance_owner", "production");

    expect(screen.getByText("Produktivinstanz")).toBeInTheDocument();
    expect(screen.queryByText("Lokale Instanz")).not.toBeInTheDocument();
  });
});
