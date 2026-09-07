import { useMemo, useState } from "react";
import { Search, Trash2, Ban, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useStudentStore, useInscriptions, usePaiementsByEtudiant } from "@/hooks/useStudentStore";
import type { EtudiantRecord } from "@/data/studentStore";
import { useTypesFrais } from "@/hooks/useFinanceSettingsStore";
import { useFraisEtudiant } from "@/hooks/useFraisEtudiantStore";
import { supprimerFraisEtudiant, annulerFraisEtudiantQuittance, statutFraisEtudiant } from "@/data/fraisEtudiantStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function SupprimerFraisEtudiantPage() {
  const etudiants = useStudentStore();
  const typesFrais = useTypesFrais();
  const fraisEtudiant = useFraisEtudiant();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);
  const [selectedAnnee, setSelectedAnnee] = useState("");
  const [anneeModalOpen, setAnneeModalOpen] = useState(false);
  const [modalAnneeChoice, setModalAnneeChoice] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; mode: "supprimer" | "annuler"; label: string; montant: number } | null>(null);
  const [motif, setMotif] = useState("");

  const inscriptions = useInscriptions(selectedStudent?.id ?? "");
  const inscriptionAffichee = inscriptions.find((i) => i.annee === selectedAnnee);
  const paiements = usePaiementsByEtudiant(selectedStudent?.id ?? "");

  const filteredStudents = searchQuery.length > 1 && !selectedStudent
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.telephone.includes(searchQuery)
      ).slice(0, 6)
    : [];

  const pickStudent = (s: EtudiantRecord) => {
    setSelectedStudent(s);
    setSelectedAnnee(s.annee);
    setSearchQuery(`${s.matricule} - ${s.prenom.toUpperCase()} ${s.nom.toUpperCase()} (+${s.telephone})`);
  };

  const ouvrirAutresAnnees = () => {
    setModalAnneeChoice(selectedAnnee);
    setAnneeModalOpen(true);
  };

  const afficherFraisAutreAnnee = () => {
    if (!modalAnneeChoice) return;
    setSelectedAnnee(modalAnneeChoice);
    setAnneeModalOpen(false);
  };

  const typeFraisLabel = (id: string) => typesFrais.find((t) => t.id === id)?.intitule ?? "Frais";

  const lignes = useMemo(
    () => (selectedStudent ? fraisEtudiant.filter((l) => l.etudiantId === selectedStudent.id && l.annee === selectedAnnee) : []),
    [fraisEtudiant, selectedStudent, selectedAnnee],
  );

  const lignesAvecStatut = useMemo(
    () => lignes.map((l) => ({ ligne: l, statut: statutFraisEtudiant(l, paiements) })),
    [lignes, paiements],
  );

  const demanderSuppression = (id: string, mode: "supprimer" | "annuler", label: string, montant: number) => {
    setMotif("");
    setConfirmTarget({ id, mode, label, montant });
  };

  const confirmer = () => {
    if (!confirmTarget) return;
    if (!motif.trim()) {
      toast.error("Le motif est obligatoire");
      return;
    }
    if (confirmTarget.mode === "supprimer") {
      supprimerFraisEtudiant(confirmTarget.id, motif.trim());
      toast.success("Frais supprimé");
    } else {
      const result = annulerFraisEtudiantQuittance(confirmTarget.id, motif.trim());
      if (!result.ok) {
        toast.error(result.reason);
        setConfirmTarget(null);
        return;
      }
      toast.success("Frais annulé — le solde dû de l'étudiant a été restauré");
    }
    setConfirmTarget(null);
    setMotif("");
  };

  const STATUT_META: Record<ReturnType<typeof statutFraisEtudiant>, { label: string; cls: string }> = {
    en_attente: { label: "Non quittancé", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
    quittance: { label: "Quittancé", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
    annule: { label: "Annulé", cls: "bg-muted text-muted-foreground" },
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Mise à jour frais étudiant" }, { label: "Supprimer frais étudiant" }]}
        title="Supprimer frais étudiant"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="relative">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Étudiant</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value.trim()) setSelectedStudent(null); }}
              placeholder="Veuillez saisir le code, le prénom, le nom ou le numéro de téléphone de l'étudiant…"
              className={cn(inputClass, "pl-10")}
              data-testid="supprimer-frais-search"
            />
          </div>
          {searchQuery.length > 1 && !selectedStudent && filteredStudents.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickStudent(s)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
                  data-testid={`supprimer-frais-option-${s.id}`}
                >
                  <UserAvatar name={`${s.prenom} ${s.nom}`} size="sm" />
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">{s.matricule}</span> — {s.prenom} {s.nom} (+{s.telephone})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
            <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="sm" />
            <div className="flex-1">
              <div className="font-semibold text-foreground text-sm">{selectedStudent.matricule} - {selectedStudent.prenom.toUpperCase()} {selectedStudent.nom.toUpperCase()}</div>
              <div className="text-xs text-muted-foreground">Solde dû actuel : <span className="font-semibold text-foreground">{formatCFA(selectedStudent.soldeDu)}</span></div>
            </div>
            <button
              onClick={ouvrirAutresAnnees}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              data-testid="supprimer-frais-autres-annees"
            >
              Autres années <ChevronDown size={12} />
            </button>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {inscriptionAffichee ? `${inscriptionAffichee.filiere} | ${inscriptionAffichee.niveau} | ${inscriptionAffichee.annee}` : `${selectedStudent.filiere} | ${selectedStudent.niveau} | ${selectedAnnee}`}
            </div>
          </div>
        )}
      </div>

      <FormModal open={anneeModalOpen} onClose={() => setAnneeModalOpen(false)} title="Année scolaire" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire</label>
            <select
              value={modalAnneeChoice}
              onChange={(e) => setModalAnneeChoice(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="supprimer-frais-annee-select"
            >
              <option value="">Sélectionner</option>
              {[...inscriptions].sort((a, b) => b.annee.localeCompare(a.annee)).map((ins) => (
                <option key={ins.id} value={ins.annee}>{ins.annee}{ins.annee === selectedStudent?.annee ? " (en cours)" : ""}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={() => setAnneeModalOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          <button
            onClick={afficherFraisAutreAnnee}
            disabled={!modalAnneeChoice}
            className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="supprimer-frais-afficher-frais"
          >
            Afficher les frais
          </button>
        </div>
      </FormModal>

      {selectedStudent && (
        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="text-sm font-semibold text-foreground mb-3">Frais de l&apos;étudiant {selectedAnnee && `— ${selectedAnnee}`}</h3>
          {lignesAvecStatut.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="supprimer-frais-aucun">
              Aucun frais enregistré pour cet étudiant sur cette année
            </p>
          ) : (
            <div className="space-y-2">
              {lignesAvecStatut.map(({ ligne, statut }) => (
                <div key={ligne.id} className="flex items-center gap-4 p-3 bg-muted/30 rounded-xl border border-border" data-testid={`supprimer-frais-ligne-${ligne.id}`}>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{typeFraisLabel(ligne.typeFraisId)}</div>
                    <div className="text-xs text-muted-foreground">
                      {ligne.obligatoire ? "Obligatoire" : "Optionnel"} {ligne.echeance ? `· ${ligne.nbEcheances} échéance(s)` : ""} {ligne.dateLimite ? `· Limite ${formatShortDate(ligne.dateLimite)}` : ""}
                    </div>
                    {statut === "annule" && ligne.motifAnnulation && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">Motif : {ligne.motifAnnulation}</div>
                    )}
                  </div>
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", STATUT_META[statut].cls)}>{STATUT_META[statut].label}</span>
                  <div className="font-bold text-foreground w-28 text-right">{formatCFA(ligne.montant)}</div>
                  {statut === "en_attente" && (
                    <button
                      onClick={() => demanderSuppression(ligne.id, "supprimer", typeFraisLabel(ligne.typeFraisId), ligne.montant)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      data-testid={`supprimer-frais-action-supprimer-${ligne.id}`}
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  )}
                  {statut === "quittance" && (
                    <button
                      onClick={() => demanderSuppression(ligne.id, "annuler", typeFraisLabel(ligne.typeFraisId), ligne.montant)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                      data-testid={`supprimer-frais-action-annuler-${ligne.id}`}
                    >
                      <Ban size={12} /> Annuler
                    </button>
                  )}
                  {statut === "annule" && <div className="w-[92px]" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full space-y-4" style={{ boxShadow: "var(--shadow-lg)" }}>
            <h3 className="text-sm font-semibold text-foreground">
              {confirmTarget.mode === "supprimer" ? "Supprimer ce frais ?" : "Annuler ce frais ?"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {confirmTarget.label} — {formatCFA(confirmTarget.montant)}.{" "}
              {confirmTarget.mode === "supprimer"
                ? "Ce frais n'a pas encore été quittancé, la suppression est sans conséquence sur le solde de l'étudiant."
                : "Ce frais a déjà été quittancé : l'annulation restaurera le solde dû de l'étudiant du montant correspondant."}
            </p>
            <div>
              <label className="block text-xs font-medium text-red-500 mb-1.5">Motif *</label>
              <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={cn(inputClass, "resize-y")} data-testid="supprimer-frais-motif" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmTarget(null)} className="px-4 py-2 border border-border rounded-xl text-xs hover:bg-muted transition-colors">Annuler</button>
              <button onClick={confirmer} data-testid="supprimer-frais-confirmer" className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700 transition-colors">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
