import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Search, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useSeances, useCahiers } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeacherRates } from "@/hooks/useTeacherRateStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { makeTeacherRateId } from "@/data/teacherRateStore";
import { makeTeacherVolumeId, getTeacherVolume } from "@/data/teacherVolumeStore";
import { getPointageIdsDejaDecomptes, genererDecompte, type DecompteLigne } from "@/data/decompteStore";
import { buildTeacherCourses, niveauLabel } from "@/lib/teacherCourseUtils";
import { filterTeachers, teacherDisplayLabel, computeVhPointe, type EnseignantRecord } from "@/lib/teacherUtils";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

interface EligibleLine {
  sourceId: string;
  ecId: string;
  classeId: string;
  coursLabel: string;
  vhTotal: number;
  vhPointe: number;
  dateFin: string;
  niveauLabel: string;
  classeLabel: string;
  anneeLabel: string;
  semestreLabel: string;
  montantBrut: number;
  abattementPct: number;
  abattementMontant: number;
  montantNet: number;
}

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES]
  .sort((a, b) => b.libelle.localeCompare(a.libelle))
  .map((a) => a.libelle);

const DEFAULT_ANNEE =
  ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0] ?? "2025-2026";

const inputClass =
  "w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function DecompteForfaitFormPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const seances = useSeances();
  const cahiers = useCahiers();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const teacherRates = useTeacherRates();
  const teacherVolumes = useTeacherVolumes();
  const pointages = usePointages();
  const decomptes = useDecomptes();
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [anneeScolaire, setAnneeScolaire] = useState(DEFAULT_ANNEE);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const selected = teachers.find((t) => t.id === selectedId) ?? null;
  const suggestions = useMemo(() => filterTeachers(teachers, query).slice(0, 8), [teachers, query]);

  const sourceIdsDejaDecomptes = useMemo(() => getPointageIdsDejaDecomptes(), [decomptes]);

  const eligibleLines: EligibleLine[] = useMemo(() => {
    if (!selected) return [];
    const courseItems = buildTeacherCourses(selected, seances, ecs, ues, classes, anneeScolaire);
    const lines: EligibleLine[] = [];
    for (const course of courseItems) {
      const rateId = makeTeacherRateId(selected.id, course.ecId, course.classeId, anneeScolaire);
      const rate = teacherRates.find((r) => r.id === rateId);
      if (!rate || rate.modePaiement !== "forfait" || rate.montant == null) continue;

      const sourceId = `forfait:${selected.id}:${course.ecId}:${course.classeId}:${anneeScolaire}`;
      if (sourceIdsDejaDecomptes.has(sourceId)) continue;

      const volumeId = makeTeacherVolumeId(selected.id, course.ecId, course.classeId, anneeScolaire);
      const savedVolume = teacherVolumes.find((v) => v.id === volumeId) ?? getTeacherVolume(volumeId);
      const vhTotal = savedVolume?.nouveauVh ?? course.volumeHoraire;
      const vhPointe = computeVhPointe(selected, course.ecId, course.classeId, anneeScolaire, cahiers, seances, pointages);
      if (vhPointe < vhTotal) continue; // cours pas encore entièrement dispensé et pointé

      const coursPointages = pointages.filter(
        (p) =>
          p.teacherId === selected.id &&
          p.ecId === course.ecId &&
          p.classeId === course.classeId &&
          p.annee === anneeScolaire &&
          p.statut === "valide",
      );
      const dateFin = coursPointages.reduce((max, p) => (p.date > max ? p.date : max), "");

      const classe = classes.find((c) => c.id === course.classeId);
      const ec = ecs.find((e) => e.id === course.ecId);
      const ue = ec ? ues.find((u) => u.id === ec.ueId) : undefined;

      const montantBrut = rate.montant ?? 0;
      const abattementMontant = (montantBrut * rate.tauxAbatt) / 100;

      lines.push({
        sourceId,
        ecId: course.ecId,
        classeId: course.classeId,
        coursLabel: course.coursLabel,
        vhTotal,
        vhPointe,
        dateFin: dateFin || new Date().toISOString().slice(0, 10),
        niveauLabel: classe ? niveauLabel(classe.niveau) : "",
        classeLabel: classe?.nom ?? "",
        anneeLabel: anneeScolaire,
        semestreLabel: ue?.semestre ?? "",
        montantBrut,
        abattementPct: rate.tauxAbatt,
        abattementMontant,
        montantNet: montantBrut - abattementMontant,
      });
    }
    return lines.sort((a, b) => a.coursLabel.localeCompare(b.coursLabel, "fr"));
  }, [selected, seances, cahiers, ecs, ues, classes, anneeScolaire, teacherRates, teacherVolumes, pointages, sourceIdsDejaDecomptes]);

  const pickTeacher = (t: EnseignantRecord) => {
    setSelectedId(t.id);
    setQuery(teacherDisplayLabel(t));
    setShowSuggestions(false);
    setChecked(new Set());
  };

  const toggleLine = (sourceId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  };

  const toggleAll = () => {
    if (checked.size === eligibleLines.length) setChecked(new Set());
    else setChecked(new Set(eligibleLines.map((l) => l.sourceId)));
  };

  const selectedLines = eligibleLines.filter((l) => checked.has(l.sourceId));
  const totalBrut = selectedLines.reduce((s, l) => s + l.montantBrut, 0);
  const totalAbattement = selectedLines.reduce((s, l) => s + l.abattementMontant, 0);
  const totalNet = selectedLines.reduce((s, l) => s + l.montantNet, 0);

  const handleGenerer = () => {
    if (!selected || selectedLines.length === 0) return;
    const lignes: DecompteLigne[] = selectedLines.map((l) => ({
      pointageId: l.sourceId,
      ecId: l.ecId,
      classeId: l.classeId,
      coursLabel: l.coursLabel,
      duree: l.vhTotal,
      date: l.dateFin,
      niveauLabel: l.niveauLabel,
      classeLabel: l.classeLabel,
      anneeLabel: l.anneeLabel,
      semestreLabel: l.semestreLabel,
      montantBrut: l.montantBrut,
      abattementPct: l.abattementPct,
      abattementMontant: l.abattementMontant,
      montantNet: l.montantNet,
    }));
    const record = genererDecompte({
      teacherId: selected.id,
      professeur: `${selected.prenom} ${selected.nom}`,
      type: "forfait",
      annee: anneeScolaire,
      date: new Date().toISOString().slice(0, 10),
      ajouteePar: currentUser?.name ?? "Administration",
      lignes,
    });
    toast.success(`Décompte ${record.reference} généré — net à payer : ${formatCFA(record.netAPayer)}`);
    setLocation(`/admin/decomptes/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les décomptes", href: "/admin/decomptes" }, { label: "Forfait" }]}
        title="Nouveau décompte — Forfait"
        subtitle="Génère un décompte pour chaque cours payé au forfait, entièrement dispensé et pointé par le professeur"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-foreground whitespace-nowrap">
            Professeur <span className="text-red-500">*</span>
          </label>
          <div className="relative flex-1 min-w-[280px] max-w-2xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                if (!e.target.value.trim()) setSelectedId("");
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Matricule, prénom, nom ou téléphone du professeur…"
              className={`${inputClass} pl-10`}
              data-testid="decompte-forfait-search"
            />
            {showSuggestions && suggestions.length > 0 && query.trim().length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {suggestions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTeacher(t)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors",
                      t.id === selectedId && "bg-primary/5",
                    )}
                    data-testid={`decompte-forfait-option-${t.id}`}
                  >
                    {teacherDisplayLabel(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="decompte-forfait-annee" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Année scolaire
            </label>
            <select
              id="decompte-forfait-annee"
              value={anneeScolaire}
              onChange={(e) => { setAnneeScolaire(e.target.value); setChecked(new Set()); }}
              className={`${inputClass} min-w-[140px]`}
              data-testid="decompte-forfait-annee"
            >
              {ANNEE_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selected ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-20 text-center text-sm text-muted-foreground">
          Sélectionnez un professeur pour afficher ses cours au forfait entièrement dispensés
        </div>
      ) : eligibleLines.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-20 text-center text-sm text-muted-foreground">
          Aucun cours payé au forfait, entièrement pointé et non encore décompté pour {selected.prenom} {selected.nom} sur {anneeScolaire}
        </div>
      ) : (
        <>
          <div className="bg-muted/60 border border-border rounded-t-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">
              {selected.matricule} — {selected.prenom} {selected.nom}
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-primary hover:underline"
              data-testid="decompte-forfait-tout-cocher"
            >
              {checked.size === eligibleLines.length ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>

          <div className="bg-card border border-border border-t-0 overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 w-10" />
                  <th className="text-left px-3 py-3">Cours</th>
                  <th className="text-left px-3 py-3">Terminé le</th>
                  <th className="text-center px-3 py-3">V.H (pointé / total)</th>
                  <th className="text-right px-3 py-3">Montant forfait</th>
                  <th className="text-center px-3 py-3">Abatt.</th>
                  <th className="text-right px-3 py-3">Montant net</th>
                </tr>
              </thead>
              <tbody>
                {eligibleLines.map((l) => (
                  <tr key={l.sourceId} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked.has(l.sourceId)}
                        onChange={() => toggleLine(l.sourceId)}
                        className="rounded"
                        data-testid={`decompte-forfait-check-${l.sourceId}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{l.coursLabel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.niveauLabel} — {l.classeLabel} — {l.anneeLabel}
                        {l.semestreLabel ? ` — ${l.semestreLabel}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(l.dateFin)}</td>
                    <td className="px-3 py-3 text-center">{l.vhPointe} / {l.vhTotal} h</td>
                    <td className="px-3 py-3 text-right">{formatCFA(l.montantBrut)}</td>
                    <td className="px-3 py-3 text-center text-muted-foreground">
                      {l.abattementPct}% (-{formatCFA(l.abattementMontant)})
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">{formatCFA(l.montantNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-card border border-border border-t-0 rounded-b-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Total brut sélectionné</p>
                <p className="font-semibold">{formatCFA(totalBrut)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Abattement</p>
                <p className="font-semibold text-red-600">-{formatCFA(totalAbattement)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net à payer</p>
                <p className="font-bold text-primary">{formatCFA(totalNet)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGenerer}
              disabled={selectedLines.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
              data-testid="decompte-forfait-generer"
            >
              <FileCheck2 size={15} /> Générer le décompte ({selectedLines.length})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
