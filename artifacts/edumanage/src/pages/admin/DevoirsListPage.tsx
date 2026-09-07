import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Eye, Search, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useNotes } from "@/hooks/useStudentStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import type { EvaluationRecord } from "@/data/evaluationStore";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function noteTypeFor(type: EvaluationRecord["type"]): "CC" | "EF" {
  return type === "devoir" ? "CC" : "EF";
}

export default function DevoirsListPage() {
  const [, setLocation] = useLocation();
  const classes = useClasses();
  const ecs = useEcs();
  const ues = useUes();
  const notes = useNotes();
  const evaluations = useEvaluations();

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [ecId, setEcId] = useState("");
  const [type, setType] = useState<"" | EvaluationRecord["type"]>("");
  const [searched, setSearched] = useState(false);

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const semestre = SEMESTRES.find((s) => s.id === semestreId);

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const classesDisponibles = classes.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);
  const coursDisponibles = ecs.filter((ec) => {
    const ue = ues.find((u) => u.id === ec.ueId);
    return !!ue && ue.filiereId === filiereId && ue.niveau === niveau?.alias && ue.semestre === semestre?.alias;
  });

  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId(""); setType(""); setSearched(false);
  };
  const handleAnneeChange = (value: string) => {
    setAnnee(value);
    setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId(""); setType(""); setSearched(false);
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId(""); setEcId(""); setType(""); setSearched(false);
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId(""); setEcId(""); setType(""); setSearched(false);
  };
  const handleSemestreChange = (value: string) => {
    setSemestreId(value);
    setEcId(""); setType(""); setSearched(false);
  };

  const peutRechercher = !!annee && !!niveauId && !!classeId && !!semestreId;

  const resultats = searched
    ? evaluations.filter((ev) => {
        if (ev.classeId !== classeId || ev.semestreId !== semestreId) return false;
        if (ecId && ev.ecId !== ecId) return false;
        if (type && ev.type !== type) return false;
        return true;
      })
    : [];

  const statsFor = (ev: EvaluationRecord) => {
    const noteType = noteTypeFor(ev.type);
    const matched = notes.filter((n) => n.classeId === ev.classeId && n.ecId === ev.ecId && n.type === noteType && n.session === ev.session);
    if (matched.length === 0) return null;
    const values = matched.map((n) => n.note);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      moyenne: values.reduce((a, b) => a + b, 0) / values.length,
    };
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Devoir" }]}
        title="Les devoirs"
        subtitle="Rechercher les évaluations (devoirs et examens) déjà planifiées et consulter leurs notes"
        actions={
          <button onClick={() => setLocation("/admin/evaluation/nouvelle")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-4 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
          <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="devoir-filiere">
            <option value="">Sélectionner</option>
            {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année *</label>
            <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="devoir-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="devoir-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
            <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="devoir-classe">
              <option value="">Sélectionner</option>
              {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.inscrits} étudiants)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
            <select value={semestreId} onChange={(e) => handleSemestreChange(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="devoir-semestre">
              <option value="">Sélectionner</option>
              {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cours</label>
            <select value={ecId} onChange={(e) => { setEcId(e.target.value); setSearched(false); }} disabled={!semestreId} className={cn(inputClass, "disabled:opacity-50")} data-testid="devoir-cours">
              <option value="">Tous</option>
              {coursDisponibles.map((ec) => <option key={ec.id} value={ec.id}>{ec.code} — {ec.libelle}</option>)}
            </select>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type évaluation</label>
              <select value={type} onChange={(e) => { setType(e.target.value as "" | EvaluationRecord["type"]); setSearched(false); }} disabled={!semestreId} className={cn(inputClass, "disabled:opacity-50")} data-testid="devoir-type">
                <option value="">Tous</option>
                <option value="devoir">Devoir</option>
                <option value="examen">Examen</option>
              </select>
            </div>
            <button
              onClick={() => setSearched(true)}
              disabled={!peutRechercher}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              data-testid="devoir-rechercher"
            >
              <Search size={14} /> Rechercher
            </button>
          </div>
        </div>
      </div>

      {searched && (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          {resultats.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <ClipboardList size={18} />
              Aucune évaluation trouvée pour ces critères.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Cours</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Évaluation</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Session</th>
                  <th className="w-12 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {resultats.map((ev) => {
                  const stats = statsFor(ev);
                  return (
                    <tr key={ev.id} className="border-b border-border last:border-0" data-testid={`devoir-row-${ev.id}`}>
                      <td className="px-4 py-3 text-foreground">{ev.cours}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">
                          {ev.type === "devoir" ? "Devoir" : "Examen"}{ev.session === "rattrapage" ? " (Rattrapage)" : ""}{" "}
                          <button onClick={() => setLocation(`/admin/evaluation/devoir/${ev.id}`)} className="text-primary hover:underline font-mono text-xs" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                            {ev.code}
                          </button>
                        </p>
                        <p className="text-xs text-muted-foreground">effectué le {ev.dateCreation}</p>
                        <p className="text-xs text-muted-foreground">
                          {stats ? `Note min : ${stats.min} | Note max : ${stats.max} | Moyenne : ${stats.moyenne.toFixed(1)}` : "Pas de fiche de notes"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{ev.semestre}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setLocation(`/admin/evaluation/devoir/${ev.id}`)}
                          className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                          data-testid={`devoir-voir-${ev.id}`}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
