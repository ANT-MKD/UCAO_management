import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { useModelesFrais } from "@/hooks/useFinanceSettingsStore";
import { useGrillesFrais } from "@/hooks/useGrilleFraisStore";
import { getGrilleFrais, getModelesFraisDisponibles } from "@/data/grilleFraisStore";
import { genererDevis, type DevisLigne } from "@/data/devisStore";
import { niveauLabel } from "@/lib/teacherCourseUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useAnneesAcademiques } from "@/hooks/useStudentStore";
import { formatCFA, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function ligneDescription(intitule: string, montant: number, modalite: string, nbEcheances: number | undefined, dateLimite: string | undefined, modeleLabel: string): string {
  if (modalite === "echeances" && nbEcheances) {
    const parEcheance = Math.round(montant / nbEcheances);
    const dateTxt = dateLimite ? ` au plus tard le ${dateLimite}` : "";
    return `${intitule} - ${formatCFA(montant)} payable en ${nbEcheances} échéances de ${formatCFA(parEcheance)}${dateTxt} pour le modèle de frais ${modeleLabel}`;
  }
  return `${intitule} - ${formatCFA(montant)} pour le modèle de frais ${modeleLabel} avant inscription`;
}

export default function DevisFormPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const modelesFrais = useModelesFrais();
  useGrillesFrais(); // s'abonne pour recalculer si la grille change
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0] ?? "2025-2026";

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState(defaultAnnee);
  const [niveau, setNiveau] = useState("");
  const [modeleFraisId, setModeleFraisId] = useState("");
  const [beneficiaire, setBeneficiaire] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [adresse, setAdresse] = useState("");

  const niveauxDisponibles = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const filiere = FILIERES.find((f) => f.id === filiereId);

  const modelesDisponibles = useMemo(() => {
    if (!filiereId || !niveau || !annee) return [];
    const ids = new Set(getModelesFraisDisponibles(filiereId, niveau, annee));
    return modelesFrais.filter((m) => ids.has(m.id));
  }, [filiereId, niveau, annee, modelesFrais]);

  const grille = filiereId && niveau && annee && modeleFraisId ? getGrilleFrais(filiereId, niveau, annee, modeleFraisId) : undefined;
  const modeleLabel = modelesFrais.find((m) => m.id === modeleFraisId)?.intitule ?? "";

  const lignes: DevisLigne[] = useMemo(() => {
    if (!grille) return [];
    return grille.lignes.map((l) => ({
      intitule: l.intitule,
      montantHT: l.montant,
      modalite: l.modalite,
      nbEcheances: l.nbEcheances,
      dateLimite: l.dateLimite,
      montantTTC: Math.round(l.montant * (1 + grille.tauxTaxe / 100)),
    }));
  }, [grille]);

  const totalHT = lignes.reduce((s, l) => s + l.montantHT, 0);
  const totalTTC = lignes.reduce((s, l) => s + l.montantTTC, 0);
  const totalTaxe = totalTTC - totalHT;

  const canSubmit = !!grille && lignes.length > 0 && beneficiaire.trim().length > 0 && telephone.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit || !grille || !filiere) return;
    const record = genererDevis({
      filiereId,
      filiereLabel: `${filiere.nom} — ${filiere.code}`,
      niveau,
      niveauLabel: niveauLabel(niveau),
      annee,
      modeleFraisId,
      modeleFraisLabel: modeleLabel,
      beneficiaire: beneficiaire.trim(),
      telephone: telephone.trim(),
      email: email.trim() || undefined,
      adresse: adresse.trim() || undefined,
      tauxTaxe: grille.tauxTaxe,
      lignes,
      date: new Date().toISOString().slice(0, 10),
      ajouteePar: currentUser?.name ?? "Administration",
    });
    toast.success(`Devis ${record.reference} créé — ${formatCFA(record.totalTTC)}`);
    setLocation(`/admin/devis/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les devis", href: "/admin/devis" }, { label: "Nouveau devis" }]}
        title="Nouveau devis"
        subtitle="Document informatif — ne crée aucune dette ni quittance pour un étudiant"
      />

      <div className="max-w-3xl mx-auto bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Filière <span className="text-red-500">*</span>
          </label>
          <select
            value={filiereId}
            onChange={(e) => { setFiliereId(e.target.value); setNiveau(""); setModeleFraisId(""); }}
            className={inputClass}
            data-testid="devis-filiere"
          >
            <option value="">— Sélectionner —</option>
            {FILIERES.map((f) => (
              <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Choix année scolaire <span className="text-red-500">*</span>
            </label>
            <select value={annee} onChange={(e) => { setAnnee(e.target.value); setModeleFraisId(""); }} className={inputClass} data-testid="devis-annee">
              {anneeOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Niveau <span className="text-red-500">*</span>
            </label>
            <select
              value={niveau}
              onChange={(e) => { setNiveau(e.target.value); setModeleFraisId(""); }}
              className={inputClass}
              disabled={!filiereId}
              data-testid="devis-niveau"
            >
              <option value="">— Sélectionner —</option>
              {niveauxDisponibles.map((n) => (
                <option key={n.id} value={n.alias}>{n.nom}</option>
              ))}
            </select>
          </div>
        </div>

        {filiereId && niveau && annee && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Modèle de frais</label>
            <select value={modeleFraisId} onChange={(e) => setModeleFraisId(e.target.value)} className={inputClass} data-testid="devis-modele-frais">
              <option value="">— Sélectionner —</option>
              {modelesDisponibles.map((m) => (
                <option key={m.id} value={m.id}>{m.intitule}</option>
              ))}
            </select>
            {modelesDisponibles.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                Aucune grille tarifaire configurée pour cette combinaison —{" "}
                <button type="button" onClick={() => setLocation("/admin/grille-frais")} className="underline hover:text-amber-700">
                  configurez-la ici
                </button>.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Bénéficiaire <span className="text-red-500">*</span>
          </label>
          <input value={beneficiaire} onChange={(e) => setBeneficiaire(e.target.value)} className={inputClass} placeholder="Nom du bénéficiaire" data-testid="devis-beneficiaire" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Téléphone <span className="text-red-500">*</span>
            </label>
            <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputClass} placeholder="+221 7XX XX XX XX" data-testid="devis-telephone" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} data-testid="devis-email" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Adresse</label>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={inputClass} data-testid="devis-adresse" />
        </div>

        {grille && lignes.length > 0 && (
          <>
            <div className="bg-slate-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
              Taxe appliquée : {grille.tauxTaxe}%
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Intitulé</th>
                    <th className="text-right px-4 py-3">Montant TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        {ligneDescription(l.intitule, l.montantHT, l.modalite, l.nbEcheances, l.dateLimite, modeleLabel)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatCFA(l.montantTTC)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors",
                )}
                data-testid="devis-creer"
              >
                <FileCheck2 size={15} /> Créer le devis
              </button>
              <div className="text-right text-sm space-y-0.5">
                <p className="text-muted-foreground">Total hors taxe : <span className="font-semibold text-foreground">{formatCFA(totalHT)}</span></p>
                <p className="text-muted-foreground">Total taxe : <span className="font-semibold text-foreground">{formatCFA(totalTaxe)}</span></p>
                <p className="font-bold text-primary text-base">Grand Total : {formatCFA(totalTTC)}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
