import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import {
  ArrowLeft, ArrowRight, Check, Search, AlertTriangle, ClipboardCheck,
  CreditCard, GraduationCap,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { CLASSES, FILIERES, NIVEAUX, MOYENNES_PROMO } from "@/data/mockData";
import { useFraisConfigs } from "@/hooks/useFraisConfigStore";
import {
  STATUTS_INSCRIPTION, MODES_PAIEMENT, STATUTS_PAIEMENT, MODES_SCOLARITE,
} from "@/lib/inscriptionConstants";
import {
  getEtudiantByMatricule,
  registerReinscription,
  checkReinscriptionEligibility,
  type EtudiantRecord,
} from "@/data/studentStore";
import { useAnneeActuelle } from "@/hooks/useStudentStore";
import { useDerogationsPaiement } from "@/hooks/useDerogationPaiementStore";
import { derogationActivePour } from "@/data/derogationPaiementStore";
import { cn, formatCFA, formatShortDate } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Recherche", icon: Search },
  { id: 2, label: "Vérifications", icon: AlertTriangle },
  { id: 3, label: "Inscription N+1", icon: ClipboardCheck },
  { id: 4, label: "Paiement", icon: CreditCard },
  { id: 5, label: "Confirmation", icon: Check },
];

interface Step3Data {
  filiereId: string;
  niveauId: string;
  classeId: string;
  statut: string;
}

interface Step4Data {
  modeScolarite: string;
  montant: number;
  moyenPaiement: string;
  statutPaiement: string;
  reference?: string;
}

