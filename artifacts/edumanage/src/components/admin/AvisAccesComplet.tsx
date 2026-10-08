import type { ReactNode } from "react";
import { Lock } from "lucide-react";

/** Bandeau des pages consultables par un compte limité par un rôle mais dont les actions sont
 * réservées aux administrateurs à accès complet (rôles, comptes à accès complet, réinitialisation). */
export function AvisAccesComplet({ children, testId = "avis-acces-complet" }: { children: ReactNode; testId?: string }) {
  return (
    <div className="flex items-start gap-2 p-3 mb-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 text-sm" data-testid={testId}>
      <Lock size={15} className="mt-0.5 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}
