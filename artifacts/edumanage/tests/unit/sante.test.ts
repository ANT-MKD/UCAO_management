import { describe, expect, it } from "vitest";

describe("environnement de test", () => {
  it("démarre sur un établissement vide", async () => {
    const S = await import("@/data/studentStore");
    expect(S.getUserAccounts()).toHaveLength(0);
    expect(S.installationRequise()).toBe(true);
    expect(S.getAnneeActuelle()).toBe("");
  });
});
