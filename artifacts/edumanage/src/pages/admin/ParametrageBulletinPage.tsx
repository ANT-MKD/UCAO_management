import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Calculator, ListTree, Scale, Award, Tag, Layers } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { NiveauMethodeCalcul } from "@/lib/bulletinCalculs";

import { useMethodesCalcul, useMethodesCalculParNiveau } from "@/hooks/useBulletinMethodesStore";
import { updateMethodeCalcul, type MethodeCalculRecord, type MethodeCalculPatch } from "@/data/bulletinMethodesStore";

import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import {
  updateMethodesCalculFiliere,
  resolveCodeMethodeCalcul,
  type ScolariteConfigRecord,
  type MethodesCalculPatch,
} from "@/data/scolariteConfigStore";

import { useReglesValidation } from "@/hooks/useReglesValidationStore";
import {
  upsertRegleValidation,
  deleteRegleValidation,
  type RegleValidationRecord,
  type RegleValidationPayload,
  type TypeRegleValidation,
} from "@/data/reglesValidationStore";

import { useMentions } from "@/hooks/useMentionsStore";
import { upsertMention, deleteMention, type MentionRecord, type MentionPayload } from "@/data/mentionsStore";

import { useTypesEvaluation } from "@/hooks/useTypeEvaluationStore";
import { upsertTypeEvaluation, deleteTypeEvaluation, type TypeEvaluationRecord, type TypeEvaluationPayload } from "@/data/typeEvaluationStore";

import { useRegroupementsDevoir } from "@/hooks/useRegroupementDevoirStore";
import {
  upsertRegroupementDevoir,
  deleteRegroupementDevoir,
  type RegroupementDevoirRecord,
  type RegroupementDevoirPayload,
  type RoleRegroupement,
} from "@/data/regroupementDevoirStore";

import { FILIERES } from "@/data/mockData";

const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const NIVEAU_LABELS: Record<NiveauMethodeCalcul, string> = {
  moyenneUe: "Moy. UE",
  moyenneSession: "Moy. Session",
  moyenneAnnee: "Moy. Année",
  moyenneProgramme: "Moy. Programme",
};

const TYPE_LABELS: Record<TypeRegleValidation, string> = {
  semestre: "Semestre",
  annee: "Année",
  programme: "Programme",
};

const NIVEAUX_ORDRE: NiveauMethodeCalcul[] = ["moyenneUe", "moyenneSession", "moyenneAnnee", "moyenneProgramme"];

const TABS = [
  { id: "methodes", label: "Méthodes de calcul", icon: Calculator },
  { id: "programme", label: "Méthodes de calcul d'un programme", icon: ListTree },
  { id: "validation", label: "Règles de validation", icon: Scale },
  { id: "mentions", label: "Mentions", icon: Award },
  { id: "types-evaluation", label: "Types d'évaluation", icon: Tag },
  { id: "regroupement", label: "Regroupement type de devoir", icon: Layers },
] as const;

const ROLE_LABELS: Record<RoleRegroupement, string> = { devoir: "Devoir (CC)", examen: "Examen (EF)" };

type TabId = (typeof TABS)[number]["id"];

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "emerald" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
  return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap", tones[tone])}>{children}</span>;
}

