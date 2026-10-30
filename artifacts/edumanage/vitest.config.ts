import { defineConfig } from "vitest/config";
import path from "path";

/** Tests des calculs et des règles métier : ils utilisent les vraies fonctions de l'application,
 * dans un navigateur simulé (happy-dom) pour disposer du stockage local. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.ts"],
    // Chaque fichier repart d'un établissement vide (stores rechargés, stockage vidé).
    isolate: true,
    setupFiles: ["tests/unit/setup.ts"],
  },
});