export default function ReinscriptionPage() {
  const [, setLocation] = useLocation();
  const anneeActuelle = useAnneeActuelle();
  const FRAIS_CONFIG = useFraisConfigs();
  const [currentStep, setCurrentStep] = useState(1);
  const [searchMatricule, setSearchMatricule] = useState("");
  const [student, setStudent] = useState<EtudiantRecord | null>(null);
  const [searchError, setSearchError] = useState("");
  const [step3Data, setStep3Data] = useState<Step3Data | null>(null);
  const [step4Data, setStep4Data] = useState<Step4Data | null>(null);

  const form3 = useForm<Step3Data>({
    defaultValues: { filiereId: "", niveauId: "", classeId: "", statut: "actif" },
  });
  const form4 = useForm<Step4Data>({
    defaultValues: {
      modeScolarite: "mensualite",
      montant: 0,
      moyenPaiement: "Wave",
      statutPaiement: "paye",
      reference: "",
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("matricule");
    if (m) {
      setSearchMatricule(m);
      const found = getEtudiantByMatricule(m);
      if (found) {
        setStudent(found);
        form3.setValue("filiereId", found.filiereId);
        const niveau = NIVEAUX.find((n) => n.alias === found.niveau && n.filiereId === found.filiereId);
        if (niveau) form3.setValue("niveauId", niveau.id);
      }
    }
  }, [form3]);

  const selectedFiliere = form3.watch("filiereId");
  const selectedNiveau = form3.watch("niveauId");

  const niveauxFiliere = useMemo(
    () => NIVEAUX.filter((n) => n.filiereId === selectedFiliere),
    [selectedFiliere],
  );

  const classesDispo = useMemo(() => {
    const niveau = NIVEAUX.find((n) => n.id === selectedNiveau);
    if (!niveau) return [];
    return CLASSES.filter(
      (c) => c.filiereId === selectedFiliere && c.niveau === niveau.alias && c.annee === anneeActuelle,
    );
  }, [selectedFiliere, selectedNiveau, anneeActuelle]);

  const fraisRef = useMemo(() => {
    const niveau = NIVEAUX.find((n) => n.id === selectedNiveau);
    const filiere = FILIERES.find((f) => f.id === selectedFiliere);
    if (!niveau || !filiere) return null;
    return FRAIS_CONFIG.find(
      (f) => f.filiereId === selectedFiliere && f.niveau === niveau.alias && f.annee === anneeActuelle,
    );
  }, [selectedFiliere, selectedNiveau, anneeActuelle, FRAIS_CONFIG]);

  const montantSuggere = useMemo(() => {
    if (!fraisRef) return 0;
    return form4.watch("modeScolarite") === "annuelle"
      ? fraisRef.scolariteAnnuelle
      : Math.round(fraisRef.scolariteAnnuelle / 10);
  }, [fraisRef, form4.watch("modeScolarite")]);

  const deliberation = student
    ? MOYENNES_PROMO.find((m) => m.etudiantId === student.id)
    : undefined;
  const eligibility = student ? checkReinscriptionEligibility(student.id) : null;
  const derogations = useDerogationsPaiement();
  const derogationActive = student ? derogationActivePour(derogations, student.id, "reinscription") : undefined;

  const handleSearch = () => {
    setSearchError("");
    const found = getEtudiantByMatricule(searchMatricule);
    if (!found) {
      setSearchError("Aucun étudiant trouvé pour ce matricule.");
      setStudent(null);
      return;
    }
    setStudent(found);
    form3.setValue("filiereId", found.filiereId);
    const niveau = NIVEAUX.find((n) => n.alias === found.niveau && n.filiereId === found.filiereId);
    if (niveau) form3.setValue("niveauId", niveau.id);
    setCurrentStep(2);
  };

  const handleStep3 = form3.handleSubmit((data) => {
    setStep3Data(data);
    if (fraisRef) {
      form4.setValue("montant", Math.round(fraisRef.scolariteAnnuelle / 10));
    }
    setCurrentStep(4);
  });

  const handleStep4 = form4.handleSubmit((data) => {
    setStep4Data(data);
    setCurrentStep(5);
  });

  const handleConfirm = () => {
    if (!student || !step3Data || !step4Data) return;
    const niveau = NIVEAUX.find((n) => n.id === step3Data.niveauId);
    const soldeDu =
      step4Data.statutPaiement === "paye"
        ? 0
        : step4Data.statutPaiement === "partiel"
          ? Math.max(0, montantSuggere - step4Data.montant)
          : montantSuggere;

    registerReinscription({
      etudiantId: student.id,
      annee: anneeActuelle,
      filiereId: step3Data.filiereId,
      classeId: step3Data.classeId,
      niveau: niveau?.alias ?? student.niveau,
      statut: step3Data.statut,
      soldeDu,
    });
    setLocation(`/admin/students/${student.id}`);
  };

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Étudiants", href: "/admin/students" },
          { label: "Réinscription" },
        ]}
        title="Réinscription d'un étudiant"
        subtitle="Parcours court : recherche par matricule, vérifications et paiement scolarité uniquement"
        actions={
          <button
            onClick={() => setLocation("/admin/students")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  currentStep === step.id
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : currentStep > step.id
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {currentStep > step.id ? <Check size={16} /> : step.id}
              </div>
              <span className="text-[10px] mt-1 text-muted-foreground hidden sm:block">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("w-8 sm:w-16 h-0.5 mx-1", currentStep > step.id ? "bg-emerald-500" : "bg-muted")} />
            )}
          </div>
        ))}
      </div>

      {currentStep === 1 && (
        <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
            <Search size={18} className="text-primary" /> Rechercher l'étudiant
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Saisissez le matricule permanent — l'état civil n'est pas redemandé.
          </p>
          <input
            value={searchMatricule}
            onChange={(e) => setSearchMatricule(e.target.value.toUpperCase())}
            placeholder="Ex: 2025-LPIG-0001"
            className={cn(inputClass, "font-mono mb-2")}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          {searchError && <p className="text-xs text-red-500 mb-3">{searchError}</p>}
          <button
            onClick={handleSearch}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            Rechercher <ArrowRight size={15} />
          </button>
        </div>
      )}

      {currentStep === 2 && student && (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
            <UserAvatar name={`${student.prenom} ${student.nom}`} size="lg" />
            <div>
              <h3 className="font-bold text-lg">{student.prenom} {student.nom}</h3>
              <p className="font-mono text-sm text-muted-foreground">{student.matricule}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {student.filiere} · {student.niveau} · {student.annee}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className={cn(
              "rounded-xl border p-4",
              student.soldeDu > 0 && derogationActive ? "border-blue-300 bg-blue-50" : student.soldeDu > 0 ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50",
            )}>
              <p className="text-xs font-medium text-muted-foreground mb-1">Situation financière</p>
              {student.soldeDu > 0 && derogationActive ? (
                <p className="text-sm text-blue-800 flex items-center gap-1">
                  <AlertTriangle size={14} /> Impayés : {formatCFA(student.soldeDu)} — dérogation {derogationActive.reference} active jusqu'au {formatShortDate(derogationActive.dateFin)}
                </p>
              ) : student.soldeDu > 0 ? (
                <p className="text-sm text-amber-800 flex items-center gap-1">
                  <AlertTriangle size={14} /> Impayés : {formatCFA(student.soldeDu)}
                </p>
              ) : (
                <p className="text-sm text-emerald-700">Aucun impayé sur l'année en cours</p>
              )}
            </div>
            <div className="rounded-xl border border-border p-4 bg-card">
              <p className="text-xs font-medium text-muted-foreground mb-1">Délibération (mock)</p>
              {deliberation ? (
                <p className="text-sm">
                  Statut : <StatusBadge status={deliberation.statut === "Admis" ? "actif" : "suspendu"} />
                  {" · "}Moyenne : {deliberation.moyenneGenerale.toFixed(2)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Pas encore de délibération enregistrée</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setCurrentStep(1)} className="flex-1 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">
              Retour
            </button>
            <button
              onClick={() => setCurrentStep(3)}
              disabled={eligibility?.decision === "blocked"}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              Continuer <ArrowRight size={15} />
            </button>
          </div>
          {eligibility && (
            <div className={cn(
              "rounded-xl p-3 text-xs",
              eligibility.decision === "allowed" && "bg-emerald-50 text-emerald-700",
              eligibility.decision === "conditional" && "bg-amber-50 text-amber-800",
              eligibility.decision === "blocked" && "bg-red-50 text-red-700",
            )}>
              <p className="font-semibold mb-1">Décision: {eligibility.decision}</p>
              <ul className="list-disc ml-4">
                {eligibility.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {currentStep === 3 && student && (
        <form onSubmit={handleStep3} className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <GraduationCap size={18} className="text-primary" /> Inscription académique {anneeActuelle}
          </h3>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
            <select {...form3.register("filiereId", { required: true })} className={inputClass}>
              <option value="">— Choisir —</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => (
                <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau</label>
            <select {...form3.register("niveauId", { required: true })} className={inputClass}>
              <option value="">— Choisir —</option>
              {niveauxFiliere.map((n) => (
                <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe</label>
            <select {...form3.register("classeId", { required: true })} className={inputClass}>
              <option value="">— Choisir —</option>
              {classesDispo.map((c) => (
                <option key={c.id} value={c.id}>{c.nom} ({c.inscrits}/{c.max})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut inscription</label>
            <select {...form3.register("statut", { required: true })} className={inputClass}>
              {STATUTS_INSCRIPTION.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCurrentStep(2)} className="flex-1 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">
              Retour
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Paiement scolarité
            </button>
          </div>
        </form>
      )}

      {currentStep === 4 && student && (
        <form onSubmit={handleStep4} className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <CreditCard size={18} className="text-primary" /> Paiement scolarité uniquement
          </h3>
          <p className="text-xs text-muted-foreground">
            Les frais d'inscription unique ne sont pas refacturés (déjà payés :{" "}
            {student.inscriptionUniquePayee ? "oui" : "non"}).
          </p>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mode scolarité</label>
            <select {...form4.register("modeScolarite")} className={inputClass}>
              {MODES_SCOLARITE.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {fraisRef && (
            <p className="text-sm text-muted-foreground">
              Montant suggéré : <strong>{formatCFA(montantSuggere)}</strong>
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant versé</label>
            <input type="number" {...form4.register("montant", { valueAsNumber: true })} className={inputClass} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyen</label>
              <select {...form4.register("moyenPaiement")} className={inputClass}>
                {MODES_PAIEMENT.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut</label>
              <select {...form4.register("statutPaiement")} className={inputClass}>
                {STATUTS_PAIEMENT.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCurrentStep(3)} className="flex-1 py-2.5 border border-border rounded-xl text-sm hover:bg-muted">
              Retour
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Confirmer
            </button>
          </div>
        </form>
      )}

      {currentStep === 5 && student && step3Data && step4Data && (
        <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Check size={28} />
          </div>
          <h3 className="font-bold text-xl mb-2">Réinscription validée (mock)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {student.prenom} {student.nom} — {student.matricule}
            <br />
            Année {anneeActuelle} · Scolarité {formatCFA(step4Data.montant)}
          </p>
          <button
            onClick={handleConfirm}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 mb-2"
          >
            Enregistrer et voir le dossier
          </button>
          <button onClick={() => setLocation("/admin/students")} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">
            Retour à la liste
          </button>
        </div>
      )}
    </div>
  );
}
