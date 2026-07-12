import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../messages/de.json";

import { RepositorySwitcher } from "./RepositorySwitcher";

const repositories = [
  {
    id: "github-1",
    githubRepositoryId: 1,
    owner: "mimeonline",
    name: "sketchblock",
    branch: "main",
    htmlUrl: "https://github.com/mimeonline/sketchblock",
    apiUrl: "https://api.github.com/repos/mimeonline/sketchblock",
    private: true,
    status: "ready" as const,
  },
  {
    id: "github-2",
    githubRepositoryId: 2,
    owner: "mimeonline",
    name: "software-factory",
    branch: "main",
    htmlUrl: "https://github.com/mimeonline/software-factory",
    apiUrl: "https://api.github.com/repos/mimeonline/software-factory",
    private: true,
    status: "ready" as const,
  },
];

describe("RepositorySwitcher", () => {
  it("shows the active repository and switches to another connected repository", async () => {
    const onSwitch = vi.fn();
    render(
      <NextIntlClientProvider locale="de" messages={messages}>
        <RepositorySwitcher
          repositories={repositories}
          activeRepository={repositories[0]}
          switching={false}
          onSwitch={onSwitch}
        />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Aktives Repository wechseln" }));
    const option = await screen.findByRole("option", { name: "mimeonline/software-factory" });
    fireEvent.keyDown(option, { key: "Enter" });

    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith("github-2"));
  });
});
