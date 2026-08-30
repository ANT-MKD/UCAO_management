import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Search, FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { useSeances, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeacherRates } from "@/hooks/useTeacherRateStore";
import { useTeacherCourseStatuses } from "@/hooks/useTeacherCourseStatusStore";
import { usePointages } from "@/hooks/usePointageStore";
import { useDecomptes } from "@/hooks/useDecompteStore";
import { makeTeacherRateId } from "@/data/teacherRateStore";
import { makeTeacherCourseStatusId } from "@/data/teacherCourseStatusStore";
import { getPointageIdsDejaDecomptes, genererDecompte, type DecompteLigne } from "@/data/decompteStore";
import { buildTeacherCourses, niveauLabel } from "@/lib/teacherCourseUtils";
import { filterTeachers, teacherDisplayLabel, type EnseignantRecord } from "@/lib/teacherUtils";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

interface EligibleLine {
  pointageId: string;
  ecId: string;
  classeId: string;
  coursLabel: string;
  duree: number;
  date: string;
  niveauLabel: string;
  classeLabel: string;
  anneeLabel: string;
  semestreLabel: string;
  montantBrut: number;
  abattementPct: number;
  abattementMontant: number;
  montantNet: number;
}

const inputClass =
  "w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function DecompteTauxHoraireFormPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const teacherRates = useTeacherRates();
  const teacherCourseStatuses = useTeacherCourseStatuses();
  const pointages = usePointages();
  const decomptes = useDecomptes();
  const teachers = ENSEIGNANTS as EnseignantRecord[];
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0] ?? "2025-2026";

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [anneeScolaire, setAnneeScolaire] = useState(defaultAnnee);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const selected = teachers.find((t) => t.id === selectedId) ?? null;
  const suggestions = useMemo(() => filterTeachers(teachers, query).slice(0, 8), [teachers, query]);

  const pointageIdsDejaDecomptes = useMemo(() => getPointageIdsDejaDecomptes(), [decomptes]);

  const eligibleLines: EligibleLine[] = useMemo(() => {
    if (!selected) return [];
    const courseItems = buildTeacherCourses(selected, seances, ecs, ues, classes, anneeScolaire);
    const lines: EligibleLine[] = [];
    for (const course of courseItems) {
      const rateId = makeTeacherRateId(selected.id, course.ecId, course.classeId, anneeScolaire);
      const rate = teacherRates.find((r) => r.id === rateId);
      if (!rate || rate.modePaiement !== "taux_horaire" || rate.montant == null) continue;
      const statusId = makeTeacherCourseStatusId(selected.id, course.ecId, course.classeId, anneeScolaire);
      const status = teacherCourseStatuses.find((s) => s.id === statusId);
      if (status?.typeComptabilisation === "a_terme") continue; // ces cours passent par le décompte "À terme"
      const classe = classes.find((c) => c.id === course.classeId);
      const ec = ecs.find((e) => e.id === course.ecId);
      const ue = ec ? ues.find((u) => u.id === ec.ueId) : undefined;
      const coursPointages = pointages.filter(
        (p) =>
          p.teacherId === selected.id &&
          p.ecId === course.ecId &&
          p.classeId === course.classeId &&
          p.annee === anneeScolaire &&
          p.statut === "valide" &&
          !pointageIdsDejaDecomptes.has(p.id),
      );
      for (const p of coursPointages) {
        const montantBrut = p.volumePointe * (rate.montant ?? 0);
        const abattementMontant = (montantBrut * rate.tauxAbatt) / 100;
        lines.push({
          pointageId: p.id,
          ecId: course.ecId,
          classeId: course.classeId,
          coursLabel: course.coursLabel,
          duree: p.volumePointe,
          date: p.date,
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
    }
    return lines.sort((a, b) => a.date.localeCompare(b.date));
  }, [selected, seances, ecs, ues, classes, anneeScolaire, teacherRates, teacherCourseStatuses, pointages, pointageIdsDejaDecomptes]);

  const pickTeacher = (t: EnseignantRecord) => {
    setSelectedId(t.id);
    setQuery(teacherDisplayLabel(t));
    setShowSuggestions(false);
    setChecked(new Set());
  };

  const toggleLine = (pointageId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(pointageId)) next.delete(pointageId);
      else next.add(pointageId);
      return next;
    });
  };

  const toggleAll = () => {
    if (checked.size === eligibleLines.length) setChecked(new Set());
    else setChecked(new Set(eligibleLines.map((l) => l.pointageId)));
  };

  const selectedLines = eligibleLines.filter((l) => checked.has(l.pointageId));
  const totalBrut = selectedLines.reduce((s, l) => s + l.montantBrut, 0);
  const totalAbattement = selectedLines.reduce((s, l) => s + l.abattementMontant, 0);
  const totalNet = selectedLines.reduce((s, l) => s + l.montantNet, 0);

  const handleGenerer = () => {
    if (!selected || selectedLines.length === 0) return;
    const lignes: DecompteLigne[] = selectedLines.map((l) => ({
      pointageId: l.pointageId,
      ecId: l.ecId,
      classeId: l.classeId,
      coursLabel: l.coursLabel,
      duree: l.duree,
      date: l.date,
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
      type: "taux_horaire",
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
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les décomptes", href: "/admin/decomptes" }, { label: "Taux horaire" }]}
        title="Nouveau décompte — Taux horaire"
        subtitle="Génère un décompte à partir des pointages validés du professeur payés au taux horaire"
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
              data-testid="decompte-taux-search"
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
                    data-testid={`decompte-taux-option-${t.id}`}
                  >
                    {teacherDisplayLabel(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="decompte-annee" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Année scolaire
            </label>
            <select
              id="decompte-annee"
              value={anneeScolaire}
              onChange={(e) => { setAnneeScolaire(e.target.value); setChecked(new Set()); }}
              className={`${inputClass} min-w-[140px]`}
              data-testid="decompte-taux-annee"
            >
              {anneeOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!selected ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-20 text-center text-sm text-muted-foreground">
          Sélectionnez un professeur pour afficher ses pointages validés éligibles au décompte
        </div>
      ) : eligibleLines.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-20 text-center text-sm text-muted-foreground">
          Aucun pointage validé, payé au taux horaire et non encore décompté pour {selected.prenom} {selected.nom} sur {anneeScolaire}
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
              data-testid="decompte-taux-tout-cocher"
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
                  <th className="text-left px-3 py-3">Fait le</th>
                  <th className="text-center px-3 py-3">Durée (h)</th>
                  <th className="text-right px-3 py-3">Montant brut</th>
                  <th className="text-center px-3 py-3">Abatt.</th>
                  <th className="text-right px-3 py-3">Montant net</th>
                </tr>
              </thead>
              <tbody>
                {eligibleLines.map((l) => (
                  <tr key={l.pointageId} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked.has(l.pointageId)}
                        onChange={() => toggleLine(l.pointageId)}
                        className="rounded"
                        data-testid={`decompte-taux-check-${l.pointageId}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{l.coursLabel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.niveauLabel} — {l.classeLabel} — {l.anneeLabel}
                        {l.semestreLabel ? ` — ${l.semestreLabel}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(l.date)}</td>
                    <td className="px-3 py-3 text-center">{l.duree}</td>
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
              data-testid="decompte-taux-generer"
            >
              <FileCheck2 size={15} /> Générer le décompte ({selectedLines.length})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
