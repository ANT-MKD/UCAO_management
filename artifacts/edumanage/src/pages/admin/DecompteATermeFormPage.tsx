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
import { makeTeacherRateId, type ModePaiementProf } from "@/data/teacherRateStore";
import { makeTeacherCourseStatusId } from "@/data/teacherCourseStatusStore";
import { getPointageIdsDejaDecomptes, genererDecompte, type DecompteLigne } from "@/data/decompteStore";
import { buildTeacherCourses, niveauLabel } from "@/lib/teacherCourseUtils";
import { filterTeachers, teacherDisplayLabel, type EnseignantRecord } from "@/lib/teacherUtils";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

interface EligibleLine {
  sourceId: string;
  mode: ModePaiementProf;
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

export default function DecompteATermeFormPage() {
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

  const sourceIdsDejaDecomptes = useMemo(() => getPointageIdsDejaDecomptes(), [decomptes]);

  const eligibleLines: EligibleLine[] = useMemo(() => {
    if (!selected) return [];
    const courseItems = buildTeacherCourses(selected, seances, ecs, ues, classes, anneeScolaire);
    const lines: EligibleLine[] = [];
    for (const course of courseItems) {
      const statusId = makeTeacherCourseStatusId(selected.id, course.ecId, course.classeId, anneeScolaire);
      const status = teacherCourseStatuses.find((s) => s.id === statusId);
      if (status?.typeComptabilisation !== "a_terme") continue; // seuls les cours explicitement marqués "à terme"

      const rateId = makeTeacherRateId(selected.id, course.ecId, course.classeId, anneeScolaire);
      const rate = teacherRates.find((r) => r.id === rateId);
      if (!rate || !rate.modePaiement || rate.montant == null) continue;

      const classe = classes.find((c) => c.id === course.classeId);
      const ec = ecs.find((e) => e.id === course.ecId);
      const ue = ec ? ues.find((u) => u.id === ec.ueId) : undefined;
      const niveauTxt = classe ? niveauLabel(classe.niveau) : "";
      const classeTxt = classe?.nom ?? "";
      const semestreTxt = ue?.semestre ?? "";

      if (rate.modePaiement === "taux_horaire") {
        const coursPointages = pointages.filter(
          (p) =>
            p.teacherId === selected.id &&
            p.ecId === course.ecId &&
            p.classeId === course.classeId &&
            p.annee === anneeScolaire &&
            p.statut === "valide" &&
            !sourceIdsDejaDecomptes.has(p.id),
        );
        for (const p of coursPointages) {
          const montantBrut = p.volumePointe * (rate.montant ?? 0);
          const abattementMontant = (montantBrut * rate.tauxAbatt) / 100;
          lines.push({
            sourceId: p.id,
            mode: "taux_horaire",
            ecId: course.ecId,
            classeId: course.classeId,
            coursLabel: course.coursLabel,
            duree: p.volumePointe,
            date: p.date,
            niveauLabel: niveauTxt,
            classeLabel: classeTxt,
            anneeLabel: anneeScolaire,
            semestreLabel: semestreTxt,
            montantBrut,
            abattementPct: rate.tauxAbatt,
            abattementMontant,
            montantNet: montantBrut - abattementMontant,
          });
        }
      } else if (rate.modePaiement === "forfait") {
        const sourceId = `aterme-forfait:${selected.id}:${course.ecId}:${course.classeId}:${anneeScolaire}`;
        if (sourceIdsDejaDecomptes.has(sourceId)) continue;
        const coursPointages = pointages.filter(
          (p) =>
            p.teacherId === selected.id &&
            p.ecId === course.ecId &&
            p.classeId === course.classeId &&
            p.annee === anneeScolaire &&
            p.statut === "valide",
        );
        if (coursPointages.length === 0) continue; // au moins un pointage validé pour prouver que le cours a débuté
        const dateFin = coursPointages.reduce((max, p) => (p.date > max ? p.date : max), "");
        const montantBrut = rate.montant ?? 0;
        const abattementMontant = (montantBrut * rate.tauxAbatt) / 100;
        lines.push({
          sourceId,
          mode: "forfait",
          ecId: course.ecId,
          classeId: course.classeId,
          coursLabel: course.coursLabel,
          duree: coursPointages.reduce((s, p) => s + p.volumePointe, 0),
          date: dateFin,
          niveauLabel: niveauTxt,
          classeLabel: classeTxt,
          anneeLabel: anneeScolaire,
          semestreLabel: semestreTxt,
          montantBrut,
          abattementPct: rate.tauxAbatt,
          abattementMontant,
          montantNet: montantBrut - abattementMontant,
        });
      }
    }
    return lines.sort((a, b) => a.coursLabel.localeCompare(b.coursLabel, "fr") || a.date.localeCompare(b.date));
  }, [selected, seances, ecs, ues, classes, anneeScolaire, teacherRates, teacherCourseStatuses, pointages, sourceIdsDejaDecomptes]);

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
      type: "a_terme",
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
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les décomptes", href: "/admin/decomptes" }, { label: "À terme" }]}
        title="Nouveau décompte — À terme"
        subtitle="Génère un décompte pour les cours explicitement marqués « à terme » (règlement différé), quel que soit leur mode de paiement"
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
              data-testid="decompte-aterme-search"
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
                    data-testid={`decompte-aterme-option-${t.id}`}
                  >
                    {teacherDisplayLabel(t)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="decompte-aterme-annee" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Année scolaire
            </label>
            <select
              id="decompte-aterme-annee"
              value={anneeScolaire}
              onChange={(e) => { setAnneeScolaire(e.target.value); setChecked(new Set()); }}
              className={`${inputClass} min-w-[140px]`}
              data-testid="decompte-aterme-annee"
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
          Sélectionnez un professeur pour afficher ses cours marqués « à terme »
        </div>
      ) : eligibleLines.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-20 text-center text-sm text-muted-foreground">
          Aucun cours marqué « à terme », pointé et non encore décompté pour {selected.prenom} {selected.nom} sur {anneeScolaire}.
          Le marquage se fait sur la page « Mise à jour statut cours ».
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
              data-testid="decompte-aterme-tout-cocher"
            >
              {checked.size === eligibleLines.length ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>

          <div className="bg-card border border-border border-t-0 overflow-x-auto" style={{ boxShadow: "var(--shadow-sm)" }}>
            <table className="w-full min-w-[950px] text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 w-10" />
                  <th className="text-left px-3 py-3">Cours</th>
                  <th className="text-center px-3 py-3">Mode</th>
                  <th className="text-left px-3 py-3">Date</th>
                  <th className="text-center px-3 py-3">Durée (h)</th>
                  <th className="text-right px-3 py-3">Montant brut</th>
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
                        data-testid={`decompte-aterme-check-${l.sourceId}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">{l.coursLabel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {l.niveauLabel} — {l.classeLabel} — {l.anneeLabel}
                        {l.semestreLabel ? ` — ${l.semestreLabel}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", l.mode === "forfait" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700")}>
                        {l.mode === "forfait" ? "Forfait" : "Taux horaire"}
                      </span>
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
              data-testid="decompte-aterme-generer"
            >
              <FileCheck2 size={15} /> Générer le décompte ({selectedLines.length})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
