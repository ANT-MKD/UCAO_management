import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Bell, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { useStudentStore, usePaiements, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { envoyerRappelPaiement, trouverRappelIdentique } from "@/data/rappelPaiementStore";
import { useRappelsPaiement } from "@/hooks/useRappelPaiementStore";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function montantFacture(p: { montant: number; lignes?: { montant: number }[] }): number {
  return p.lignes && p.lignes.length > 0 ? p.lignes.reduce((s, l) => s + l.montant, 0) : p.montant;
}

export default function NouveauRappelPaiementPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const paiements = usePaiements();
  useRappelsPaiement(); // s'abonne pour que la vérification de doublon reste à jour
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(() => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)), [anneesAcademiques]);
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0]?.libelle ?? "2025-2026";

  const [step, setStep] = useState<1 | 2>(1);
  const [filiereId, setFiliereId] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [annee, setAnnee] = useState(defaultAnnee);
  const [fraisEchusAvant, setFraisEchusAvant] = useState(new Date().toISOString().slice(0, 10));
  const [nouvelleEcheance, setNouvelleEcheance] = useState("");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const filteredNiveaux = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const filiere = FILIERES.find((f) => f.id === filiereId);

  const cohorteEtudiantIds = useMemo(() => {
    if (!filiereId) return new Set<string>();
    return new Set(
      etudiants
        .filter((e) => e.filiereId === filiereId && e.annee === annee && (!niveau || e.niveau === niveau.alias))
        .map((e) => e.id),
    );
  }, [etudiants, filiereId, annee, niveau]);

  const quittancesEnRetard = useMemo(() => {
    if (step !== 2 || cohorteEtudiantIds.size === 0) return [];
    return paiements.filter((p) => {
      if (p.statut === "annule") return false;
      if (!cohorteEtudiantIds.has(p.etudiantId)) return false;
      if (montantFacture(p) <= p.montant) return false; // soldée
      if (!p.dateLimite || p.dateLimite >= fraisEchusAvant) return false; // pas encore échue avant le seuil
      return true;
    });
  }, [paiements, cohorteEtudiantIds, fraisEchusAvant, step]);

  const quittancesRetenues = useMemo(() => quittancesEnRetard.filter((p) => !excludedIds.includes(p.id)), [quittancesEnRetard, excludedIds]);
  const nbEtudiantsConcernes = new Set(quittancesRetenues.map((p) => p.etudiantId)).size;

  useEffect(() => {
    setExcludedIds([]);
  }, [filiereId, niveauId, annee, fraisEchusAvant]);

  const rappelIdentique = filiereId ? trouverRappelIdentique(filiereId, niveau?.alias, annee, fraisEchusAvant) : undefined;

  const toggleExclude = (id: string) => {
    setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSuivant = () => {
    if (!filiereId || !annee || !fraisEchusAvant) {
      toast.error("Sélectionnez le programme, l'année académique et la date d'échéance");
      return;
    }
    setStep(2);
  };

  const handleEnvoyer = () => {
    if (quittancesRetenues.length === 0) {
      toast.error("Aucune quittance retenue pour l'envoi");
      return;
    }
    setSending(true);
    try {
      const record = envoyerRappelPaiement({
        filiereId,
        filiereLabel: filiere?.nom ?? "",
        niveau: niveau?.alias,
        niveauLabel: niveau?.nom,
        annee,
        fraisEchusAvant,
        nouvelleEcheance: nouvelleEcheance || undefined,
        quittanceIds: quittancesRetenues.map((p) => p.id),
        nbEtudiants: nbEtudiantsConcernes,
      });
      toast.success(`${record.nbNotificationsEnvoyees} rappel(s) envoyé(s)` + (nouvelleEcheance ? ` — nouvelle échéance appliquée` : ""));
      setLocation("/admin/rappel-paiement");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Rappel paiement", href: "/admin/rappel-paiement" }, { label: "Nouveau rappel paiement" }]}
        title="Rappel paiement"
        actions={
          <button onClick={() => setLocation("/admin/rappel-paiement")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      {step === 1 && (
        <div className="bg-card border border-border rounded-xl p-6 max-w-2xl space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme *</label>
            <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); }} className={inputClass} data-testid="rappel-filiere">
              <option value="">Sélectionner</option>
              {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau</label>
              <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} className={inputClass} disabled={!filiereId} data-testid="rappel-niveau">
                <option value="">Tous les niveaux</option>
                {filteredNiveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année Académique *</label>
              <select value={annee} onChange={(e) => setAnnee(e.target.value)} className={inputClass} data-testid="rappel-annee">
                {anneeOptions.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Frais échus avant *</label>
            <input type="date" value={fraisEchusAvant} onChange={(e) => setFraisEchusAvant(e.target.value)} className={inputClass} data-testid="rappel-frais-echus-avant" />
          </div>
          <div className="flex gap-3 pt-4 border-t border-border">
            <button onClick={handleSuivant} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="rappel-suivant">
              Suivant
            </button>
            <button onClick={() => setLocation("/admin/rappel-paiement")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          {rappelIdentique && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              Un rappel identique (même programme, niveau, année et échéance) a déjà été envoyé le {formatShortDate(rappelIdentique.date)} ({rappelIdentique.reference}) — vérifiez que ce n'est pas un doublon avant de continuer.
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {filiere?.nom}{niveau ? ` — ${niveau.nom}` : ""} ({annee}) — frais échus avant {formatShortDate(fraisEchusAvant)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{quittancesRetenues.length}/{quittancesEnRetard.length} quittance(s) retenue(s) · {nbEtudiantsConcernes} étudiant(s)</p>
              </div>
            </div>

            {quittancesEnRetard.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Aucune quittance en retard pour cette sélection.</p>
            ) : (
              <div className="overflow-x-auto border border-border rounded-xl mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="w-10 px-3 py-2" />
                      <th className="text-left px-3 py-2">Étudiant</th>
                      <th className="text-left px-3 py-2">Quittance</th>
                      <th className="text-right px-3 py-2">Reste dû</th>
                      <th className="text-left px-3 py-2">Échéance actuelle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quittancesEnRetard.map((p) => {
                      const excluded = excludedIds.includes(p.id);
                      return (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={!excluded} onChange={() => toggleExclude(p.id)} className="rounded" data-testid={`rappel-inclure-${p.id}`} />
                          </td>
                          <td className={cn("px-3 py-2", excluded && "text-muted-foreground line-through")}>{p.etudiant}</td>
                          <td className={cn("px-3 py-2 font-mono text-xs", excluded && "text-muted-foreground line-through")}>{p.numeroRecu}</td>
                          <td className={cn("px-3 py-2 text-right font-semibold", excluded && "text-muted-foreground line-through")}>{formatCFA(montantFacture(p) - p.montant)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.dateLimite ? formatShortDate(p.dateLimite) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="max-w-sm">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nouvelle échéance (optionnel)</label>
              <input type="date" value={nouvelleEcheance} onChange={(e) => setNouvelleEcheance(e.target.value)} className={inputClass} data-testid="rappel-nouvelle-echeance" />
              <p className="text-[10px] text-muted-foreground mt-1">Si renseignée, s'applique à toutes les quittances ci-dessus en plus de l'envoi du rappel.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleEnvoyer}
              disabled={sending || quittancesRetenues.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="rappel-envoyer"
            >
              <Bell size={14} /> {sending ? "Envoi…" : "Envoyer les rappels"}
            </button>
            <button onClick={() => setStep(1)} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Retour</button>
          </div>
        </div>
      )}
    </div>
  );
}
