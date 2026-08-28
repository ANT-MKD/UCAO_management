import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, X, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { updateEvaluation, type EvaluationRecord } from "@/data/evaluationStore";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

type PoidsRow = { id: string; type: "" | EvaluationRecord["type"]; poids: number | "" };

const TYPE_LABEL: Record<EvaluationRecord["type"], string> = { devoir: "Devoir", examen: "Examen" };

function nouvelleLigne(): PoidsRow {
  return { id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: "", poids: "" };
}

export default function PoidsEvaluationMassePage() {
  const [, setLocation] = useLocation();
  const classes = useClasses();
  const evaluations = useEvaluations();

  const [anneeRef, setAnneeRef] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [professeurId, setProfesseurId] = useState("");
  const [rows, setRows] = useState<PoidsRow[]>([nouvelleLigne()]);

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const classesDisponibles = classes.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === anneeRef && !c.cloturee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);

  // Périmètre exact (année/filière/niveau/classe/session) : sert à la fois à peupler le
  // select Professeur (uniquement ceux ayant réellement une évaluation ici) et à calculer
  // en direct combien d'évaluations chaque ligne de type/poids va toucher.
  const evaluationsPerimetre = evaluations.filter(
    (e) =>
      e.annee === anneeRef &&
      e.filiereId === filiereId &&
      e.niveauId === niveauId &&
      e.classeId === classeId &&
      e.semestreId === semestreId,
  );
  const professeurOptions = Array.from(
    new Map(
      evaluationsPerimetre.filter((e) => e.professeurId).map((e) => [e.professeurId!, { id: e.professeurId!, label: e.professeur }]),
    ).values(),
  );

  const handleAnneeChange = (value: string) => {
    setAnneeRef(value);
    setFiliereId(""); setNiveauId(""); setClasseId(""); setSemestreId(""); setProfesseurId("");
    setRows([nouvelleLigne()]);
  };
  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setNiveauId(""); setClasseId(""); setSemestreId(""); setProfesseurId("");
    setRows([nouvelleLigne()]);
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId(""); setProfesseurId("");
    setRows([nouvelleLigne()]);
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId(""); setProfesseurId("");
    setRows([nouvelleLigne()]);
  };
  const handleSemestreChange = (value: string) => {
    setSemestreId(value);
    setProfesseurId("");
    setRows([nouvelleLigne()]);
  };
  const handleProfesseurChange = (value: string) => {
    setProfesseurId(value);
    setRows([nouvelleLigne()]);
  };

  const usedTypes = rows.map((r) => r.type).filter(Boolean) as EvaluationRecord["type"][];
  const canAddRow = rows.length < 2 && usedTypes.length < 2;

  const addRow = () => setRows((prev) => [...prev, nouvelleLigne()]);
  const removeRow = (id: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : [nouvelleLigne()]));
  const updateRowType = (id: string, type: "" | EvaluationRecord["type"]) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, type } : r)));
  const updateRowPoids = (id: string, poids: number | "") =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, poids } : r)));

  const countFor = (type: EvaluationRecord["type"]) =>
    evaluationsPerimetre.filter((e) => e.professeurId === professeurId && e.type === type).length;

  const peutSauvegarder =
    !!professeurId && rows.some((r) => r.type && r.poids !== "" && Number(r.poids) > 0 && countFor(r.type) > 0);

  const handleSave = () => {
    let total = 0;
    for (const row of rows) {
      if (!row.type || row.poids === "" || Number(row.poids) <= 0) continue;
      const matches = evaluationsPerimetre.filter((e) => e.professeurId === professeurId && e.type === row.type);
      for (const m of matches) {
        updateEvaluation(m.id, { semestreId: m.semestreId, semestre: m.semestre, ecId: m.ecId, type: m.type, poids: Number(row.poids) });
        total += 1;
      }
    }
    if (total === 0) {
      toast.error("Aucune évaluation à mettre à jour pour ces critères.");
      return;
    }
    toast.success(`${total} évaluation(s) mise(s) à jour`);
    handleAnneeChange("");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Mise à jour poids évaluation en masse" }]}
        title="Mise à jour poids évaluation en masse"
        subtitle="Appliquer un même poids à toutes les évaluations d'un professeur, pour une classe et une session"
        actions={
          <button onClick={() => setLocation("/admin/evaluation/poids")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-4 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année référence *</label>
          <select value={anneeRef} onChange={(e) => handleAnneeChange(e.target.value)} className={inputClass} data-testid="poids-masse-annee">
            <option value="">Sélectionner</option>
            {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
          <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} disabled={!anneeRef} className={cn(inputClass, "disabled:opacity-50")} data-testid="poids-masse-filiere">
            <option value="">Sélectionner</option>
            {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="poids-masse-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
            <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="poids-masse-classe">
              <option value="">Sélectionner</option>
              {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.inscrits} étudiants)</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
          <select value={semestreId} onChange={(e) => handleSemestreChange(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="poids-masse-session">
            <option value="">Sélectionner</option>
            {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Professeur *</label>
          <select value={professeurId} onChange={(e) => handleProfesseurChange(e.target.value)} disabled={!semestreId} className={cn(inputClass, "disabled:opacity-50")} data-testid="poids-masse-professeur">
            <option value="">Sélectionner</option>
            {professeurOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {semestreId && professeurOptions.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1"><Info size={11} /> Aucune évaluation planifiée pour cette classe et cette session.</p>
          )}
        </div>
      </div>

      {professeurId && (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
            <h3 className="font-bold text-foreground text-sm">Types des évaluations</h3>
            <button
              onClick={addRow}
              disabled={!canAddRow}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="poids-masse-ajouter-ligne"
            >
              <Plus size={14} /> Nouvelle évaluation
            </button>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type évaluation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Poids</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Concernées</th>
                <th className="w-12 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0" data-testid={`poids-masse-ligne-${row.id}`}>
                  <td className="px-4 py-3">
                    <select
                      value={row.type}
                      onChange={(e) => updateRowType(row.id, e.target.value as "" | EvaluationRecord["type"])}
                      className={inputClass}
                      data-testid={`poids-masse-type-${row.id}`}
                    >
                      <option value="">Sélectionner</option>
                      {(["devoir", "examen"] as const)
                        .filter((t) => t === row.type || !usedTypes.includes(t))
                        .map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={row.poids}
                      onChange={(e) => updateRowPoids(row.id, e.target.value === "" ? "" : Number(e.target.value))}
                      className={cn(inputClass, "w-28")}
                      data-testid={`poids-masse-poids-${row.id}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.type ? (
                      countFor(row.type) > 0
                        ? `${countFor(row.type)} évaluation(s)`
                        : <span className="text-amber-600">aucune évaluation</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeRow(row.id)} className="w-7 h-7 rounded-full bg-red-50 text-red-600 dark:bg-red-950 flex items-center justify-center hover:bg-red-100 transition-colors" data-testid={`poids-masse-supprimer-ligne-${row.id}`}>
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex gap-3 px-5 py-4 border-t border-border">
            <button
              onClick={handleSave}
              disabled={!peutSauvegarder}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="poids-masse-sauvegarder"
            >
              <Save size={14} /> Sauvegarder
            </button>
            <button onClick={() => setLocation("/admin/evaluation/poids")} className="px-5 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
