/** Pages placeholder (WIP) — une entrée = une route `/admin/wip/:pageId`. */

export interface AdminWipPage {
  title: string;
  section: string;
}

/** Seules "scol-absence" et "scol-retard" sont encore routées via wipHref() dans
 * adminNavConfig.ts — toutes les autres entrées historiques ont depuis reçu une vraie
 * page et un vrai href, donc retirées d'ici pour ne pas laisser de métadonnées mortes. */
export const ADMIN_WIP_PAGES: Record<string, AdminWipPage> = {
  "scol-absence": { title: "Absence", section: "Scolarité" },
  "scol-retard": { title: "Retard", section: "Scolarité" },
};

export function wipHref(pageId: string): string {
  return `/admin/wip/${pageId}`;
}
