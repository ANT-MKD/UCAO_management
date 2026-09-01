import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Search, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useStudentStore, useUserAccounts } from "@/hooks/useStudentStore";
import type { EtudiantRecord } from "@/data/studentStore";
import { useReductionsAutorisees } from "@/hooks/useFinanceSettingsStore";
import { genererReductionFrais, totalReduitParPersonnelSurPeriode } from "@/data/reductionFraisStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

export default function ReductionFraisFormPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const personnel = useUserAccounts().filter((u) => u.role !== "student");
  const autorisations = useReductionsAutorisees();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);
  const [personnelId, setPersonnelId] = useState(() => currentUser?.id ?? "");
  const [tauxApplique, setTauxApplique] = useState("");
  const [dateOperation] = useState(new Date().toISOString().slice(0, 10));

  const filteredStudents = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const autorisationActive = useMemo(() => {
    if (!personnelId) return undefined;
    const today = new Date().toISOString().slice(0, 10);
    return autorisations.find((a) => a.personnelId === personnelId && today >= a.dateDebut && today <= a.dateFin);
  }, [autorisations, personnelId]);

  const plafondRestant = useMemo(() => {
    if (!autorisationActive) return 0;
    const dejaUtilise = totalReduitParPersonnelSurPeriode(personnelId, autorisationActive.dateDebut, autorisationActive.dateFin);
    return Math.max(0, autorisationActive.montantPlafond - dejaUtilise);
  }, [autorisationActive, personnelId]);

  const taux = Number(tauxApplique) || 0;
  const totalReduit = selectedStudent ? Math.round((selectedStudent.soldeDu * taux) / 100) : 0;

  const tauxDepasse = autorisationActive ? taux > autorisationActive.tauxMax : false;
  const plafondDepasse = autorisationActive ? totalReduit > plafondRestant : false;

  const peutSoumettre =
    !!selectedStudent &&
    !!autorisationActive &&
    taux > 0 &&
    totalReduit > 0 &&
    totalReduit <= selectedStudent.soldeDu &&
    !tauxDepasse &&
    !plafondDepasse;

  const handleSubmit = () => {
    if (!selectedStudent || !autorisationActive) return;
    const record = genererReductionFrais({
      date: dateOperation,
      etudiantId: selectedStudent.id,
      personnelId,
      tauxApplique: taux,
      totalReduit,
    });
    toast.success(`Réduction ${record.reference} enregistrée — ${formatCFA(totalReduit)}`);
    setLocation(`/admin/reductions-frais/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Réduction" }, { label: "Réductions" }, { label: "Nouvelle réduction" }]}
        title="Nouvelle réduction"
        subtitle="Accorder une réduction sur le solde dû d'un étudiant"
        actions={
          <button onClick={() => setLocation("/admin/reductions-frais")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
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
                  data-testid="reduction-frais-search-student"
                />
              </div>
              {filteredStudents.map((stu) => (
                <div
                  key={stu.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted cursor-pointer transition-all"
                  onClick={() => setSelectedStudent(stu)}
                  data-testid={`reduction-frais-student-option-${stu.id}`}
                >
                  <UserAvatar name={`${stu.prenom} ${stu.nom}`} size="sm" />
                  <div className="flex-1">
                    <div className="font-medium text-foreground text-sm">{stu.prenom} {stu.nom}</div>
                    <div className="text-xs text-muted-foreground font-mono">{stu.matricule}</div>
                  </div>
                  {stu.soldeDu > 0 && <div className="text-xs text-red-500">Doit {formatCFA(stu.soldeDu)}</div>}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Émise par</p>
          <select
            value={personnelId}
            onChange={(e) => setPersonnelId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="reduction-frais-personnel"
          >
            <option value="">Sélectionner</option>
            {personnel.map((p) => (
              <option key={p.id} value={p.id}>{p.identifier} - {p.displayName}</option>
            ))}
          </select>

          {personnelId && !autorisationActive && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-xs">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              Cette personne n'a aucune autorisation de réduction active aujourd'hui.
            </div>
          )}
          {autorisationActive && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs">
              <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
              Taux max autorisé : <strong>{autorisationActive.tauxMax}%</strong> · Plafond restant : <strong>{formatCFA(plafondRestant)}</strong>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Taux de réduction</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={tauxApplique}
              onChange={(e) => setTauxApplique(e.target.value)}
              className={cn("w-full px-3 py-2.5 text-sm border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30", tauxDepasse ? "border-red-400" : "border-border")}
              data-testid="reduction-frais-taux"
            />
            <span className="px-3 py-2.5 text-sm bg-muted rounded-xl text-muted-foreground">%</span>
          </div>
          {tauxDepasse && <p className="text-xs text-red-600">Dépasse le taux maximum autorisé ({autorisationActive?.tauxMax}%).</p>}

          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
            <span className="text-xs text-muted-foreground">Total réduit</span>
            <span className="text-sm font-bold text-foreground">{formatCFA(totalReduit)}</span>
          </div>
          {plafondDepasse && <p className="text-xs text-red-600">Dépasse le plafond restant de cette personne ({formatCFA(plafondRestant)}).</p>}
          {selectedStudent && totalReduit > selectedStudent.soldeDu && (
            <p className="text-xs text-red-600">Le montant réduit ne peut pas dépasser le solde dû de l'étudiant.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!peutSoumettre}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="reduction-frais-soumettre"
          >
            Enregistrer la réduction
          </button>
          <button onClick={() => setLocation("/admin/reductions-frais")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
        </div>
      </div>
    </div>
  );
}
