import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useStudentStore } from "@/hooks/useStudentStore";
import type { EtudiantRecord } from "@/data/studentStore";
import { deposerAvoir } from "@/data/avoirDepotStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function AvoirDepotFormPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const { currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [moyenOrigine, setMoyenOrigine] = useState("");
  const [referenceBancaire, setReferenceBancaire] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const filteredStudents = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const canSubmit = !!selectedStudent && Number(montant) > 0 && motif.trim().length > 0;

  const handleSubmit = () => {
    if (!selectedStudent) return;
    if (!canSubmit) {
      toast.error("Sélectionnez un étudiant, un montant et un motif");
      return;
    }
    const record = deposerAvoir({
      etudiantId: selectedStudent.id,
      payeur: `${selectedStudent.matricule} - ${selectedStudent.prenom} ${selectedStudent.nom}`,
      montant: Number(montant),
      motif: motif.trim(),
      moyenOrigine: moyenOrigine.trim() || undefined,
      referenceBancaire: referenceBancaire.trim() || undefined,
      date,
      ajouteePar: currentUser?.name ?? "Administration",
    });
    // crediterAvoir() mute l'objet étudiant en place : selectedStudent.soldeAvoir reflète déjà le nouveau solde ici.
    toast.success(`Dépôt avoir ${record.reference} enregistré — nouveau solde : ${formatCFA(selectedStudent.soldeAvoir)}`);
    setLocation(`/admin/avoir/depots/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Dépôt avoir" }]}
        title="Nouveau dépôt avoir"
        subtitle="Crédite le solde d'avoir d'un étudiant, utilisable ensuite comme moyen de paiement"
        actions={
          <button onClick={() => setLocation("/admin/encaissements")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Annuler
          </button>
        }
      />

      <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Étudiant <span className="text-red-500">*</span>
          </label>
          {selectedStudent ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary bg-primary/5">
              <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="sm" />
              <div className="flex-1">
                <div className="font-medium text-foreground text-sm">{selectedStudent.prenom} {selectedStudent.nom}</div>
                <div className="text-xs text-muted-foreground font-mono">{selectedStudent.matricule}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Solde avoir actuel</div>
                <div className="text-sm font-semibold text-primary">{formatCFA(selectedStudent.soldeAvoir)}</div>
              </div>
              <button onClick={() => { setSelectedStudent(null); setSearchQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground underline ml-2">
                Changer
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  placeholder="Nom, prénom ou matricule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="depot-avoir-search"
                />
              </div>
              {filteredStudents.map((stu) => (
                <div
                  key={stu.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted cursor-pointer mt-2"
                  onClick={() => setSelectedStudent(stu)}
                  data-testid={`depot-avoir-option-${stu.id}`}
                >
                  <UserAvatar name={`${stu.prenom} ${stu.nom}`} size="sm" />
                  <div className="flex-1">
                    <div className="font-medium text-foreground text-sm">{stu.prenom} {stu.nom}</div>
                    <div className="text-xs text-muted-foreground font-mono">{stu.matricule}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">Avoir : {formatCFA(stu.soldeAvoir)}</div>
                </div>
              ))}
              {searchQuery.length > 1 && filteredStudents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun étudiant trouvé</p>
              )}
            </>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Montant à créditer (FCFA) <span className="text-red-500">*</span>
            </label>
            <input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} className={cn(inputClass, "font-mono")} data-testid="depot-avoir-montant" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Motif <span className="text-red-500">*</span>
          </label>
          <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={inputClass} placeholder="ex. trop-perçu conservé en avoir, cours annulé, etc." data-testid="depot-avoir-motif" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Origine du crédit (optionnel)</label>
            <input value={moyenOrigine} onChange={(e) => setMoyenOrigine(e.target.value)} className={inputClass} placeholder="ex. Virement, Espèce…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Référence</label>
            <input value={referenceBancaire} onChange={(e) => setReferenceBancaire(e.target.value)} className={cn(inputClass, "font-mono")} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => setLocation("/admin/encaissements")} className="flex-1 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="depot-avoir-submit"
          >
            <Send size={15} /> Créditer le compte
          </button>
        </div>
      </div>
    </div>
  );
}
