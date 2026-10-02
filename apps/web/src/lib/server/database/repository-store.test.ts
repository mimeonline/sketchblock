import { describe, expect, it } from "vitest";

import { selectRepositoryRecordId } from "./repository-store";

const userA = "aaaaaaaa-1111-2222-3333-444444444444";
const userB = "bbbbbbbb-1111-2222-3333-444444444444";

describe("selectRepositoryRecordId", () => {
  it("reuses the existing record id of the same user", () => {
    expect(
      selectRepositoryRecordId({ githubRepositoryId: 7, userId: userA, existingId: "github-7-custom", defaultIdOwnerUserId: userB }),
    ).toBe("github-7-custom");
  });

  it("uses the default id when it is free", () => {
    expect(
      selectRepositoryRecordId({ githubRepositoryId: 7, userId: userA, existingId: null, defaultIdOwnerUserId: null }),
    ).toBe("github-7");
  });

  it("uses a user-suffixed id when another user owns the default id", () => {
    expect(
      selectRepositoryRecordId({ githubRepositoryId: 7, userId: userB, existingId: null, defaultIdOwnerUserId: userA }),
    ).toBe("github-7-bbbbbbbb");
  });
});