export default function ParametrageBulletinPage() {
  const { currentUser } = useAuth();
  const auteur = () => currentUser?.name ?? "Administration";
  const [tab, setTab] = useState<TabId>("methodes");

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Bulletins" }, { label: "Paramétrage bulletins" }]}
        title="Paramétrage bulletins"
        subtitle="Méthodes de calcul des moyennes, règles de validation et mentions — réellement appliquées par le moteur de bulletin"
      />

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              tab === t.id ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-muted",
            )}
            data-testid={`param-bulletin-tab-${t.id}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "methodes" && <MethodesCalculTab />}
      {tab === "programme" && <MethodesProgrammeTab auteur={auteur} />}
      {tab === "validation" && <ReglesValidationTab auteur={auteur} />}
      {tab === "mentions" && <MentionsTab />}
      {tab === "types-evaluation" && <TypesEvaluationTab />}
      {tab === "regroupement" && <RegroupementDevoirTab />}
    </div>
  );
}

function MethodesCalculTab() {
  const methodes = useMethodesCalcul();
  const [editing, setEditing] = useState<MethodeCalculRecord | null>(null);
  const [form, setForm] = useState<MethodeCalculPatch>({ intitule: "", description: "", actif: true });

  const openEdit = (m: MethodeCalculRecord) => {
    setEditing(m);
    setForm({ intitule: m.intitule, description: m.description ?? "", actif: m.actif });
  };

  const handleSave = () => {
    if (!editing) return;
    updateMethodeCalcul(editing.id, form);
    toast.success(`Méthode mise à jour — ${form.intitule}`);
    setEditing(null);
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "niveau", header: "Niveau", sortable: true, render: (r) => <Badge>{NIVEAU_LABELS[r.niveau as NiveauMethodeCalcul]}</Badge> },
    { key: "code", header: "Code technique", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code as string}</span> },
    { key: "intitule", header: "Intitulé", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.intitule as string}</span> },
    { key: "description", header: "Description", render: (r) => <span className="text-xs text-muted-foreground">{(r.description as string) || "—"}</span> },
    { key: "actif", header: "Actif", render: (r) => <Badge tone={r.actif ? "emerald" : "red"}>{r.actif ? "Oui" : "Non"}</Badge> },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as MethodeCalculRecord;
        return (
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" aria-label="Modifier" data-testid={`methode-editer-${r.id}`}>
            <Pencil size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Chaque méthode correspond à une formule réellement implémentée (lib/bulletinCalculs.ts) — le code technique n'est jamais modifiable ici,
        seuls l'intitulé, la description et l'activation le sont. Désactiver une méthode l'empêche d'être sélectionnée pour un programme.
      </p>
      <DataTable columns={columns} data={methodes as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher une méthode..." emptyMessage="Aucune méthode" />

      <FormModal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Modifier — ${editing.intitule}` : ""} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé</label>
            <input value={form.intitule} onChange={(e) => setForm((f) => ({ ...f, intitule: e.target.value }))} className={inputClass} data-testid="methode-intitule" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={cn(inputClass, "resize-none")} data-testid="methode-description" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} className="rounded" data-testid="methode-actif" />
            Méthode active (sélectionnable pour un programme)
          </label>
          <button onClick={handleSave} className="w-full px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="methode-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}

