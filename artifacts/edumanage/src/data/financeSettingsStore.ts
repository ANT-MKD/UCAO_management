import { createListStore } from "@/lib/createListStore";

export interface TypeFraisRecord {
  id: string;
  code: string;
  intitule: string;
  remarques?: string;
}

export interface ModePaiementFinanceRecord {
  id: string;
  code: string;
  intitule: string;
}

export interface TypeFactureRecord {
  id: string;
  code: string;
  intitule: string;
  facturePedagogique: boolean;
}

export interface ModeleFraisRecord {
  id: string;
  code: string;
  intitule: string;
}

export interface ArticleServiceRecord {
  id: string;
  code: string;
  intitule: string;
  prixUnitaire: number;
}

export interface BanqueRecord {
  id: string;
  code: string;
  intitule: string;
  numeroCompte: string;
}

export interface ActiviteServiceRecord {
  id: string;
  code: string;
  intitule: string;
  montant: number;
}

export interface ReductionAutoriseeRecord {
  id: string;
  personnelId: string;
  tauxMax: number;
  montantPlafond: number;
  dateDebut: string;
  dateFin: string;
}

const SEED_TYPES_FRAIS: TypeFraisRecord[] = [
  { id: "tf-seed-1", code: "APE", intitule: "Association des Parents d'Etudiants (APE)" },
  { id: "tf-seed-2", code: "AVU", intitule: "Avance uniforme" },
  { id: "tf-seed-3", code: "BDE", intitule: "Bureau des étudiants (BDE)" },
  { id: "tf-seed-4", code: "FG", intitule: "Frais généraux" },
  { id: "tf-seed-5", code: "REP", intitule: "Reprise ancien système" },
];

const SEED_MODES_PAIEMENT: ModePaiementFinanceRecord[] = [
  { id: "mp-seed-1", code: "AVR", intitule: "AVOIR" },
  { id: "mp-seed-2", code: "CHQ", intitule: "Chèque" },
  { id: "mp-seed-3", code: "ESP", intitule: "Espèce" },
  { id: "mp-seed-4", code: "VIR", intitule: "Virement" },
  { id: "mp-seed-5", code: "WAVE", intitule: "Wave" },
  { id: "mp-seed-6", code: "OM", intitule: "Orange Money" },
];

const SEED_TYPES_FACTURE: TypeFactureRecord[] = [];

const SEED_MODELES_FRAIS: ModeleFraisRecord[] = [
  { id: "mf-seed-1", code: "AN", intitule: "Ancien" },
  { id: "mf-seed-2", code: "ep", intitule: "Privé" },
  { id: "mf-seed-3", code: "etat", intitule: "Etat" },
  { id: "mf-seed-4", code: "NV", intitule: "Nouveau" },
];

const SEED_ARTICLES_SERVICE: ArticleServiceRecord[] = [];
const SEED_BANQUES: BanqueRecord[] = [];
const SEED_ACTIVITES_SERVICE: ActiviteServiceRecord[] = [];
const SEED_REDUCTIONS_AUTORISEES: ReductionAutoriseeRecord[] = [];

export const typeFraisStore = createListStore<TypeFraisRecord>("edumanage-fin-type-frais-v1", SEED_TYPES_FRAIS);
export const modePaiementFinanceStore = createListStore<ModePaiementFinanceRecord>(
  "edumanage-fin-mode-paiement-v1",
  SEED_MODES_PAIEMENT,
);
export const typeFactureStore = createListStore<TypeFactureRecord>("edumanage-fin-type-facture-v1", SEED_TYPES_FACTURE);
export const modeleFraisStore = createListStore<ModeleFraisRecord>("edumanage-fin-modele-frais-v1", SEED_MODELES_FRAIS);
export const articleServiceStore = createListStore<ArticleServiceRecord>(
  "edumanage-fin-article-service-v1",
  SEED_ARTICLES_SERVICE,
);
export const banqueStore = createListStore<BanqueRecord>("edumanage-fin-banque-v1", SEED_BANQUES);
export const activiteServiceStore = createListStore<ActiviteServiceRecord>(
  "edumanage-fin-activite-service-v1",
  SEED_ACTIVITES_SERVICE,
);
export const reductionAutoriseeStore = createListStore<ReductionAutoriseeRecord>(
  "edumanage-fin-reduction-autorisee-v1",
  SEED_REDUCTIONS_AUTORISEES,
);

export function importArticlesService(rows: Omit<ArticleServiceRecord, "id">[]): number {
  for (const row of rows) {
    articleServiceStore.add(row);
  }
  return rows.length;
}

export function importActivitesService(rows: Omit<ActiviteServiceRecord, "id">[]): number {
  for (const row of rows) {
    activiteServiceStore.add(row);
  }
  return rows.length;
}
