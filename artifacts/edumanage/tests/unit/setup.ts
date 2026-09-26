import { beforeEach, vi } from "vitest";

// Établissement vide avant chaque test : stockage vidé, modules (stores) rechargés.
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