function MethodesProgrammeTab({ auteur }: { auteur: () => string }) {
  const configs = useScolariteConfigs();
  const methodesParNiveau = {
    moyenneUe: useMethodesCalculParNiveau("moyenneUe"),
    moyenneSession: useMethodesCalculParNiveau("moyenneSession"),
    moyenneAnnee: useMethodesCalculParNiveau("moyenneAnnee"),
    moyenneProgramme: useMethodesCalculParNiveau("moyenneProgramme"),
  };
  const [editing, setEditing] = useState<ScolariteConfigRecord | null>(null);
  const [form, setForm] = useState<MethodesCalculPatch>({ calculGrade: false });

  const openEdit = (c: ScolariteConfigRecord) => {
    setEditing(c);
    setForm({
      methodeCalculMoyUeId: c.methodeCalculMoyUeId,
      methodeCalculMoySessionId: c.methodeCalculMoySessionId,
      methodeCalculMoyAnneeId: c.methodeCalculMoyAnneeId,
      methodeCalculMoyProgrammeId: c.methodeCalculMoyProgrammeId,
      calculGrade: c.calculGrade ?? false,
    });
  };

  const handleSave = () => {
    if (!editing) return;
    updateMethodesCalculFiliere(editing.id, form, auteur());
    toast.success(`Méthodes de calcul mises à jour — ${editing.filiere}`);
    setEditing(null);
  };

  const labelPourNiveau = (config: ScolariteConfigRecord, niveau: NiveauMethodeCalcul): string => {
    const code = resolveCodeMethodeCalcul(config, niveau);
    return methodesParNiveau[niveau].find((m) => m.code === code)?.intitule ?? code;
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "filiere", header: "Programme", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.filiere as string}</span> },
    ...NIVEAUX_ORDRE.map((niveau): Column<Record<string, unknown>> => ({
      key: niveau,
      header: NIVEAU_LABELS[niveau],
      render: (row) => <span className="text-xs">{labelPourNiveau(row as unknown as ScolariteConfigRecord, niveau)}</span>,
    })),
    { key: "calculGrade", header: "Calcul grade", render: (r) => <Badge tone={r.calculGrade ? "emerald" : "muted"}>{r.calculGrade ? "Oui" : "Non"}</Badge> },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as ScolariteConfigRecord;
        return (
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" aria-label="Modifier" data-testid={`prog-methode-editer-${r.id}`}>
            <Pencil size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Choisit, pour chaque programme, quelle méthode calcule réellement chaque niveau de moyenne — le bulletin (Bulletin étudiants, Moyennes par
        promotion, Délibérations, Relevés) applique immédiatement la méthode sélectionnée. Non configuré = repli sur la pondération par crédits historique.
      </p>
      <DataTable columns={columns} data={configs as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher un programme..." emptyMessage="Aucun programme" />

      <FormModal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Méthodes de calcul — ${editing.filiere}` : ""} size="sm">
        <div className="space-y-4">
          {NIVEAUX_ORDRE.map((niveau) => {
            const field = ({
              moyenneUe: "methodeCalculMoyUeId",
              moyenneSession: "methodeCalculMoySessionId",
              moyenneAnnee: "methodeCalculMoyAnneeId",
              moyenneProgramme: "methodeCalculMoyProgrammeId",
            } as const)[niveau];
            return (
              <div key={niveau}>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Méthode de calcul {NIVEAU_LABELS[niveau]}</label>
                <select
                  value={form[field] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value || undefined }))}
                  className={inputClass}
                  data-testid={`prog-methode-${niveau}`}
                >
                  <option value="">Par défaut (pondération par crédits)</option>
                  {methodesParNiveau[niveau].map((m) => (
                    <option key={m.id} value={m.id} disabled={!m.actif}>{m.intitule}{!m.actif ? " (inactive)" : ""}</option>
                  ))}
                </select>
              </div>
            );
          })}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.calculGrade} onChange={(e) => setForm((f) => ({ ...f, calculGrade: e.target.checked }))} className="rounded" data-testid="prog-calcul-grade" />
            Calculer et afficher un grade lettré (A/B/C...) sur le bulletin
          </label>
          <button onClick={handleSave} className="w-full px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="prog-methode-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}

const EMPTY_REGLE: RegleValidationPayload = {
  filiereId: "", type: "semestre", validationParCredit: false, validationParMoyenne: true, creditPassage: 0, moyennePassage: 10, moyenneEliminatoire: 0,
};

function ReglesValidationTab({ auteur }: { auteur: () => string }) {
  const regles = useReglesValidation();
  const [editing, setEditing] = useState<RegleValidationRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RegleValidationPayload>(EMPTY_REGLE);

  const openNew = () => { setEditing(null); setForm(EMPTY_REGLE); setModalOpen(true); };
  const openEdit = (r: RegleValidationRecord) => {
    setEditing(r);
    setForm({ filiereId: r.filiereId, type: r.type, validationParCredit: r.validationParCredit, validationParMoyenne: r.validationParMoyenne, creditPassage: r.creditPassage, moyennePassage: r.moyennePassage, moyenneEliminatoire: r.moyenneEliminatoire });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.filiereId) { toast.error("Sélectionnez un programme"); return; }
    upsertRegleValidation(form, editing?.id, auteur());
    toast.success("Règle de validation enregistrée");
    setModalOpen(false);
  };

  const handleDelete = (r: RegleValidationRecord) => {
    if (!confirm(`Supprimer la règle de validation ${TYPE_LABELS[r.type]} — ${r.filiere} ?`)) return;
    deleteRegleValidation(r.id);
    toast.success("Règle supprimée");
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "filiere", header: "Programme", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.filiere as string}</span> },
    { key: "type", header: "Type", sortable: true, render: (r) => <Badge>{TYPE_LABELS[r.type as TypeRegleValidation]}</Badge> },
    {
      key: "validationPar",
      header: "Validation par",
      render: (row) => {
        const r = row as unknown as RegleValidationRecord;
        return (
          <div className="flex gap-1.5">
            {r.validationParCredit && <Badge tone="amber">Crédit</Badge>}
            {r.validationParMoyenne && <Badge tone="amber">Moyenne</Badge>}
            {!r.validationParCredit && !r.validationParMoyenne && <span className="text-xs text-muted-foreground">—</span>}
          </div>
        );
      },
    },
    { key: "creditPassage", header: "C.P", render: (r) => <span>{r.creditPassage as number}</span> },
    { key: "moyennePassage", header: "M.P", render: (r) => <span>{r.moyennePassage as number}</span> },
    {
      key: "moyenneEliminatoire",
      header: "Éliminatoire",
      render: (r) => {
        const v = r.moyenneEliminatoire as number;
        return v > 0 ? <span className="text-amber-700 dark:text-amber-300 font-medium">{v}</span> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as RegleValidationRecord;
        return (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" aria-label="Modifier" data-testid={`regle-editer-${r.id}`}>
              <Pencil size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Supprimer" data-testid={`regle-supprimer-${r.id}`}>
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Un ou plusieurs critères activés (crédit et/ou moyenne) déterminent la décision de jury réelle — Délibérations applique le type "Semestre" ;
        les moyennes annuelle et de programme (Bulletin étudiants) appliquent respectivement "Année" et "Programme".
      </p>
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="regle-nouvelle">
          <Plus size={14} /> Nouvelle règle de validation
        </button>
      </div>
      <DataTable columns={columns} data={regles as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher une règle..." emptyMessage="Aucune règle" />

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Modifier — ${editing.filiere} · ${TYPE_LABELS[editing.type]}` : "Nouvelle règle de validation"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme</label>
            <select value={form.filiereId} onChange={(e) => setForm((f) => ({ ...f, filiereId: e.target.value }))} className={inputClass} data-testid="regle-filiere">
              <option value="">Sélectionner</option>
              {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TypeRegleValidation }))} className={inputClass} data-testid="regle-type">
              {(Object.entries(TYPE_LABELS) as [TypeRegleValidation, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.validationParCredit} onChange={(e) => setForm((f) => ({ ...f, validationParCredit: e.target.checked }))} className="rounded" data-testid="regle-validation-credit" />
              Validation par crédit
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.validationParMoyenne} onChange={(e) => setForm((f) => ({ ...f, validationParMoyenne: e.target.checked }))} className="rounded" data-testid="regle-validation-moyenne" />
              Validation par moyenne
            </label>
          </div>
          {form.validationParCredit && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">C.P — Crédits de passage requis</label>
              <input type="number" min={0} value={form.creditPassage} onChange={(e) => setForm((f) => ({ ...f, creditPassage: Number(e.target.value) }))} className={inputClass} data-testid="regle-credit-passage" />
            </div>
          )}
          {form.validationParMoyenne && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">M.P — Moyenne de passage requise</label>
              <input type="number" min={0} step={0.5} value={form.moyennePassage} onChange={(e) => setForm((f) => ({ ...f, moyennePassage: Number(e.target.value) }))} className={inputClass} data-testid="regle-moyenne-passage" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne éliminatoire</label>
            <input type="number" min={0} step={0.5} value={form.moyenneEliminatoire} onChange={(e) => setForm((f) => ({ ...f, moyenneEliminatoire: Number(e.target.value) }))} className={inputClass} data-testid="regle-moyenne-eliminatoire" />
            <p className="text-[11px] text-muted-foreground mt-1">0 = désactivée. Prioritaire sur les autres critères : sous ce seuil, l'étudiant est automatiquement exclu.</p>
          </div>
          <button onClick={handleSave} className="w-full px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="regle-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}

