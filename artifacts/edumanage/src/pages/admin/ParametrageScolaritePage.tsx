import { useState } from "react";
import * as XLSX from "xlsx";
import { Settings2, Pencil, RotateCcw, Download, AlertTriangle, Calculator } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useAuth } from "@/contexts/AuthContext";
import { useScolariteConfigs, useValeursParDefautScolarite } from "@/hooks/useScolariteConfigStore";
import {
  updateScolariteConfig,
  updateValeursParDefaut,
  appliquerValeursParDefaut,
  updateReglesCalcul,
  REGLES_CALCUL_DEFAUT,
  type ReglesCalcul,
  type ScolariteConfigRecord,
  type ScolariteConfigPatch,
} from "@/data/scolariteConfigStore";
import { cn, formatDate } from "@/lib/utils";

const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const EMPTY_FORM: ScolariteConfigPatch = { noteBareme: 20, cumulCredit: true, moyennePassage: 10, moyenneEliminatoire: 0 };

export default function ParametrageScolaritePage() {
  const { currentUser } = useAuth();
  const configs = useScolariteConfigs();
  const valeursParDefaut = useValeursParDefautScolarite();

  const [editing, setEditing] = useState<ScolariteConfigRecord | null>(null);
  const [form, setForm] = useState<ScolariteConfigPatch>(EMPTY_FORM);
  const [defautModalOpen, setDefautModalOpen] = useState(false);
  const [defautForm, setDefautForm] = useState<ScolariteConfigPatch>(EMPTY_FORM);

  const [reglesPour, setReglesPour] = useState<ScolariteConfigRecord | null>(null);
  const [regles, setRegles] = useState<ReglesCalcul>(REGLES_CALCUL_DEFAUT);
  const [erreurRegles, setErreurRegles] = useState("");

  const auteur = () => currentUser?.name ?? "Administration";

  const ouvrirRegles = (r: ScolariteConfigRecord) => {
    setReglesPour(r);
    setRegles({ ...REGLES_CALCUL_DEFAUT, ...(r.reglesCalcul ?? {}) });
    setErreurRegles("");
  };

  const enregistrerRegles = () => {
    if (!reglesPour) return;
    const res = updateReglesCalcul(reglesPour.id, regles, auteur());
    if (!res.ok) { setErreurRegles(res.reason ?? "Règles invalides."); return; }
    toast.success(`Règles de calcul enregistrées — ${reglesPour.filiere}`);
    setReglesPour(null);
  };

  const openEdit = (r: ScolariteConfigRecord) => {
    setEditing(r);
    setForm({ noteBareme: r.noteBareme, cumulCredit: r.cumulCredit, moyennePassage: r.moyennePassage, moyenneEliminatoire: r.moyenneEliminatoire });
  };

  const handleSave = () => {
    if (!editing) return;
    updateScolariteConfig(editing.id, form, auteur());
    toast.success(`Paramètres mis à jour — ${editing.filiere}`);
    setEditing(null);
  };

  const handleReinitialiser = () => {
    if (!editing) return;
    appliquerValeursParDefaut(editing.id, auteur());
    setForm({ ...valeursParDefaut });
    toast.success("Réinitialisé aux valeurs par défaut");
  };

  const openDefautModal = () => {
    setDefautForm({ ...valeursParDefaut });
    setDefautModalOpen(true);
  };

  const handleSaveDefaut = () => {
    updateValeursParDefaut(defautForm, auteur());
    toast.success("Valeurs par défaut mises à jour");
    setDefautModalOpen(false);
  };

  const exportExcel = () => {
    const rows = configs.map((c) => ({
      Programme: c.filiere,
      "Note B.": c.noteBareme,
      "Cumul crédit ?": c.cumulCredit ? "Oui" : "Non",
      "Moy. passage": c.moyennePassage,
      "Moy. éliminatoire": c.moyenneEliminatoire,
      "Modifié par": c.modifiePar ?? "",
      "Modifié le": c.modifieLe ? formatDate(c.modifieLe) : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paramétrage scolarité");
    XLSX.writeFile(wb, `parametrage-scolarite-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const eliminatoireChangeeVersHaut = !!editing && form.moyenneEliminatoire > 0 && form.moyenneEliminatoire !== editing.moyenneEliminatoire;

  const columns: Column<Record<string, unknown>>[] = [
    { key: "filiere", header: "Programme", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.filiere as string}</span> },
    { key: "noteBareme", header: "Note B.", sortable: true, render: (r) => <span>{r.noteBareme as number}</span> },
    {
      key: "cumulCredit",
      header: "Cumul crédit ?",
      render: (r) => (
        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", r.cumulCredit ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300")}>
          {r.cumulCredit ? "Oui" : "Non"}
        </span>
      ),
    },
    { key: "moyennePassage", header: "Moy. passage", sortable: true, render: (r) => <span>{r.moyennePassage as number}</span> },
    {
      key: "moyenneEliminatoire",
      header: "Moy. éliminatoire",
      sortable: true,
      render: (r) => {
        const v = r.moyenneEliminatoire as number;
        return v > 0 ? <span className="text-amber-700 dark:text-amber-300 font-medium">{v}</span> : <span className="text-muted-foreground">{v}</span>;
      },
    },
    {
      key: "regles",
      header: "Règles de calcul",
      render: (row) => {
        const r = row as unknown as ScolariteConfigRecord;
        const perso = r.reglesCalcul && Object.entries(r.reglesCalcul).some(([k, v]) => REGLES_CALCUL_DEFAUT[k as keyof ReglesCalcul] !== v);
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", perso ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{perso ? "Personnalisées" : "Par défaut"}</span>;
      },
    },
    {
      key: "modifie",
      header: "Dernière modification",
      render: (row) => {
        const r = row as unknown as ScolariteConfigRecord;
        return r.modifiePar ? (
          <div className="text-xs text-muted-foreground">
            <div>{r.modifiePar}</div>
            <div>{formatDate(r.modifieLe!)}</div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (row) => {
        const r = row as unknown as ScolariteConfigRecord;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(r); }}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              aria-label="Modifier"
              data-testid={`scolarite-config-editer-${r.id}`}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); ouvrirRegles(r); }}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              aria-label="Règles de calcul"
              title="Règles de calcul"
              data-testid={`scolarite-config-regles-${r.id}`}
            >
              <Calculator size={14} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Paramétrage scolarité" }]}
        title="Paramétrage scolarité"
        subtitle="Barème, crédits, moyennes de passage et règles de calcul (validation, rattrapage, compensation, absences) par programme"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="scolarite-config-export-excel"
            >
              <Download size={14} /> Export excel
            </button>
            <button
              onClick={openDefautModal}
              className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors"
              data-testid="scolarite-config-valeurs-defaut"
            >
              <Settings2 size={14} /> Valeurs par défaut
            </button>
          </div>
        }
      />

      <h3 className="text-sm font-semibold text-foreground mb-3">Paramétrage indice cumul crédit, moyenne passage, ....</h3>

      <DataTable
        columns={columns}
        data={configs as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher un programme..."
        emptyMessage="Aucun programme"
      />

      <FormModal
        open={!!reglesPour}
        onClose={() => setReglesPour(null)}
        title={reglesPour ? `Règles de calcul — ${reglesPour.filiere}` : ""}
        subtitle="Selon le règlement des études de l'établissement. Les valeurs proposées au départ reproduisent le fonctionnement actuel."
      >
        <div className="space-y-5 text-sm">
          <fieldset className="space-y-3">
            <legend className="font-semibold text-foreground mb-1">Validation</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <ChampNombre id="regle-seuil-ec" label="Moyenne pour valider un EC" aide="L'EC et ses crédits sont acquis à partir de cette moyenne." valeur={regles.seuilValidationEc} pas={0.25} onChange={(v) => setRegles((r) => ({ ...r, seuilValidationEc: v }))} />
              <ChampNombre id="regle-seuil-ue" label="Moyenne pour valider une UE" aide="Les EC d'une même UE se compensent entre eux." valeur={regles.seuilValidationUe} pas={0.25} onChange={(v) => setRegles((r) => ({ ...r, seuilValidationUe: v }))} />
              <ChampNombre id="regle-plancher" label="Note plancher d'un EC (0 = aucune)" aide="En dessous, l'UE n'est pas validée même si sa moyenne l'est." valeur={regles.noteEliminatoireEc} pas={0.25} onChange={(v) => setRegles((r) => ({ ...r, noteEliminatoireEc: v }))} />
              <label className="flex items-start gap-2 cursor-pointer self-end pb-1">
                <input type="checkbox" checked={regles.creditsParCompensation} onChange={(e) => setRegles((r) => ({ ...r, creditsParCompensation: e.target.checked }))} className="rounded mt-0.5" data-testid="regle-compensation" />
                <span>
                  <span className="font-medium text-foreground">Compensation entre UE</span>
                  <span className="block text-xs text-muted-foreground">Semestre à la moyenne de passage, sans note sous le plancher : tous les crédits sont acquis.</span>
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="font-semibold text-foreground mb-1">Notes et rattrapage</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <ChampNombre id="regle-poids-cc" label="Poids du contrôle continu par défaut (%)" aide={`L'examen compte pour ${Math.max(0, 100 - regles.poidsDevoirDefaut)} %. Utilisé quand l'évaluation n'a pas de poids.`} valeur={regles.poidsDevoirDefaut} pas={5} onChange={(v) => setRegles((r) => ({ ...r, poidsDevoirDefaut: v }))} />
              <div>
                <label htmlFor="regle-rattrapage" className="block text-xs font-medium text-muted-foreground mb-1.5">Note de rattrapage</label>
                <select id="regle-rattrapage" value={regles.regleRattrapage} onChange={(e) => setRegles((r) => ({ ...r, regleRattrapage: e.target.value as ReglesCalcul["regleRattrapage"] }))} className={inputClass} data-testid="regle-rattrapage">
                  <option value="remplace">Remplace la note d&apos;examen</option>
                  <option value="meilleure">Meilleure des deux notes</option>
                  <option value="plafonnee">Remplace l&apos;examen, plafonnée</option>
                </select>
              </div>
              {regles.regleRattrapage === "plafonnee" && (
                <ChampNombre id="regle-plafond" label="Plafond de la note de rattrapage" aide="Par exemple 10 : un 14 au rattrapage est retenu à 10." valeur={regles.plafondRattrapage} pas={0.5} onChange={(v) => setRegles((r) => ({ ...r, plafondRattrapage: v }))} />
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="font-semibold text-foreground mb-1">Délibération</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <ChampNombre id="regle-marge" label="Marge ouvrant le rattrapage (points)" aide="Avec 10 de moyenne de passage et 2 points : rattrapage de 8 à 9,99." valeur={regles.margeRattrapage} pas={0.5} onChange={(v) => setRegles((r) => ({ ...r, margeRattrapage: v }))} />
              <ChampNombre id="regle-absences" label="Heures d'absence avant exclusion (0 = jamais)" aide="Absences non justifiées du semestre." valeur={regles.heuresAbsenceExclusion} pas={1} onChange={(v) => setRegles((r) => ({ ...r, heuresAbsenceExclusion: v }))} />
            </div>
          </fieldset>

          {erreurRegles && (
            <p className="flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2" role="alert"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {erreurRegles}</p>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" onClick={() => setRegles(REGLES_CALCUL_DEFAUT)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs hover:bg-muted"><RotateCcw size={13} /> Revenir aux valeurs d&apos;origine</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setReglesPour(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
              <button type="button" onClick={enregistrerRegles} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90" data-testid="regles-enregistrer">Enregistrer</button>
            </div>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Modifier — ${editing.filiere}` : ""}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note de base (barème)</label>
            <input
              type="number" min={0} value={form.noteBareme}
              onChange={(e) => setForm((f) => ({ ...f, noteBareme: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-config-bareme"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox" checked={form.cumulCredit}
              onChange={(e) => setForm((f) => ({ ...f, cumulCredit: e.target.checked }))}
              className="rounded" data-testid="scolarite-config-cumul-credit"
            />
            Cumul des crédits entre semestres
          </label>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne de passage</label>
            <input
              type="number" min={0} step={0.5} value={form.moyennePassage}
              onChange={(e) => setForm((f) => ({ ...f, moyennePassage: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-config-moyenne-passage"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne éliminatoire</label>
            <input
              type="number" min={0} step={0.5} value={form.moyenneEliminatoire}
              onChange={(e) => setForm((f) => ({ ...f, moyenneEliminatoire: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-config-moyenne-eliminatoire"
            />
            <p className="text-[11px] text-muted-foreground mt-1">0 = désactivée. Au-dessus de 0, tout étudiant sous ce seuil est automatiquement exclu en délibération.</p>
          </div>

          {eliminatoireChangeeVersHaut && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs" data-testid="scolarite-config-avertissement-eliminatoire">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              Vous modifiez la moyenne éliminatoire de {editing?.moyenneEliminatoire} à {form.moyenneEliminatoire} — cela peut changer immédiatement les décisions d&apos;exclusion à la prochaine délibération pour {editing?.filiere}.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="flex-1 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="scolarite-config-sauvegarder">
              Enregistrer
            </button>
            <button onClick={handleReinitialiser} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors" data-testid="scolarite-config-reinitialiser">
              <RotateCcw size={14} /> Défaut
            </button>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={defautModalOpen}
        onClose={() => setDefautModalOpen(false)}
        title="Valeurs par défaut"
        subtitle={
          valeursParDefaut.modifiePar
            ? `Utilisées pour réinitialiser un programme — n'affectent pas les programmes déjà configurés · Dernière modification : ${valeursParDefaut.modifiePar}, ${formatDate(valeursParDefaut.modifieLe!)}`
            : "Utilisées pour réinitialiser un programme — n'affectent pas les programmes déjà configurés"
        }
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Note de base (barème)</label>
            <input
              type="number" min={0} value={defautForm.noteBareme}
              onChange={(e) => setDefautForm((f) => ({ ...f, noteBareme: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-defaut-bareme"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox" checked={defautForm.cumulCredit}
              onChange={(e) => setDefautForm((f) => ({ ...f, cumulCredit: e.target.checked }))}
              className="rounded" data-testid="scolarite-defaut-cumul-credit"
            />
            Cumul des crédits entre semestres
          </label>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne de passage</label>
            <input
              type="number" min={0} step={0.5} value={defautForm.moyennePassage}
              onChange={(e) => setDefautForm((f) => ({ ...f, moyennePassage: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-defaut-moyenne-passage"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyenne éliminatoire</label>
            <input
              type="number" min={0} step={0.5} value={defautForm.moyenneEliminatoire}
              onChange={(e) => setDefautForm((f) => ({ ...f, moyenneEliminatoire: Number(e.target.value) }))}
              className={inputClass} data-testid="scolarite-defaut-moyenne-eliminatoire"
            />
          </div>
          <button onClick={handleSaveDefaut} className="w-full px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="scolarite-defaut-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}

function ChampNombre({ id, label, aide, valeur, pas, onChange }: { id: string; label: string; aide: string; valeur: number; pas: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <input id={id} type="number" min={0} step={pas} value={valeur} onChange={(e) => onChange(Number(e.target.value))} className={inputClass} data-testid={id} />
      <p className="text-[11px] text-muted-foreground mt-1">{aide}</p>
    </div>
  );
}
