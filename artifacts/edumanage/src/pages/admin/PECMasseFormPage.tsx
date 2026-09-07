import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Send, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore, usePaiements, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import { addPECMasse, findActivePECMasseForClasse, type PECMasseEtudiantPayload } from "@/data/pecMasseStore";
import type { TypePEC, PriseEnChargeLigne } from "@/data/priseEnChargeStore";
import { montantQuittance } from "@/pages/admin/PaiementsPage";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function PECMasseFormPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const classes = useClasses();
  const etudiants = useStudentStore();
  const paiements = usePaiements();
  const organismes = useOrganismesPEC();
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(() => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)), [anneesAcademiques]);
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0]?.libelle ?? "2025-2026";

  const [organismeId, setOrganismeId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState(defaultAnnee);
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [type, setType] = useState<TypePEC>("montant");
  const [montant, setMontant] = useState("");
  const [pourcentage, setPourcentage] = useState("");
  const [filtreFrais, setFiltreFrais] = useState("");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [debut, setDebut] = useState(todayPlus(0));
  const [fin, setFin] = useState(todayPlus(300));
  const [dateLimite, setDateLimite] = useState(todayPlus(120));

  const filteredNiveaux = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const filteredClasses = useMemo(() => {
    const niveau = NIVEAUX.find((n) => n.id === niveauId);
    if (!filiereId || !niveau) return [];
    return classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau.alias && c.annee === annee);
  }, [classes, filiereId, niveauId, annee]);

  const selectedClasse = filteredClasses.find((c) => c.id === classeId) ?? null;
  const classeStudents = selectedClasse
    ? etudiants.filter((e) => e.classeId === selectedClasse.id && e.statut !== "suspendu")
    : [];
  const includedStudents = classeStudents.filter((e) => !excludedIds.includes(e.id));

  const activeExisting = classeId && organismeId ? findActivePECMasseForClasse(classeId, annee, organismeId) : undefined;

  useEffect(() => {
    setExcludedIds([]);
  }, [classeId]);

  const handleFiliereChange = (id: string) => {
    setFiliereId(id);
    setNiveauId("");
    setClasseId("");
  };

  const handleNiveauChange = (id: string) => {
    setNiveauId(id);
    setClasseId("");
  };

  const handleAnneeChange = (v: string) => {
    setAnnee(v);
    setClasseId("");
  };

  const toggleExclude = (id: string) => {
    setExcludedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /** Frais Impayés (non entamés par un acompte) de chaque étudiant retenu, filtrés par le mot-clé optionnel. */
  const fraisParEtudiant = useMemo(() => {
    const map = new Map<string, { id: string; label: string; montantFrais: number }[]>();
    includedStudents.forEach((e) => {
      const frais = paiements
        .filter((p) => p.etudiantId === e.id && p.statut !== "annule" && p.montant === 0)
        .filter((p) => !filtreFrais.trim() || p.rubrique.toLowerCase().includes(filtreFrais.toLowerCase()))
        .map((p) => ({ id: p.id, label: p.rubrique, montantFrais: montantQuittance(p) }));
      map.set(e.id, frais);
    });
    return map;
  }, [includedStudents, paiements, filtreFrais]);

  /** Aperçu de l'allocation par étudiant : montant total (type montant, cascade sur ses frais) ou % (type pourcentage). */
  const allocationParEtudiant = useMemo(() => {
    const montantVal = Number(montant) || 0;
    const pctVal = Number(pourcentage) || 0;
    const result = new Map<string, PriseEnChargeLigne[]>();
    includedStudents.forEach((e) => {
      const frais = fraisParEtudiant.get(e.id) ?? [];
      if (type === "pourcentage") {
        result.set(
          e.id,
          frais.map((f) => ({ quittanceId: f.id, label: f.label, montantFrais: f.montantFrais, montantPEC: Math.round((f.montantFrais * pctVal) / 100) })),
        );
      } else {
        let remaining = montantVal;
        result.set(
          e.id,
          frais.map((f) => {
            const applied = Math.min(remaining, f.montantFrais);
            remaining -= applied;
            return { quittanceId: f.id, label: f.label, montantFrais: f.montantFrais, montantPEC: applied };
          }),
        );
      }
    });
    return result;
  }, [includedStudents, fraisParEtudiant, type, montant, pourcentage]);

  const nbEtudiantsCouverts = includedStudents.filter((e) => (allocationParEtudiant.get(e.id) ?? []).some((l) => l.montantPEC > 0)).length;
  const totalEstime = includedStudents.reduce((sum, e) => sum + (allocationParEtudiant.get(e.id) ?? []).reduce((s, l) => s + l.montantPEC, 0), 0);

  const handleSubmit = () => {
    if (!organismeId) {
      toast.error("Sélectionnez un organisme");
      return;
    }
    if (!filiereId || !niveauId || !classeId) {
      toast.error("Sélectionnez la filière, le niveau et la classe");
      return;
    }
    if (type === "montant" && (!Number(montant) || Number(montant) <= 0)) {
      toast.error("Indiquez un montant par étudiant valide");
      return;
    }
    if (type === "pourcentage" && (!Number(pourcentage) || Number(pourcentage) <= 0)) {
      toast.error("Indiquez un pourcentage valide");
      return;
    }
    if (!debut || !fin || !dateLimite) {
      toast.error("Renseignez la période et la date limite");
      return;
    }
    if (nbEtudiantsCouverts === 0) {
      toast.error("Aucun étudiant n'a de frais éligible pour ces critères");
      return;
    }

    const organisme = organismes.find((o) => o.id === organismeId);
    const filiere = FILIERES.find((f) => f.id === filiereId);
    const niveau = NIVEAUX.find((n) => n.id === niveauId);

    const etudiantsPayload: PECMasseEtudiantPayload[] = includedStudents.map((e) => ({
      etudiantId: e.id,
      etudiant: `${e.matricule} - ${e.prenom} ${e.nom}`,
      lignes: (allocationParEtudiant.get(e.id) ?? []).filter((l) => l.montantPEC > 0),
    }));

    const record = addPECMasse({
      organismeId,
      organisme: organisme?.intitule ?? "",
      type,
      montant: type === "montant" ? Number(montant) : undefined,
      pourcentage: type === "pourcentage" ? Number(pourcentage) : undefined,
      filiereId,
      filiere: filiere?.nom ?? "",
      annee,
      niveauId,
      niveau: niveau?.alias ?? "",
      classeId,
      classe: selectedClasse?.nom ?? "",
      debut,
      fin,
      dateLimite,
      filtreFrais: filtreFrais || undefined,
      ajouteePar: currentUser?.name ?? "Administration",
      etudiants: etudiantsPayload,
    });

    toast.success(`PEC en masse ${record.reference} générée pour ${record.priseEnChargeIds.length} étudiant(s)`);
    setLocation(`/admin/pec-masse/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "PEC en masse", href: "/admin/pec-masse" },
          { label: "Nouvelle PEC en masse" },
        ]}
        title="Nouvelle PEC en masse"
        subtitle="Génère une prise en charge (mêmes conditions) pour chaque étudiant retenu de la classe sélectionnée"
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Organisme <span className="text-red-500">*</span>
          </label>
          <select value={organismeId} onChange={(e) => setOrganismeId(e.target.value)} className={inputClass} data-testid="pecm-organisme">
            <option value="">Sélectionner…</option>
            {organismes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.intitule}
              </option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Filière <span className="text-red-500">*</span>
            </label>
            <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="pecm-filiere">
              <option value="">Sélectionner…</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Année <span className="text-red-500">*</span>
              </label>
              <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} className={inputClass} data-testid="pecm-annee">
                {anneeOptions.map((a) => (
                  <option key={a.id} value={a.libelle}>
                    {a.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Niveau <span className="text-red-500">*</span>
              </label>
              <select
                value={niveauId}
                onChange={(e) => handleNiveauChange(e.target.value)}
                className={inputClass}
                disabled={!filiereId}
                data-testid="pecm-niveau"
              >
                <option value="">Sélectionner…</option>
                {filteredNiveaux.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Classe <span className="text-red-500">*</span>
          </label>
          <select
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
            className={inputClass}
            disabled={!niveauId}
            data-testid="pecm-classe"
          >
            <option value="">Sélectionner…</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom} ({c.inscrits} inscrits)
              </option>
            ))}
          </select>
          {niveauId && filteredClasses.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">Aucune classe pour ce niveau sur l&apos;année {annee}.</p>
          )}
        </div>

        {activeExisting && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 text-amber-800 text-xs">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              Une PEC en masse active existe déjà pour cette classe/organisme sur {annee} : <strong>{activeExisting.reference}</strong> (
              {activeExisting.priseEnChargeIds.length} prise(s) en charge). Vérifiez avant de continuer.
            </span>
          </div>
        )}

        {selectedClasse && (
          <>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Type de PEC <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={type === "montant"} onChange={() => setType("montant")} className="accent-primary" />
                  Prise en charge par montant
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={type === "pourcentage"} onChange={() => setType("pourcentage")} className="accent-primary" />
                  PEC par pourcentage
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {type === "montant" ? "Montant par étudiant" : "Pourcentage(%)"} <span className="text-red-500">*</span>
                </label>
                {type === "montant" ? (
                  <input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} className={inputClass} data-testid="pecm-montant" />
                ) : (
                  <input type="number" min={0} max={100} value={pourcentage} onChange={(e) => setPourcentage(e.target.value)} className={inputClass} data-testid="pecm-pourcentage" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Frais concernés (optionnel)</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={filtreFrais}
                    onChange={(e) => setFiltreFrais(e.target.value)}
                    placeholder="ex. scolarité — vide = tous les frais impayés"
                    className={cn(inputClass, "pl-9")}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Étudiants de la classe ({includedStudents.length}/{classeStudents.length} retenu(s) — {nbEtudiantsCouverts} avec frais éligible)
              </label>
              <div className="border border-border rounded-xl max-h-64 overflow-y-auto divide-y divide-border">
                {classeStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">Aucun étudiant actif dans cette classe.</p>
                ) : (
                  classeStudents.map((e) => {
                    const excluded = excludedIds.includes(e.id);
                    const lignes = allocationParEtudiant.get(e.id) ?? [];
                    const montantEtu = lignes.reduce((s, l) => s + l.montantPEC, 0);
                    return (
                      <label key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={!excluded} onChange={() => toggleExclude(e.id)} className="rounded" />
                          <span className={cn(excluded && "text-muted-foreground line-through")}>
                            {e.prenom} {e.nom}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{e.matricule}</span>
                        </span>
                        {!excluded && (
                          <span className={cn("text-xs", montantEtu > 0 ? "text-primary font-medium" : "text-muted-foreground")}>
                            {lignes.length === 0 ? "Aucun frais éligible" : formatCFA(montantEtu)}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Total estimé pour ce lot : <strong className="text-foreground">{formatCFA(totalEstime)}</strong>
              </p>
            </div>
          </>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Début <span className="text-red-500">*</span>
            </label>
            <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Fin <span className="text-red-500">*</span>
            </label>
            <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date limite <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={() => setLocation("/admin/pec-masse")}
            className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="pecm-submit"
          >
            <Send size={15} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