const EMPTY_MENTION: MentionPayload = { niveau: "moyenneSession", valeurMin: 0, valeurMax: 20, mention: "", appreciationSucces: "", appreciationEchec: "", actif: true };

function MentionsTab() {
  const mentions = useMentions();
  const [editing, setEditing] = useState<MentionRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<MentionPayload>(EMPTY_MENTION);

  const openNew = () => { setEditing(null); setForm(EMPTY_MENTION); setModalOpen(true); };
  const openEdit = (m: MentionRecord) => {
    setEditing(m);
    setForm({ niveau: m.niveau, valeurMin: m.valeurMin, valeurMax: m.valeurMax, mention: m.mention, appreciationSucces: m.appreciationSucces ?? "", appreciationEchec: m.appreciationEchec ?? "", actif: m.actif });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.mention.trim()) { toast.error("Indiquez un libellé de mention"); return; }
    upsertMention(form, editing?.id);
    toast.success(`Mention enregistrée — ${form.mention}`);
    setModalOpen(false);
  };

  const handleDelete = (m: MentionRecord) => {
    if (!confirm(`Supprimer la mention "${m.mention}" ?`)) return;
    deleteMention(m.id);
    toast.success("Mention supprimée");
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "niveau", header: "Niveau", sortable: true, render: (r) => <Badge>{NIVEAU_LABELS[r.niveau as NiveauMethodeCalcul]}</Badge> },
    { key: "valeurMin", header: "Valeur min", sortable: true, render: (r) => <span>{r.valeurMin as number}</span> },
    { key: "valeurMax", header: "Valeur max", sortable: true, render: (r) => <span>{r.valeurMax as number}</span> },
    { key: "mention", header: "Mention", render: (r) => <span className="font-medium text-foreground">{r.mention as string}</span> },
    { key: "appreciationSucces", header: "Appréciation succès", render: (r) => <span className="text-xs text-muted-foreground line-clamp-1">{(r.appreciationSucces as string) || "—"}</span> },
    { key: "appreciationEchec", header: "Appréciation échec", render: (r) => <span className="text-xs text-muted-foreground line-clamp-1">{(r.appreciationEchec as string) || "—"}</span> },
    { key: "actif", header: "Actif", render: (r) => <Badge tone={r.actif ? "emerald" : "red"}>{r.actif ? "Oui" : "Non"}</Badge> },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as MentionRecord;
        return (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" aria-label="Modifier" data-testid={`mention-editer-${r.id}`}>
              <Pencil size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Supprimer" data-testid={`mention-supprimer-${r.id}`}>
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Tranches de moyenne imprimées sur Relevés &amp; Bulletins et Moyennes par promotion — l'appréciation affichée dépend du résultat réel
        (admis/ajourné) de l'étudiant sur la tranche où tombe sa moyenne.
      </p>
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="mention-nouvelle">
          <Plus size={14} /> Nouvelle mention
        </button>
      </div>
      <DataTable columns={columns} data={mentions as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher une mention..." emptyMessage="Aucune mention" />

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Modifier — ${editing.mention}` : "Nouvelle mention"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau</label>
            <select value={form.niveau} onChange={(e) => setForm((f) => ({ ...f, niveau: e.target.value as NiveauMethodeCalcul }))} className={inputClass} data-testid="mention-niveau">
              {NIVEAUX_ORDRE.map((n) => <option key={n} value={n}>{NIVEAU_LABELS[n]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Valeur min</label>
              <input type="number" min={0} max={20} step={0.5} value={form.valeurMin} onChange={(e) => setForm((f) => ({ ...f, valeurMin: Number(e.target.value) }))} className={inputClass} data-testid="mention-valeur-min" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Valeur max</label>
              <input type="number" min={0} max={20} step={0.5} value={form.valeurMax} onChange={(e) => setForm((f) => ({ ...f, valeurMax: Number(e.target.value) }))} className={inputClass} data-testid="mention-valeur-max" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mention</label>
            <input value={form.mention} onChange={(e) => setForm((f) => ({ ...f, mention: e.target.value }))} placeholder="ex: Très Bien" className={inputClass} data-testid="mention-libelle" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Appréciation par — en cas de succès</label>
            <textarea value={form.appreciationSucces} onChange={(e) => setForm((f) => ({ ...f, appreciationSucces: e.target.value }))} rows={2} className={cn(inputClass, "resize-none")} data-testid="mention-appreciation-succes" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Appréciation par — en cas d'échec</label>
            <textarea value={form.appreciationEchec} onChange={(e) => setForm((f) => ({ ...f, appreciationEchec: e.target.value }))} rows={2} className={cn(inputClass, "resize-none")} data-testid="mention-appreciation-echec" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} className="rounded" data-testid="mention-actif" />
            Tranche active
          </label>
          <button onClick={handleSave} className="w-full px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="mention-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}

const EMPTY_TYPE_EVALUATION: TypeEvaluationPayload = { code: "", intitule: "", actif: true };

function TypesEvaluationTab() {
  const typesEvaluation = useTypesEvaluation();
  const [editing, setEditing] = useState<TypeEvaluationRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TypeEvaluationPayload>(EMPTY_TYPE_EVALUATION);

  const openNew = () => { setEditing(null); setForm(EMPTY_TYPE_EVALUATION); setModalOpen(true); };
  const openEdit = (t: TypeEvaluationRecord) => {
    setEditing(t);
    setForm({ code: t.code, intitule: t.intitule, actif: t.actif });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.code.trim() || !form.intitule.trim()) { toast.error("Code et intitulé requis"); return; }
    upsertTypeEvaluation({ ...form, code: form.code.trim().toUpperCase(), intitule: form.intitule.trim() }, editing?.id);
    toast.success(`Type d'évaluation enregistré — ${form.intitule}`);
    setModalOpen(false);
  };

  const handleDelete = (t: TypeEvaluationRecord) => {
    if (!confirm(`Supprimer le type d'évaluation "${t.intitule}" ? Les regroupements qui le référencent le perdront.`)) return;
    deleteTypeEvaluation(t.id);
    toast.success("Type d'évaluation supprimé");
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code as string}</span> },
    { key: "intitule", header: "Intitulé", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.intitule as string}</span> },
    { key: "actif", header: "Actif", render: (r) => <Badge tone={r.actif ? "emerald" : "red"}>{r.actif ? "Oui" : "Non"}</Badge> },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const t = row as unknown as TypeEvaluationRecord;
        return (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); openEdit(t); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" aria-label="Modifier" data-testid={`type-eval-editer-${t.id}`}>
              <Pencil size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(t); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Supprimer" data-testid={`type-eval-supprimer-${t.id}`}>
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Catalogue des types d'évaluation qu'un professeur peut choisir dans Nouvelle évaluation ("Type devoir") — Composition, Contrôle continu,
        Devoir, Examen, Partiel par défaut. Un type n'affecte le calcul que via le Regroupement type de devoir qui le référence.
      </p>
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="type-eval-nouveau">
          <Plus size={14} /> Nouveau type d'évaluation
        </button>
      </div>
      <DataTable columns={columns} data={typesEvaluation as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher un type..." emptyMessage="Aucun type d'évaluation" />

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Modifier — ${editing.intitule}` : "Nouveau type d'évaluation"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code</label>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ex: TP" className={cn(inputClass, "uppercase font-mono")} data-testid="type-eval-code" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé</label>
            <input value={form.intitule} onChange={(e) => setForm((f) => ({ ...f, intitule: e.target.value }))} placeholder="ex: Travaux pratiques" className={inputClass} data-testid="type-eval-intitule" />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} className="rounded" data-testid="type-eval-actif" />
            Type actif (sélectionnable dans Nouvelle évaluation)
          </label>
          <button onClick={handleSave} className="w-full px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="type-eval-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}

const EMPTY_REGROUPEMENT: RegroupementDevoirPayload = { code: "", intitule: "", role: "devoir", typeEvaluationIds: [] };

function RegroupementDevoirTab() {
  const regroupements = useRegroupementsDevoir();
  const typesEvaluation = useTypesEvaluation();
  const [editing, setEditing] = useState<RegroupementDevoirRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<RegroupementDevoirPayload>(EMPTY_REGROUPEMENT);

  const openNew = () => { setEditing(null); setForm(EMPTY_REGROUPEMENT); setModalOpen(true); };
  const openEdit = (r: RegroupementDevoirRecord) => {
    setEditing(r);
    setForm({ code: r.code, intitule: r.intitule, role: r.role, typeEvaluationIds: [...r.typeEvaluationIds] });
    setModalOpen(true);
  };

  const toggleType = (typeId: string) => {
    setForm((f) => ({
      ...f,
      typeEvaluationIds: f.typeEvaluationIds.includes(typeId)
        ? f.typeEvaluationIds.filter((id) => id !== typeId)
        : [...f.typeEvaluationIds, typeId],
    }));
  };

  const handleSave = () => {
    if (!form.code.trim() || !form.intitule.trim()) { toast.error("Code et intitulé requis"); return; }
    if (form.typeEvaluationIds.length === 0) { toast.error("Sélectionnez au moins un type devoir"); return; }
    upsertRegroupementDevoir({ ...form, code: form.code.trim(), intitule: form.intitule.trim() }, editing?.id);
    toast.success(`Regroupement enregistré — ${form.intitule}`);
    setModalOpen(false);
  };

  const handleDelete = (r: RegroupementDevoirRecord) => {
    if (!confirm(`Supprimer le regroupement "${r.intitule}" ? Les évaluations de ses types devoir retomberont sur leur type Devoir/Examen brut.`)) return;
    deleteRegroupementDevoir(r.id);
    toast.success("Regroupement supprimé");
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code as string}</span> },
    { key: "intitule", header: "Intitulé", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.intitule as string}</span> },
    { key: "role", header: "Rôle", render: (r) => <Badge tone={r.role === "devoir" ? "amber" : "muted"}>{ROLE_LABELS[r.role as RoleRegroupement]}</Badge> },
    {
      key: "typeEvaluationIds",
      header: "Types devoir",
      render: (row) => {
        const r = row as unknown as RegroupementDevoirRecord;
        const labels = r.typeEvaluationIds.map((id) => typesEvaluation.find((t) => t.id === id)?.intitule).filter(Boolean);
        return <span className="text-xs text-muted-foreground">{labels.length > 0 ? labels.join(", ") : "—"}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as RegroupementDevoirRecord;
        return (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" aria-label="Modifier" data-testid={`regroupement-editer-${r.id}`}>
              <Pencil size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Supprimer" data-testid={`regroupement-supprimer-${r.id}`}>
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Un regroupement rassemble plusieurs types d'évaluation (ex. Contrôle continu + Devoir + Partiel) sous un même rôle CC ou EF — c'est ce qui
        permet à un EC d'avoir plusieurs devoirs ou plusieurs examens distincts, combinés en une moyenne pondérée par leur poids respectif au lieu
        de s'écraser les uns les autres.
      </p>
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="regroupement-nouveau">
          <Plus size={14} /> Nouveau regroupement type de devoir
        </button>
      </div>
      <DataTable columns={columns} data={regroupements as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher un regroupement..." emptyMessage="Aucun regroupement" />

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Modifier — ${editing.intitule}` : "Nouveau regroupement type de devoir"} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code</label>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={cn(inputClass, "font-mono")} data-testid="regroupement-code" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé</label>
              <input value={form.intitule} onChange={(e) => setForm((f) => ({ ...f, intitule: e.target.value }))} className={inputClass} data-testid="regroupement-intitule" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rôle dans le calcul de l'EC</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RoleRegroupement }))} className={inputClass} data-testid="regroupement-role">
              {(Object.entries(ROLE_LABELS) as [RoleRegroupement, string][]).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Types devoir *</label>
            <div className="border border-border rounded-xl divide-y divide-border max-h-56 overflow-y-auto">
              {typesEvaluation.map((t) => (
                <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={form.typeEvaluationIds.includes(t.id)}
                    onChange={() => toggleType(t.id)}
                    className="rounded"
                    data-testid={`regroupement-type-${t.id}`}
                  />
                  {t.intitule}
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleSave} className="w-full px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="regroupement-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}
