import { useLocation } from "wouter";
import { ArrowLeft, BookOpen, ClipboardList, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, ENSEIGNANTS } from "@/data/mockData";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { deleteEvaluation, type EvaluationRecord } from "@/data/evaluationStore";
import { useNotes, useStudentStore } from "@/hooks/useStudentStore";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { cn } from "@/lib/utils";

function noteTypeFor(type: EvaluationRecord["type"]): "CC" | "EF" {
  return type === "devoir" ? "CC" : "EF";
}

export default function DevoirDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const evaluations = useEvaluations();
  const notes = useNotes();
  const etudiants = useStudentStore();
  const scolariteConfigs = useScolariteConfigs();

  const evaluation = evaluations.find((e) => e.id === id);

  if (!evaluation) {
    return (
      <div>
        <PageHeader breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Devoir" }]} title="Évaluation introuvable" />
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Cette évaluation n&apos;existe plus (peut-être déjà supprimée).
          <div className="mt-4">
            <button onClick={() => setLocation("/admin/evaluation/devoir")} className="text-primary hover:underline text-sm">Retour à la liste</button>
          </div>
        </div>
      </div>
    );
  }

  const filiere = FILIERES.find((f) => f.id === evaluation.filiereId);
  const professeur = evaluation.professeurId ? ENSEIGNANTS.find((en) => en.id === evaluation.professeurId) : undefined;
  const bareme = scolariteConfigs.find((c) => c.filiereId === evaluation.filiereId)?.noteBareme ?? 20;

  const noteType = noteTypeFor(evaluation.type);
  const matched = notes.filter((n) => n.classeId === evaluation.classeId && n.ecId === evaluation.ecId && n.type === noteType);
  const values = matched.map((n) => n.note);
  const stats = values.length > 0 ? {
    min: Math.min(...values),
    max: Math.max(...values),
    moyenne: values.reduce((a, b) => a + b, 0) / values.length,
  } : null;

  const lignes = matched
    .map((n) => ({ note: n, etudiant: etudiants.find((e) => e.id === n.etudiantId) }))
    .filter((l): l is { note: typeof matched[number]; etudiant: NonNullable<typeof l.etudiant> } => !!l.etudiant)
    .sort((a, b) => `${a.etudiant.nom}${a.etudiant.prenom}`.localeCompare(`${b.etudiant.nom}${b.etudiant.prenom}`));

  const handleDelete = () => {
    if (!confirm(`Supprimer l'évaluation ${evaluation.code} (${evaluation.type === "devoir" ? "Devoir" : "Examen"}) ? Cette action est définitive.`)) return;
    deleteEvaluation(evaluation.id);
    toast.success("Évaluation supprimée");
    setLocation("/admin/evaluation/devoir");
  };

  const infoRow = (label: string, value: string) => (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Devoir" }, { label: "Consultation note étudiant" }]}
        title="Consultation note étudiant"
        actions={
          <button onClick={() => setLocation("/admin/evaluation/devoir")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-950/40 border-b border-border">
            <BookOpen size={16} className="text-red-500" />
            <h3 className="font-bold text-foreground text-sm">Cours</h3>
          </div>
          <div className="px-5 py-2">
            {infoRow("Filière", `${filiere?.code ?? evaluation.filiere} — ${filiere?.nom ?? ""}`)}
            {infoRow("Année | Niveau | Classe", `${evaluation.annee} | ${evaluation.niveau} | ${evaluation.classe}`)}
            {infoRow("Cours | Session", `${evaluation.cours} | ${evaluation.semestre}`)}
            {infoRow("Professeur", professeur ? `${professeur.matricule} — ${professeur.prenom} ${professeur.nom}` : evaluation.professeur || "—")}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 px-5 py-3 bg-primary/10 border-b border-border">
            <ClipboardList size={16} className="text-primary" />
            <h3 className="font-bold text-foreground text-sm">Code {evaluation.type === "devoir" ? "devoir" : "examen"} : {evaluation.code} effectué le : {evaluation.dateCreation}</h3>
          </div>
          <div className="px-5 py-2">
            {infoRow("Type évaluation", evaluation.type === "devoir" ? "Devoir" : "Examen")}
            {infoRow("Description", `Noté sur ${bareme}, pondération ${evaluation.poids}% de la moyenne du cours`)}
            <div className="flex items-center justify-between py-2">
              {stats ? (
                <div className="flex gap-4 text-xs">
                  <span className="text-muted-foreground">Note min : <strong className="text-foreground">{stats.min}</strong></span>
                  <span className="text-muted-foreground">Note max : <strong className="text-foreground">{stats.max}</strong></span>
                  <span className="text-muted-foreground">Moyenne : <strong className="text-foreground">{stats.moyenne.toFixed(1)}</strong></span>
                </div>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-amber-600"><AlertTriangle size={12} /> Pas de fiche de notes</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-bold text-foreground text-sm">Notes des étudiants</h3>
          <p className="text-xs text-muted-foreground">{lignes.length} note(s) saisie(s) via Saisie des Notes pour ce cours et cette classe</p>
        </div>
        {lignes.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucune note saisie pour cette évaluation pour le moment.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Étudiant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Note</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ note, etudiant }) => (
                <tr key={note.id} className="border-b border-border last:border-0" data-testid={`devoir-detail-note-${etudiant.id}`}>
                  <td className="px-4 py-3 text-foreground">
                    <span className="font-mono text-xs text-muted-foreground mr-2" style={{ fontFamily: "JetBrains Mono, monospace" }}>{etudiant.matricule}</span>
                    {etudiant.prenom} {etudiant.nom}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", note.note >= 10 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300")}>
                      {note.note.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button
        onClick={handleDelete}
        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
        data-testid="devoir-detail-supprimer"
      >
        <Trash2 size={14} /> Supprimer
      </button>
    </div>
  );
}
