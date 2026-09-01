import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Search, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useStudentStore, useUserAccounts } from "@/hooks/useStudentStore";
import type { EtudiantRecord } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import {
  genererDerogation,
  trouverDerogationIdentique,
  PORTEE_LABELS,
  type PorteeDerogation,
} from "@/data/derogationPaiementStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function NouvelleDerogationPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const personnel = useUserAccounts().filter((u) => u.role !== "student");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);
  const [portee, setPortee] = useState<PorteeDerogation>("reinscription");
  const [motif, setMotif] = useState("");
  const [personnelId, setPersonnelId] = useState(() => currentUser?.id ?? "");
  const [dateDebut, setDateDebut] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState(() => todayPlus(90));

  const filteredStudents = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const derogationIdentique = useMemo(
    () => (selectedStudent ? trouverDerogationIdentique(selectedStudent.id, portee) : undefined),
    [selectedStudent, portee],
  );

  const peutSoumettre =
    !!selectedStudent && !!personnelId && motif.trim().length > 0 && !!dateDebut && !!dateFin && dateFin >= dateDebut;

  const handleSubmit = () => {
    if (!selectedStudent || !peutSoumettre) return;
    const pers = personnel.find((p) => p.id === personnelId);
    const record = genererDerogation({
      etudiantId: selectedStudent.id,
      etudiantLabel: `${selectedStudent.matricule} - ${selectedStudent.prenom} ${selectedStudent.nom}`,
      soldeDuConstate: selectedStudent.soldeDu,
      portee,
      motif: motif.trim(),
      personnelId,
      personnelLabel: pers ? `${pers.identifier} - ${pers.displayName}` : "Administration",
      dateDebut,
      dateFin,
    });
    toast.success(`Dérogation ${record.reference} accordée à ${selectedStudent.prenom} ${selectedStudent.nom}`);
    setLocation(`/admin/derogation-paiement/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Dérogation des paiements", href: "/admin/derogation-paiement" }, { label: "Nouvelle dérogation" }]}
        title="Nouvelle dérogation"
        subtitle="Autoriser exceptionnellement un étudiant en impayé à poursuivre une démarche, sans réduire sa dette"
        actions={
          <button onClick={() => setLocation("/admin/derogation-paiement")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="max-w-2xl space-y-4">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Étudiant</p>
          {selectedStudent ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary bg-primary/5">
              <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="sm" />
              <div className="flex-1">
                <div className="font-medium text-foreground text-sm">{selectedStudent.prenom} {selectedStudent.nom}</div>
                <div className="text-xs text-muted-foreground font-mono">{selectedStudent.matricule}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Solde dû</div>
                <div className="text-sm font-bold text-foreground">{formatCFA(selectedStudent.soldeDu)}</div>
              </div>
              <button onClick={() => { setSelectedStudent(null); setSearchQuery(""); }} className="text-xs text-primary hover:underline ml-2">Changer</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom ou matricule…"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="derogation-search-student"
                />
              </div>
              {filteredStudents.map((stu) => (
                <div
                  key={stu.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted cursor-pointer transition-all"
                  onClick={() => setSelectedStudent(stu)}
                  data-testid={`derogation-student-option-${stu.id}`}
                >
                  <UserAvatar name={`${stu.prenom} ${stu.nom}`} size="sm" />
                  <div className="flex-1">
                    <div className="font-medium text-foreground text-sm">{stu.prenom} {stu.nom}</div>
                    <div className="text-xs text-muted-foreground font-mono">{stu.matricule}</div>
                  </div>
                  {stu.soldeDu > 0 && <div className="text-xs text-red-500">Doit {formatCFA(stu.soldeDu)}</div>}
                </div>
              ))}
              {searchQuery.length > 1 && filteredStudents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun étudiant trouvé</p>
              )}
            </>
          )}
          {selectedStudent && selectedStudent.soldeDu === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              Cet étudiant n&apos;a aucun solde dû actuellement — une dérogation n&apos;a pas d&apos;utilité immédiate.
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Portée</p>
          <div className="grid gap-2">
            {(Object.entries(PORTEE_LABELS) as [PorteeDerogation, string][]).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors text-sm",
                  portee === value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                )}
              >
                <input type="radio" name="portee" checked={portee === value} onChange={() => setPortee(value)} className="text-primary" data-testid={`derogation-portee-${value}`} />
                {label}
              </label>
            ))}
          </div>

          {derogationIdentique && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs" data-testid="derogation-doublon">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              Une dérogation active couvre déjà cette portée pour cet étudiant : <strong>{derogationIdentique.reference}</strong>, valable jusqu&apos;au {formatShortDate(derogationIdentique.dateFin)}.
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Motif *</p>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            placeholder="Justification de la dérogation (obligatoire)…"
            className={cn(inputClass, "resize-y")}
            data-testid="derogation-motif"
          />

          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Autorisée par</p>
          <select
            value={personnelId}
            onChange={(e) => setPersonnelId(e.target.value)}
            className={inputClass}
            data-testid="derogation-personnel"
          >
            <option value="">Sélectionner</option>
            {personnel.map((p) => (
              <option key={p.id} value={p.id}>{p.identifier} - {p.displayName}</option>
            ))}
          </select>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Valable à partir du *</label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} data-testid="derogation-date-debut" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Jusqu&apos;au *</label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} data-testid="derogation-date-fin" />
              {dateFin < dateDebut && <p className="text-[11px] text-red-600 mt-1">La date de fin doit être postérieure à la date de début.</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!peutSoumettre}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="derogation-soumettre"
          >
            Accorder la dérogation
          </button>
          <button onClick={() => setLocation("/admin/derogation-paiement")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
        </div>
      </div>
    </div>
  );
}
