import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useSeances } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeacherRates } from "@/hooks/useTeacherRateStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { makeTeacherRateId, type ModePaiementProf } from "@/data/teacherRateStore";
import { makeTeacherVolumeId } from "@/data/teacherVolumeStore";
import { addTeacherContract } from "@/data/teacherContractStore";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { filterTeachers, teacherDisplayLabel, type EnseignantRecord } from "@/lib/teacherUtils";
import { formatCFA, cn } from "@/lib/utils";

const ANNEE_OPTIONS = [...ANNEES_ACADEMIQUES]
  .sort((a, b) => b.libelle.localeCompare(a.libelle))
  .map((a) => a.libelle);

const DEFAULT_ANNEE =
  ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEE_OPTIONS[0] ?? "2025-2026";

const MODE_LABEL: Record<ModePaiementProf, string> = {
  "": "—",
  taux_horaire: "Volume horaire",
  forfait: "Forfait",
};

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

interface ContractRow {
  courseId: string;
  ecId: string;
  classeId: string;
  filiereLabel: string;
  coursLabel: string;
  detailsLabel: string;
  volumeHoraire: number;
  modePaiement: ModePaiementProf;
  montant: number | null;
}

export default function TeacherContractFormPage() {
  const [, setLocation] = useLocation();

  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const savedRates = useTeacherRates();
  const savedVolumes = useTeacherVolumes();
  const teachers = ENSEIGNANTS as EnseignantRecord[];

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [anneeScolaire, setAnneeScolaire] = useState(DEFAULT_ANNEE);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const selected = teachers.find((t) => t.id === selectedId) ?? null;
  const suggestions = useMemo(() => filterTeachers(teachers, query).slice(0, 8), [teachers, query]);

  const courseItems = useMemo(() => {
    if (!selected) return [];
    return buildTeacherCourses(selected, seances, ecs, ues, classes, anneeScolaire);
  }, [selected, seances, ecs, ues, classes, anneeScolaire]);

  const rows: ContractRow[] = useMemo(() => {
    if (!selected) return [];
    return courseItems.map((c) => {
      const rateId = makeTeacherRateId(selected.id, c.ecId, c.classeId, anneeScolaire);
      const rate = savedRates.find((r) => r.id === rateId);
      const volumeId = makeTeacherVolumeId(selected.id, c.ecId, c.classeId, anneeScolaire);
      const vh = savedVolumes.find((v) => v.id === volumeId)?.nouveauVh ?? c.volumeHoraire;

      let montant: number | null = null;
      if (rate && rate.modePaiement && rate.montant != null) {
        const abattement = 1 - (rate.tauxAbatt || 0) / 100;
        const brut = rate.modePaiement === "forfait" ? rate.montant : rate.montant * vh;
        montant = Math.round(brut * abattement);
      }

      return {
        courseId: c.id,
        ecId: c.ecId,
        classeId: c.classeId,
        filiereLabel: c.filiereLabel,
        coursLabel: c.coursLabel,
        detailsLabel: `${c.detailsLabel} · V.H : ${vh}`,
        volumeHoraire: vh,
        modePaiement: rate?.modePaiement ?? "",
        montant,
      };
    });
  }, [selected, courseItems, anneeScolaire, savedRates, savedVolumes]);

  // Par défaut, toutes les lignes valorisées (montant défini) sont cochées.
  useEffect(() => {
    setChecked(new Set(rows.filter((r) => r.montant != null).map((r) => r.courseId)));
  }, [selected, anneeScolaire]);

  const toggleRow = (courseId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const toggleAll = () => {
    const selectable = rows.filter((r) => r.montant != null).map((r) => r.courseId);
    setChecked((prev) => (prev.size === selectable.length ? new Set() : new Set(selectable)));
  };

  const pickTeacher = (t: EnseignantRecord) => {
    setSelectedId(t.id);
    setQuery(teacherDisplayLabel(t));
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    if (!selected) {
      toast.error("Sélectionnez un professeur");
      return;
    }
    if (!dateDebut || !dateFin) {
      toast.error("Indiquez le début et la fin du contrat");
      return;
    }
    if (dateFin < dateDebut) {
      toast.error("La date de fin doit être postérieure à la date de début");
      return;
    }
    const lignes = rows
      .filter((r) => checked.has(r.courseId) && r.montant != null && r.modePaiement)
      .map((r) => ({
        ecId: r.ecId,
        classeId: r.classeId,
        modePaiement: r.modePaiement as "taux_horaire" | "forfait",
        montant: r.montant as number,
      }));
    if (lignes.length === 0) {
      toast.error("Sélectionnez au moins un cours valorisé (taux horaire/forfait défini)");
      return;
    }

    const contract = addTeacherContract({
      teacherId: selected.id,
      annee: anneeScolaire,
      dateDebut,
      dateFin,
      lignes,
    });

    toast.success(`Contrat ${contract.id} créé`);
    setLocation("/admin/teachers/contracts");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Les contrats Professeur" }, { label: "Nouveau Contrat Professeur" }]}
        title="Nouveau Contrat Professeur"
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-3 relative">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Professeur <span className="text-red-500">*</span>
            </label>
            <Search size={15} className="absolute left-3 top-[38px] text-muted-foreground z-10" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
                if (!e.target.value.trim()) setSelectedId("");
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Veuillez saisir le code, le prénom, le nom ou le numéro de téléphone du professeur…"
              className={`${inputClass} pl-10`}
              data-testid="teacher-contract-search"
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
                  >
                    {teacherDisplayLabel(t)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Début contrat <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Fin contrat <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Année <span className="text-red-500">*</span>
            </label>
            <select value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)} className={inputClass}>
              {ANNEE_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selected && (
        <div className="mt-5 bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 border-b border-border bg-muted/40">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Détails contrat</h3>
          </div>
          {rows.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Aucun cours associé à ce professeur pour l&apos;année {anneeScolaire}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="text-center px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={checked.size > 0 && checked.size === rows.filter((r) => r.montant != null).length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="text-left px-4 py-3">Cours Professeur</th>
                    <th className="text-right px-4 py-3">Montant</th>
                    <th className="text-left px-4 py-3">Mode Paiement</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.courseId} className="border-b border-border last:border-0 align-top">
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          className="rounded"
                          disabled={r.montant == null}
                          checked={checked.has(r.courseId)}
                          onChange={() => toggleRow(r.courseId)}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-foreground text-sm leading-snug">{r.filiereLabel}</p>
                        <p className="text-primary font-medium text-sm mt-1">{r.coursLabel}</p>
                        <p className="text-xs text-muted-foreground mt-1">{r.detailsLabel}</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {r.montant != null ? (
                          <span className="font-semibold">{formatCFA(r.montant)}</span>
                        ) : (
                          <span className="text-red-600 text-xs font-medium">Taux horaire non défini</span>
                        )}
                      </td>
                      <td className="px-4 py-4">{MODE_LABEL[r.modePaiement]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end px-5 py-4 border-t border-border">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Save size={15} /> Créer le contrat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
