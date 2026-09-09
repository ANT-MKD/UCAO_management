/** Pages placeholder (WIP) — une entrée = une route `/admin/wip/:pageId`. */

export interface AdminWipPage {
  title: string;
  section: string;
}

/** "scol-absence" et "scol-retard" (Scolarité) étaient les deux dernières entrées encore routées
 * via wipHref() dans adminNavConfig.ts — supprimées du menu car redondantes avec "Assiduité", qui
 * couvre déjà le même besoin avec de vraies données. Aucune entrée active pour l'instant ; le
 * mécanisme reste en place pour un futur placeholder plutôt que d'être retiré entièrement. */
export const ADMIN_WIP_PAGES: Record<string, AdminWipPage> = {};

export function wipHref(pageId: string): string {
  return `/admin/wip/${pageId}`;
}
