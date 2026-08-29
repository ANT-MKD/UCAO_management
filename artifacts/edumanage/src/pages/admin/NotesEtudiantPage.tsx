import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { DataTable, Column } from "@/components/admin/DataTable";
import { useStudentStore, useNotes } from "@/hooks/useStudentStore";
import { deleteNote, type EtudiantRecord, type NoteRecord } from "@/data/studentStore";
import { getClasseById } from "@/data/structureStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

interface NoteRow {
  id: string;
  date: string;
  cours: string;
  session: string;
  enseignePar: string;
  classeNom: string;
  filiere: string;
  niveau: string;
  annee: string;
  type: string;
  note: number;
}

export default function NotesEtudiantPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const notes = useNotes();
  const evaluations = useEvaluations();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [etudiantId, setEtudiantId] = useState("");

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
    setSearchQuery(`${e.matricule} - ${e.prenom} ${e.nom} (${e.telephone})`);
    setShowSuggestions(false);
  };

  // Chaque note est enrichie via l'évaluation réelle correspondante (classeId+ecId+type)
  // quand elle existe ; les notes de seed antérieures au module Évaluation n'en ont pas —
  // on affiche alors "—" plutôt que d'inventer une session, un enseignant ou une date.
  const rows: NoteRow[] = notes
    .filter((n) => n.etudiantId === etudiantId)
    .map((n): NoteRow => {
      const classe = getClasseById(n.classeId);
      const evType: "devoir" | "examen" = n.type === "CC" ? "devoir" : "examen";
      const ev = evaluations.find((e) => e.classeId === n.classeId && e.ecId === n.ecId && e.type === evType);
      return {
        id: n.id,
        date: ev?.dateCreation ?? "—",
        cours: n.ec,
        session: ev?.semestre ?? "—",
        enseignePar: ev?.professeur ?? "—",
        classeNom: classe?.nom ?? n.classeId,
        filiere: classe?.filiere ?? "—",
        niveau: classe?.niveau ?? "—",
        annee: n.annee,
        type: n.type === "CC" ? "Devoir" : "Examen",
        note: n.note,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleDelete = (row: NoteRow) => {
    if (!confirm(`Supprimer la note "${row.type}" de ${row.cours} (${row.note}) ?`)) return;
    deleteNote(row.id);
    toast.success("Note supprimée");
  };

  const columns: Column<NoteRow>[] = [
    {
      key: "date", header: "Date", sortable: true,
      render: (r) => <span className="text-sm text-foreground">{r.date}</span>,
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
        <span className={cn("text-sm font-bold", r.note >= 10 ? "text-emerald-600" : "text-red-500")}>{r.note.toFixed(1)}</span>
      ),
    },
    {
      key: "actions", header: "",
      render: (r) => (
        <button
          onClick={() => handleDelete(r)}
          className="w-8 h-8 rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300 flex items-center justify-center hover:bg-red-100 transition-colors"
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
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Étudiant</label>
        <div className="relative">
          <input
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
                  {e.matricule} - {e.prenom} {e.nom} ({e.telephone})
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
    </div>
  );
}
