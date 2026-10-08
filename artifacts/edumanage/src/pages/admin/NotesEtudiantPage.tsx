import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useStudentStore, useNotes } from "@/hooks/useStudentStore";
import { deleteNote, noteOfficielle, type EtudiantRecord, type NoteRecord } from "@/data/studentStore";
import { FormModal } from "@/components/admin/FormModal";
import { useAuth } from "@/contexts/AuthContext";
import { getClasseById } from "@/data/structureStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { cn } from "@/lib/utils";
import { formatNote } from "@/lib/notes";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

interface NoteRow {
  id: string;
  date: string;
  dateAffichee: string;
  modifiee: boolean;
  cours: string;
  session: string;
  enseignePar: string;
  classeNom: string;
  filiere: string;
  niveau: string;
  annee: string;
  type: string;
  note: number;
  statut: NoteRecord["statut"];
}

const LIBELLE_STATUT: Record<NoteRecord["statut"], string> = {
  brouillon_prof: "Brouillon",
  soumis_admin: "Soumise",
  valide_admin: "Validée",
  publie: "Publiée",
};

export default function NotesEtudiantPage() {
  const { currentUser } = useAuth();
  const [aSupprimer, setASupprimer] = useState<NoteRow | null>(null);
  const [motif, setMotif] = useState("");
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const notes = useNotes();
  const evaluations = useEvaluations();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  // ?etudiant=<id> : ouverture directe depuis une réclamation de note (Demandes étudiants).
  const searchStr = useSearch();
  const [etudiantId, setEtudiantId] = useState(() => new URLSearchParams(searchStr).get("etudiant") ?? "");

  const etudiant = etudiants.find((e) => e.id === etudiantId);

  const suggestions = searchQuery.trim().length > 0 && !etudiantId
    ? etudiants.filter((e) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          e.matricule.toLowerCase().includes(q) ||
          e.prenom.toLowerCase().includes(q) ||
          e.nom.toLowerCase().includes(q) ||
          e.telephone.includes(q)
        );
      })
    : [];

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    setEtudiantId("");
  };

  const handleSelectEtudiant = (e: EtudiantRecord) => {
    setEtudiantId(e.id);
    setSearchQuery(`${e.matricule} - ${e.prenom} ${e.nom}${e.telephone ? ` (${e.telephone})` : ""}`);
    setShowSuggestions(false);
  };

  // Chaque note est enrichie via l'évaluation réelle correspondante (classeId+ecId+type)
  // quand elle existe ; les notes de seed antérieures au module Évaluation n'en ont pas —
  // on affiche alors "—" plutôt que d'inventer une session ou un enseignant. La date, elle,
  // vient toujours de la note elle-même (dateModification si resaisie, sinon dateCreation).
  const rows: NoteRow[] = notes
    .filter((n) => n.etudiantId === etudiantId)
    .map((n): NoteRow => {
      const classe = getClasseById(n.classeId);
      const evType: "devoir" | "examen" = n.type === "CC" ? "devoir" : "examen";
      const ev = evaluations.find((e) => e.classeId === n.classeId && e.ecId === n.ecId && e.type === evType && e.session === n.session);
      const dateReelle = n.dateModification ?? n.dateCreation;
      return {
        id: n.id,
        date: dateReelle,
        dateAffichee: new Date(dateReelle).toLocaleDateString("fr-FR"),
        modifiee: Boolean(n.dateModification),
        cours: n.ec,
        session: ev?.semestre ?? "—",
        enseignePar: ev?.professeur ?? "—",
        classeNom: classe?.nom ?? n.classeId,
        filiere: classe?.filiere ?? "—",
        niveau: classe?.niveau ?? "—",
        annee: n.annee,
        type: `${n.type === "CC" ? "Devoir" : "Examen"}${n.session === "rattrapage" ? " (Rattrapage)" : ""}`,
        note: n.note,
        statut: n.statut,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const supprimer = (row: NoteRow, motifSaisi?: string) => {
    try {
      deleteNote(row.id, currentUser?.id ?? "admin", motifSaisi);
      toast.success("Note supprimée — la suppression est inscrite au journal d'audit");
      setASupprimer(null);
      setMotif("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
    }
  };

  // Une note validée ou publiée compte déjà dans les résultats : on demande un motif.
  const handleDelete = (row: NoteRow) => {
    if (noteOfficielle(row)) { setMotif(""); setASupprimer(row); return; }
    if (!confirm(`Supprimer la note "${row.type}" de ${row.cours} (${formatNote(row.note)}) ?`)) return;
    supprimer(row);
  };

  const columns: Column<NoteRow>[] = [
    {
      key: "date", header: "Date", sortable: true,
      render: (r) => (
        <div>
          <span className="text-sm text-foreground">{r.dateAffichee}</span>
          {r.modifiee && <p className="text-[11px] text-muted-foreground">Modifiée</p>}
        </div>
      ),
    },
    {
      key: "cours", header: "Cours",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.cours}</p>
          <p className="text-xs text-muted-foreground">Session : <strong className="text-foreground">{r.session}</strong></p>
          <p className="text-xs text-muted-foreground">Enseigné par : <strong className="text-foreground">{r.enseignePar}</strong></p>
        </div>
      ),
    },
    {
      key: "classeNom", header: "Classe",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.classeNom}</p>
          <p className="text-xs text-muted-foreground">Filière : <strong className="text-foreground">{r.filiere}</strong></p>
          <p className="text-xs text-muted-foreground">Niveau / Année : <strong className="text-foreground">{r.niveau} / {r.annee}</strong></p>
        </div>
      ),
    },
    {
      key: "type", header: "Type évaluation",
      render: (r) => <span className="text-sm text-foreground">{r.type}</span>,
    },
    {
      key: "note", header: "Note",
      sortable: true,
      render: (r) => (
        <div>
          <span className={cn("text-sm font-bold", r.note >= 10 ? "text-emerald-600" : "text-red-500")}>{formatNote(r.note)}</span>
          <p className="text-[11px] text-muted-foreground">{LIBELLE_STATUT[r.statut]}</p>
        </div>
      ),
    },
    {
      key: "actions", header: "",
      render: (r) => (
        <button
          onClick={() => handleDelete(r)}
          className="w-8 h-8 rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300 flex items-center justify-center hover:bg-red-100 transition-colors"
          aria-label={`Supprimer la note ${r.type} de ${r.cours}`}
          data-testid={`note-etudiant-supprimer-${r.id}`}
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Notes étudiants" }]}
        title="Notes étudiant"
        subtitle="Historique complet des notes réelles d'un étudiant, tous cours confondus"
        actions={
          <button onClick={() => setLocation("/admin/notes")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <label htmlFor="notes-etudiant-champ-1" className="block text-xs font-medium text-muted-foreground mb-1.5">Étudiant</label>
        <div className="relative">
          <input id="notes-etudiant-champ-1"
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Veuillez saisir le code, le prénom, le nom ou le numéro de téléphone de l'étudiant…"
            className={inputClass}
            data-testid="note-etudiant-recherche"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {suggestions.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleSelectEtudiant(e)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                  data-testid={`note-etudiant-suggestion-${e.id}`}
                >
                  {e.matricule} - {e.prenom} {e.nom}{e.telephone ? ` (${e.telephone})` : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        {etudiant && (
          <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border">
            <UserAvatar name={`${etudiant.prenom} ${etudiant.nom}`} size="md" />
            <div>
              <p className="font-bold text-foreground">{etudiant.matricule} - {etudiant.prenom} {etudiant.nom}</p>
              <p className="text-xs text-muted-foreground">{etudiant.filiere} · {etudiant.classe}</p>
            </div>
          </div>
        )}
      </div>

      {etudiantId && (
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={rows as unknown as Record<string, unknown>[]}
          searchable
          searchPlaceholder="Rechercher un cours…"
          pageSize={25}
          emptyMessage="Aucune note enregistrée pour cet étudiant"
        />
      )}

      <FormModal open={!!aSupprimer} onClose={() => setASupprimer(null)} title="Supprimer une note publiée" subtitle="Cette note compte déjà dans les résultats de l'étudiant" size="md">
        {aSupprimer && (
          <div className="space-y-4" data-testid="note-suppression-modal">
            <p className="text-sm text-foreground">
              {aSupprimer.type} de <strong>{aSupprimer.cours}</strong> : <strong>{formatNote(aSupprimer.note)}</strong> ({LIBELLE_STATUT[aSupprimer.statut].toLowerCase()}).
              La moyenne et les crédits de l&apos;étudiant seront recalculés sans cette note.
            </p>
            <div>
              <label htmlFor="note-suppression-motif" className="block text-xs font-medium text-muted-foreground mb-1.5">Motif de la suppression *</label>
              <textarea
                id="note-suppression-motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                placeholder="ex : note saisie pour le mauvais étudiant"
                className={inputClass}
                data-testid="note-suppression-motif"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Le motif, l&apos;ancienne note et votre nom sont inscrits au journal d&apos;audit.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setASupprimer(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
              <button
                type="button"
                onClick={() => supprimer(aSupprimer, motif)}
                disabled={!motif.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="note-suppression-confirmer"
              >
                Supprimer la note
              </button>
            </div>
          </div>
        )}
      </FormModal>
    </div>
  );
}
