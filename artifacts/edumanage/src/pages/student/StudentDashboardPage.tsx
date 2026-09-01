import { CalendarDays, CreditCard, FileText, AlertTriangle } from "lucide-react";
import { KPICard } from "@/components/admin/KPICard";
import { useStudentStore, useSeances, useNotes, usePaiements } from "@/hooks/useStudentStore";
import { useAuth } from "@/contexts/AuthContext";
import { PubliciteBanner } from "@/components/PubliciteBanner";

export default function StudentDashboardPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const notes = useNotes();
  const paiements = usePaiements();
  const seances = useSeances();

  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const studentNotes = notes.filter((n) => n.etudiantId === student?.id && n.statut === "publie");
  const studentPaiements = paiements.filter((p) => p.etudiantId === student?.id);
  const studentSeances = seances.filter((s) => s.classeId === student?.classeId);

  const moyenne = studentNotes.length
    ? (studentNotes.reduce((sum, n) => sum + n.note, 0) / studentNotes.length).toFixed(2)
    : "--";

  return (
    <div className="space-y-6">
      <PubliciteBanner profil="student" />
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <p className="text-sm text-muted-foreground">Bienvenue</p>
        <h2 className="text-2xl font-bold text-foreground mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>
          {student ? `${student.prenom} ${student.nom}` : "Étudiant"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {student ? `${student.matricule} · ${student.classe} · ${student.filiere}` : "Aucun profil lié pour le moment"}
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard icon={CalendarDays} label="Séances cette semaine" value={studentSeances.length} accentColor="#2563eb" />
        <KPICard icon={FileText} label="Notes publiées" value={studentNotes.length} accentColor="#10b981" />
        <KPICard icon={CreditCard} label="Paiements enregistrés" value={studentPaiements.length} accentColor="#4f46e5" />
        <KPICard
          icon={AlertTriangle}
          label="Solde dû"
          value={student ? `${student.soldeDu.toLocaleString("fr-FR")} FCFA` : "--"}
          accentColor={student && student.soldeDu > 0 ? "#ef4444" : "#10b981"}
        />
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
            Aperçu académique
          </h3>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Moyenne publiée: <span className="font-semibold text-foreground">{moyenne}/20</span>
            </p>
            <p className="text-muted-foreground">
              Statut: <span className="font-semibold text-foreground">{student?.statut ?? "--"}</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
            Prochaines étapes
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Consulter les notes publiées et télécharger votre relevé.</li>
            <li>Vérifier l’emploi du temps de votre classe.</li>
            <li>Suivre votre solde et vos paiements.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
