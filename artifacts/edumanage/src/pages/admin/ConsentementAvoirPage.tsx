import { useMemo, useState } from "react";
import { Search, FileText, Wallet, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useStudentStore, usePaiements } from "@/hooks/useStudentStore";
import { payerQuittance, debiterAvoir } from "@/data/studentStore";
import type { EtudiantRecord, PaiementRecord } from "@/data/studentStore";
import { enregistrerEncaissement } from "@/data/encaissementStore";
import { montantQuittance } from "@/pages/admin/PaiementsPage";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

export default function ConsentementAvoirPage() {
  const etudiants = useStudentStore();
  const paiements = usePaiements();
  const { currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const filteredStudents = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const pickStudent = (stu: EtudiantRecord) => {
    setSelectedStudent(stu);
    setSearchQuery("");
    setCheckedIds([]);
  };

  const facturesImpayees = useMemo(() => {
    if (!selectedStudent) return [];
    return paiements
      .filter((p) => p.etudiantId === selectedStudent.id && p.statut !== "annule" && p.montant < montantQuittance(p))
      .sort((a, b) => (a.dateLimite ?? a.date).localeCompare(b.dateLimite ?? b.date));
  }, [paiements, selectedStudent]);

  const soldeAvoir = selectedStudent?.soldeAvoir ?? 0;

  const allocation = useMemo(() => {
    let restant = soldeAvoir;
    const map = new Map<string, number>();
    for (const f of facturesImpayees) {
      if (!checkedIds.includes(f.id)) continue;
      const reste = montantQuittance(f) - f.montant;
      const applique = Math.min(restant, reste);
      if (applique > 0) map.set(f.id, applique);
      restant -= applique;
    }
    return map;
  }, [facturesImpayees, checkedIds, soldeAvoir]);

  const totalApplique = useMemo(() => Array.from(allocation.values()).reduce((s, v) => s + v, 0), [allocation]);

  const toggleFacture = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleToutes = () => {
    const allIds = facturesImpayees.map((f) => f.id);
    setCheckedIds((prev) => (allIds.every((id) => prev.includes(id)) ? [] : allIds));
  };

  const handleValider = () => {
    if (!selectedStudent || totalApplique <= 0) return;
    const encaissePar = currentUser?.name ?? "Administration";
    const date = new Date().toISOString().split("T")[0];
    let nbFactures = 0;

    try {
      for (const facture of facturesImpayees) {
        const montantEvent = allocation.get(facture.id) ?? 0;
        if (montantEvent <= 0) continue;

        const quittanceLignes: PaiementRecord["lignes"] =
          facture.lignes && facture.lignes.length > 0
            ? facture.lignes
            : [{ label: facture.rubrique, montant: facture.montant || montantQuittance(facture) }];
        const dejaPayeAvant = facture.montant;

        payerQuittance({ id: facture.id, montant: montantEvent, moyen: "AVOIR", reference: "", date });
        enregistrerEncaissement({
          quittanceId: facture.id,
          quittanceReference: facture.numeroRecu,
          quittanceDateEmission: facture.date,
          quittanceDateLimite: facture.dateLimite,
          montantQuittanceTotal: montantQuittance(facture),
          quittanceLignes: quittanceLignes ?? [],
          dejaPayeAvant,
          etudiantId: selectedStudent.id,
          payeur: `${selectedStudent.matricule} - ${selectedStudent.prenom} ${selectedStudent.nom}`,
          filiere: selectedStudent.filiere,
          annee: selectedStudent.annee,
          montant: montantEvent,
          moyen: "AVOIR",
          date,
          encaissePar,
        });
        debiterAvoir(selectedStudent.id, montantEvent);
        nbFactures++;
      }

      toast.success(`${nbFactures} facture(s) réglée(s) par avoir — total ${formatCFA(totalApplique)}`);
      setCheckedIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Règlement par avoir impossible");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Consentement avoir" }]}
        title="Règlement par avoir"
        subtitle="Applique le solde d'avoir d'un étudiant sur ses factures impayées"
      />

      <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="mb-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Étudiant <span className="text-red-500">*</span>
          </label>
          {selectedStudent ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary bg-primary/5 max-w-xl">
              <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="sm" />
              <div className="flex-1">
                <div className="font-medium text-foreground text-sm">{selectedStudent.matricule} - {selectedStudent.prenom} {selectedStudent.nom}</div>
                <div className="text-xs text-muted-foreground">{selectedStudent.telephone}</div>
              </div>
              <button onClick={() => { setSelectedStudent(null); setCheckedIds([]); }} className="text-xs text-muted-foreground hover:text-foreground underline ml-2">
                Changer
              </button>
            </div>
          ) : (
            <div className="max-w-xl">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  placeholder="Nom, prénom ou matricule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="consentement-search"
                />
              </div>
              {filteredStudents.map((stu) => (
                <div
                  key={stu.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted cursor-pointer mt-2"
                  onClick={() => pickStudent(stu)}
                  data-testid={`consentement-option-${stu.id}`}
                >
                  <UserAvatar name={`${stu.prenom} ${stu.nom}`} size="sm" />
                  <div className="flex-1">
                    <div className="font-medium text-foreground text-sm">{stu.matricule} - {stu.prenom} {stu.nom}</div>
                    <div className="text-xs text-muted-foreground">{stu.telephone}</div>
                  </div>
                </div>
              ))}
              {searchQuery.length > 1 && filteredStudents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Aucun étudiant trouvé</p>
              )}
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="grid md:grid-cols-[260px_1fr] gap-6">
            <div>
              <div className="flex flex-col items-center text-center p-4 border border-border rounded-xl">
                <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="lg" />
                <p className="text-xs text-muted-foreground font-mono mt-3">{selectedStudent.matricule}</p>
                <p className="font-semibold text-foreground text-sm mt-1">{selectedStudent.prenom} {selectedStudent.nom}</p>

                <p className="text-xs text-muted-foreground mt-4">Solde avoir disponible</p>
                <div
                  className={cn(
                    "w-full mt-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5",
                    soldeAvoir > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                  )}
                  data-testid="consentement-solde-avoir"
                >
                  <Wallet size={14} />
                  {soldeAvoir > 0 ? formatCFA(soldeAvoir) : "Pas d'avoir disponible"}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <FileText size={13} /> Factures impayées
              </h3>

              {facturesImpayees.length === 0 ? (
                <div className="px-4 py-3 rounded-xl bg-blue-50 text-blue-700 text-sm" data-testid="consentement-aucune-facture">
                  Aucune facture impayée pour cet étudiant
                </div>
              ) : soldeAvoir === 0 ? (
                <div className="px-4 py-3 rounded-xl bg-amber-50 text-amber-700 text-sm">
                  Cet étudiant a {facturesImpayees.length} facture(s) impayée(s) mais aucun avoir disponible pour les régler.
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
                    <button onClick={toggleToutes} className="text-xs text-primary hover:underline font-medium">
                      Tout {facturesImpayees.every((f) => checkedIds.includes(f.id)) ? "décocher" : "cocher"}
                    </button>
                    <span className="text-xs text-muted-foreground">Les plus anciennes d&apos;abord</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        <th className="w-8 px-3 py-2" />
                        <th className="text-left px-3 py-2">Quittance</th>
                        <th className="text-left px-3 py-2">Date limite</th>
                        <th className="text-right px-3 py-2">Reste à payer</th>
                        <th className="text-right px-3 py-2">Réglé par avoir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturesImpayees.map((f) => {
                        const checked = checkedIds.includes(f.id);
                        const reste = montantQuittance(f) - f.montant;
                        const applique = allocation.get(f.id) ?? 0;
                        return (
                          <tr key={f.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2.5">
                              <input type="checkbox" checked={checked} onChange={() => toggleFacture(f.id)} className="rounded" data-testid={`consentement-facture-${f.id}`} />
                            </td>
                            <td className="px-3 py-2.5 font-medium">{f.numeroRecu}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{f.dateLimite ? formatShortDate(f.dateLimite) : "—"}</td>
                            <td className="px-3 py-2.5 text-right">{formatCFA(reste)}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-primary">{checked && applique > 0 ? formatCFA(applique) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 bg-muted/20 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total appliqué : <strong className="text-foreground">{formatCFA(totalApplique)}</strong>
                    </span>
                    <button
                      onClick={handleValider}
                      disabled={totalApplique <= 0}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                      data-testid="consentement-valider"
                    >
                      <Send size={14} /> Valider le règlement
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
