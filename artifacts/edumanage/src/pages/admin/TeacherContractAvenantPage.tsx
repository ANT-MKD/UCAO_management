import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { useSeances } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useTeacherRates } from "@/hooks/useTeacherRateStore";
import { useTeacherVolumes } from "@/hooks/useTeacherVolumeStore";
import { makeTeacherRateId, type ModePaiementProf } from "@/data/teacherRateStore";
import { makeTeacherVolumeId } from "@/data/teacherVolumeStore";
import { addAvenant } from "@/data/teacherContractStore";
import { useTeacherContracts } from "@/hooks/useTeacherContractStore";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { type EnseignantRecord } from "@/lib/teacherUtils";
import { formatCFA, cn } from "@/lib/utils";

const MODE_LABEL: Record<ModePaiementProf, string> = {
  "": "—",
  taux_horaire: "Volume horaire",
  forfait: "Forfait",
};

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

interface AvenantRow {
  courseId: string;
  ecId: string;
  classeId: string;
  filiereLabel: string;
  coursLabel: string;
  detailsLabel: string;
  modePaiement: ModePaiementProf;
  montant: number | null;
}

export default function TeacherContractAvenantPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const contracts = useTeacherContracts();
  const contract = contracts.find((c) => c.id === id);

  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const savedRates = useTeacherRates();
  const savedVolumes = useTeacherVolumes();
  const teachers = ENSEIGNANTS as EnseignantRecord[];
  const teacher = contract ? teachers.find((t) => t.id === contract.teacherId) ?? null : null;

  const [dateFin, setDateFin] = useState(contract?.dateFin ?? "");
  const [motif, setMotif] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const courseItems = useMemo(() => {
    if (!teacher || !contract) return [];
    return buildTeacherCourses(teacher, seances, ecs, ues, classes, contract.annee);
  }, [teacher, contract, seances, ecs, ues, classes]);

  const rows: AvenantRow[] = useMemo(() => {
    if (!teacher || !contract) return [];
    return courseItems.map((c) => {
      const rateId = makeTeacherRateId(teacher.id, c.ecId, c.classeId, contract.annee);
      const rate = savedRates.find((r) => r.id === rateId);
      const volumeId = makeTeacherVolumeId(teacher.id, c.ecId, c.classeId, contract.annee);
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
        modePaiement: rate?.modePaiement ?? "",
        montant,
      };
    });
  }, [teacher, contract, courseItems, savedRates, savedVolumes]);

  // Pré-coche les cours déjà présents dans le contrat actuel.
  useEffect(() => {
    if (initialized || !contract || rows.length === 0) return;
    const current = new Set(contract.lignes.map((l) => `${l.ecId}:${l.classeId}`));
    setChecked(new Set(rows.filter((r) => current.has(`${r.ecId}:${r.classeId}`)).map((r) => r.courseId)));
    setInitialized(true);
  }, [initialized, contract, rows]);

  const toggleRow = (courseId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  if (!contract) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Accueil" }, { label: "Les contrats Professeur", href: "/admin/teachers/contracts" }]}
          title="Contrat introuvable"
        />
      </div>
    );
  }

  const handleSubmit = () => {
    if (!motif.trim()) {
      toast.error("Indiquez le motif de l'avenant");
      return;
    }
    if (!dateFin) {
      toast.error("Indiquez la date de fin du contrat");
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
      toast.error("Sélectionnez au moins un cours valorisé");
      return;
    }

    addAvenant(contract.id, { motif: motif.trim(), dateFin, lignes });
    toast.success("Avenant enregistré");
    setLocation(`/admin/teachers/contracts/${contract.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Accueil" },
          { label: "Les contrats Professeur", href: "/admin/teachers/contracts" },
          { label: contract.id, href: `/admin/teachers/contracts/${contract.id}` },
          { label: "Nouvel avenant" },
        ]}
        title={`Nouvel avenant — ${contract.id}`}
        subtitle={teacher ? `${teacher.prenom} ${teacher.nom} · Année ${contract.annee}` : undefined}
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-4 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Nouvelle fin de contrat <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Motif de l&apos;avenant <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Raison de la modification (prolongation, ajout de cours, révision de taux…)"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Détails contrat (nouvelle version)</h3>
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Aucun cours associé à ce professeur pour l&apos;année {contract.annee}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 w-10" />
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
            <Save size={15} /> Enregistrer l&apos;avenant
          </button>
        </div>
      </div>
    </div>
  );
}
