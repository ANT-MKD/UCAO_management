import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  DollarSign,
  BookOpen,
  Library,
  CalendarDays,
  MessageSquare,
  FileText,
  Shield,
} from "lucide-react";
import { wipHref } from "@/lib/adminWipPages";

/**
 * Configuration de navigation admin.
 * Les pages métier existantes pointent vers leurs routes.
 * Les pages pas encore développées pointent vers `/admin/wip/:id` (placeholder).
 */

export interface AdminNavNode {
  id: string;
  label: string;
  href?: string;
  children?: AdminNavNode[];
}

export interface AdminNavSection {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: AdminNavNode[];
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    href: "/admin/dashboard",
  },
  {
    id: "academiques",
    label: "Académiques",
    icon: Library,
    children: [
      { id: "acad-filieres", label: "Filières", href: "/admin/filieres" },
      { id: "acad-niveaux", label: "Niveaux", href: "/admin/niveaux" },
      { id: "acad-semestres", label: "Semestres", href: "/admin/semestres" },
      { id: "acad-classes", label: "Classes", href: "/admin/classes" },
      { id: "acad-salles", label: "Salles", href: "/admin/salles" },
      { id: "acad-ues", label: "Unités d'Ens. (UE)", href: "/admin/ues" },
      { id: "acad-ecs", label: "Éléments Const. (EC)", href: "/admin/ecs" },
    ],
  },
  {
    id: "etudiants",
    label: "Étudiants",
    icon: GraduationCap,
    children: [
      { id: "etudiants-liste", label: "Liste étudiants", href: "/admin/students" },
      { id: "etudiants-ajouter", label: "Ajouter étudiants", href: "/admin/students/new" },
      { id: "etudiants-reinscrire", label: "Réinscrire étudiants", href: "/admin/students/reinscription" },
      { id: "etudiants-interdire", label: "Interdire / Autoriser étudiants", href: "/admin/students/access" },
      { id: "etudiants-carte", label: "Carte étudiant", href: "/admin/students/card" },
    ],
  },
  {
    id: "professeurs",
    label: "Professeurs",
    icon: Users,
    children: [
      { id: "prof-liste", label: "Liste professeurs", href: "/admin/teachers" },
      { id: "prof-ajouter", label: "Ajouter professeurs", href: "/admin/teachers/new" },
      { id: "prof-cours", label: "Cours programmés", href: "/admin/teachers/courses" },
      { id: "prof-planning", label: "Planning professeurs", href: "/admin/teachers/planning" },
      { id: "prof-taux", label: "Taux horaire / Forfait", href: "/admin/teachers/rates" },
      { id: "prof-vh", label: "Mise à jour V.H", href: "/admin/teachers/volumes" },
      { id: "prof-statut-cours", label: "Mise à jour statut cours", href: "/admin/teachers/course-status" },
      { id: "prof-pointage-nouveau", label: "Nouveau pointage", href: "/admin/teachers/pointage/new" },
      { id: "prof-pointage-traitement", label: "Traitement pointage", href: "/admin/teachers/pointage" },
      { id: "prof-rallonge-nouvelle", label: "Nouvelle demande de rallonge", href: "/admin/teachers/rallonge/new" },
      { id: "prof-rallonge-traitement", label: "Traitement rallonge", href: "/admin/teachers/rallonge" },
      { id: "prof-absence-nouveau", label: "Nouveau constat absence/retard", href: "/admin/teachers/absence/new" },
      { id: "prof-absence-retard", label: "Absence / Retard", href: "/admin/teachers/absence" },
      { id: "prof-contrat", label: "Contrat professeur", href: "/admin/teachers/contracts" },
    ],
  },
  {
    id: "finances",
    label: "Finances",
    icon: DollarSign,
    children: [
      { id: "fin-param", label: "Paramétrage finances", href: "/admin/finance-parametrage" },
      { id: "fin-grille-frais", label: "Configuration des frais (grille tarifaire)", href: "/admin/frais" },
      {
        id: "fin-quittance",
        label: "Quittance",
        children: [
          { id: "fin-quittance-nouvelle", label: "Nouvelle quittance", href: "/admin/paiements/new" },
          { id: "fin-quittance-liste", label: "Les quittances", href: "/admin/paiements" },
          { id: "fin-quittance-masse", label: "Émission en masse", href: "/admin/emissions-masse" },
        ],
      },
      {
        id: "fin-encaissement",
        label: "Encaissement",
        children: [
          { id: "fin-enc-nouveau", label: "Nouvel encaissement", href: "/admin/paiements/new" },
          { id: "fin-enc-pec", label: "Nouvel encaissement de PEC", href: "/admin/encaissements-pec/new" },
          { id: "fin-enc-pec-masse", label: "Nouvel encaissement de PEC en masse", href: "/admin/encaissements-pec-masse" },
          { id: "fin-enc-pec-liste", label: "Liste encaissement PEC", href: "/admin/encaissements-pec" },
          { id: "fin-enc-pec-masse2", label: "PEC en masse", href: "/admin/pec-masse" },
          { id: "fin-enc-liste", label: "Les encaissements", href: "/admin/encaissements" },
          { id: "fin-enc-facture", label: "Facture autres services", href: "/admin/factures-autres-services" },
        ],
      },
      {
        id: "fin-avoir",
        label: "Avoir",
        children: [
          { id: "fin-avoir-enc", label: "Les encaissements", href: "/admin/encaissements" },
          { id: "fin-avoir-depot", label: "Dépôt avoir", href: "/admin/avoir/depots/new" },
          { id: "fin-avoir-remboursement", label: "Remboursement avoir", href: "/admin/avoir/remboursements/new" },
          { id: "fin-avoir-remboursements", label: "Les remboursements", href: "/admin/avoir/remboursements" },
          { id: "fin-avoir-consentement", label: "Consentement avoir", href: "/admin/avoir/consentement" },
        ],
      },
      {
        id: "fin-decompte",
        label: "Décompte",
        children: [
          { id: "fin-decompte-taux", label: "Taux horaire", href: "/admin/decomptes/taux-horaire/new" },
          { id: "fin-decompte-forfait", label: "Forfait", href: "/admin/decomptes/forfait/new" },
          { id: "fin-decompte-terme", label: "À terme", href: "/admin/decomptes/a-terme/new" },
          { id: "fin-decompte-liste", label: "Les décomptes", href: "/admin/decomptes" },
        ],
      },
      {
        id: "fin-paiement-prof",
        label: "Paiement professeur",
        children: [
          { id: "fin-paiement-prof-nouveau", label: "Nouveau paiement professeur", href: "/admin/decomptes-professeurs/new" },
          { id: "fin-paiement-prof-liste", label: "Les paiements professeurs", href: "/admin/decomptes-professeurs" },
        ],
      },
      {
        id: "fin-devis",
        label: "Devis",
        children: [
          { id: "fin-devis-nouveau", label: "Nouveau devis", href: "/admin/devis/new" },
          { id: "fin-devis-liste", label: "Les devis", href: "/admin/devis" },
          { id: "fin-devis-grille", label: "Grille tarifaire", href: "/admin/grille-frais" },
        ],
      },
      {
        id: "fin-reduction",
        label: "Réduction",
        children: [
          { id: "fin-reduction-autorisee", label: "Réduction autorisée", href: "/admin/reduction-autorisee" },
          { id: "fin-reduction-frais", label: "Réduction frais", href: "/admin/reductions-frais" },
        ],
      },
      {
        id: "fin-maj-frais",
        label: "Mise à jour frais étudiant",
        children: [
          { id: "fin-maj-ajouter", label: "Ajouter frais étudiant", href: "/admin/frais-etudiant" },
          { id: "fin-maj-supprimer", label: "Supprimer frais étudiant", href: "/admin/frais-etudiant/supprimer" },
          { id: "fin-maj-ajouter-masse", label: "Ajout frais en masse", href: "/admin/frais-etudiant/masse/ajouter" },
          { id: "fin-maj-suppression", label: "Suppression frais", href: "/admin/frais-etudiant/masse/supprimer" },
          { id: "fin-maj-liste", label: "Les frais étudiant", href: "/admin/frais-etudiant/liste" },
        ],
      },
      {
        id: "fin-reprise",
        label: "Reprise frais",
        children: [
          { id: "fin-reprise-nouvelle", label: "Nouvelle reprise frais étudiant", href: "/admin/reprise-frais/new" },
          { id: "fin-reprise-liste", label: "Reprise frais étudiant", href: "/admin/reprise-frais" },
        ],
      },
      { id: "fin-rappel", label: "Rappel des paiements", href: wipHref("fin-rappel") },
      {
        id: "fin-pec",
        label: "Prise en charge",
        children: [
          { id: "fin-pec-organisme", label: "Organisme de PEC", href: "/admin/organismes-pec" },
          { id: "fin-pec-liste", label: "Les prises en charge", href: "/admin/prises-en-charge" },
          { id: "fin-pec-regularisation", label: "Régularisation prise en charge", href: "/admin/prises-en-charge" },
        ],
      },
      { id: "fin-export", label: "Export comptable", href: wipHref("fin-export") },
      { id: "fin-derogation", label: "Dérogation des paiements", href: wipHref("fin-derogation") },
    ],
  },
  {
    id: "scolarite",
    label: "Scolarité",
    icon: BookOpen,
    children: [
      { id: "scol-param", label: "Paramétrage scolarité", href: wipHref("scol-param") },
      {
        id: "scol-inscription",
        label: "Inscription",
        children: [
          { id: "scol-insc-fiche", label: "Fiche d'inscription", href: "/admin/students/new" },
          { id: "scol-insc-correction", label: "Correction d'inscription", href: "/admin/students" },
          { id: "scol-insc-definitive", label: "Inscription définitive", href: wipHref("scol-insc-definitive") },
        ],
      },
      {
        id: "scol-classes",
        label: "Classes",
        children: [
          { id: "scol-classes-liste", label: "Les classes", href: "/admin/classes" },
          { id: "scol-classes-cloture", label: "Clôture année", href: "/admin/annees" },
          { id: "scol-classes-bascule", label: "Bascule année", href: "/admin/annees" },
        ],
      },
      {
        id: "scol-evaluation",
        label: "Évaluation",
        children: [
          { id: "scol-eval-nouvelle", label: "Nouvelle évaluation", href: wipHref("scol-eval-nouvelle") },
          { id: "scol-eval-devoir", label: "Devoir", href: wipHref("scol-eval-devoir") },
          { id: "scol-eval-poids", label: "Mise à jour poids évaluation", href: wipHref("scol-eval-poids") },
          { id: "scol-eval-poids-masse", label: "Mise à jour poids évaluation en masse", href: wipHref("scol-eval-poids-masse") },
        ],
      },
      {
        id: "scol-notes",
        label: "Notes",
        children: [
          { id: "scol-notes-saisie", label: "Saisie notes", href: "/admin/notes" },
          { id: "scol-notes-etudiants", label: "Notes étudiants", href: "/admin/moyennes" },
          { id: "scol-notes-rattrapage", label: "Rattrapage", href: wipHref("scol-notes-rattrapage") },
        ],
      },
      {
        id: "scol-maj-cours",
        label: "Mise à jour cours",
        children: [
          { id: "scol-maj-cours-etu", label: "Mise à jour cours étudiants", href: "/admin/ecs" },
          { id: "scol-maj-cours-force", label: "Ajout cours forcé", href: wipHref("scol-maj-cours-force") },
        ],
      },
      { id: "scol-abandon", label: "Abandon", href: wipHref("scol-abandon") },
      { id: "scol-absence", label: "Absence", href: wipHref("scol-absence") },
      { id: "scol-retard", label: "Retard", href: wipHref("scol-retard") },
      {
        id: "scol-assiduite",
        label: "Assiduité",
        children: [
          { id: "scol-ass-nouvelle", label: "Nouvelle assiduité", href: wipHref("scol-ass-nouvelle") },
          { id: "scol-ass-liste", label: "Les assiduités", href: wipHref("scol-ass-liste") },
          { id: "scol-ass-periode", label: "Absence par période", href: wipHref("scol-ass-periode") },
          { id: "scol-ass-periode-liste", label: "Liste absence par période", href: wipHref("scol-ass-periode-liste") },
          { id: "scol-ass-cahier", label: "Cahier de textes", href: "/admin/cahiers" },
        ],
      },
    ],
  },
  {
    id: "edt",
    label: "Emploi du temps",
    icon: CalendarDays,
    children: [
      { id: "edt-param", label: "Paramétrage de l'emploi du temps", href: "/admin/schedule/new" },
      { id: "edt-grille", label: "Emploi du temps", href: "/admin/schedule" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: MessageSquare,
    children: [
      { id: "com-param", label: "Paramétrage de la communication", href: wipHref("com-param") },
      { id: "com-envoi", label: "Envoi message", href: "/admin/messages" },
      { id: "com-mails", label: "Liste mails envoyés", href: wipHref("com-mails") },
      { id: "com-validation", label: "Validation mails", href: wipHref("com-validation") },
      { id: "com-publicite", label: "Publicité et actualité", href: wipHref("com-publicite") },
      { id: "com-demandes", label: "Demandes", href: "/admin/requests" },
    ],
  },
  {
    id: "bulletins",
    label: "Bulletins",
    icon: FileText,
    children: [
      { id: "bul-param", label: "Paramétrage bulletins", href: wipHref("bul-param") },
      { id: "bul-generation", label: "Génération bulletins", href: "/admin/releves" },
      { id: "bul-deliberation", label: "Délibération", href: "/admin/deliberations" },
      { id: "bul-declassement", label: "Déclassement élèves", href: wipHref("bul-declassement") },
      { id: "bul-attestations", label: "Attestations", href: "/admin/attestations" },
    ],
  },
  {
    id: "securite",
    label: "Sécurité",
    icon: Shield,
    children: [
      { id: "sec-users", label: "Liste des utilisateurs", href: "/admin/users" },
      { id: "sec-user-add", label: "Ajouter nouvel utilisateur", href: wipHref("sec-user-add") },
      { id: "sec-roles", label: "Gestion des rôles", href: "/admin/users" },
      { id: "sec-droits", label: "Droit accès", href: wipHref("sec-droits") },
      { id: "sec-audit", label: "Journal d'audit", href: "/admin/audit" },
    ],
  },
];

function pathMatches(location: string, href: string): boolean {
  if (location === href) return true;
  if (href !== "/admin" && location.startsWith(href + "/")) return true;
  return false;
}

function collectHrefs(node: AdminNavNode, out: { href: string; path: AdminNavNode[] }[], trail: AdminNavNode[] = []) {
  const next = [...trail, node];
  if (node.href) out.push({ href: node.href, path: next });
  node.children?.forEach((c) => collectHrefs(c, out, next));
}

export function resolveNavFromLocation(location: string): {
  section: AdminNavSection | null;
  trail: AdminNavNode[];
} {
  let best: { section: AdminNavSection; trail: AdminNavNode[]; score: number } | null = null;

  for (const section of ADMIN_NAV_SECTIONS) {
    if (section.href && pathMatches(location, section.href)) {
      const score = section.href.length;
      if (!best || score > best.score) {
        best = { section, trail: [], score };
      }
    }
    if (!section.children) continue;
    const matches: { href: string; path: AdminNavNode[] }[] = [];
    section.children.forEach((c) => collectHrefs(c, matches));
    for (const m of matches) {
      if (!pathMatches(location, m.href)) continue;
      const score = m.href.length;
      if (!best || score > best.score) {
        best = { section, trail: m.path, score };
      }
    }
  }

  return best
    ? { section: best.section, trail: best.trail }
    : { section: null, trail: [] };
}

export function hasChildren(node: AdminNavNode): boolean {
  return !!(node.children && node.children.length > 0);
}
