import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import {
  ArrowLeft, ArrowRight, Check, User, GraduationCap, Phone,
  ClipboardCheck, FileText, CreditCard, Key, Upload,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { allocateMatricule, registerNewEtudiant, registerPaiement, emettreQuittanceBrute, peekNextMatricule, type EtudiantRecord } from "@/data/studentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useModelesFrais } from "@/hooks/useFinanceSettingsStore";
import { useGrillesFrais } from "@/hooks/useGrilleFraisStore";
import { getGrilleFrais, getModelesFraisDisponibles, calculerEcheances, nbEcheancesEffectif, type LigneGrilleFrais } from "@/data/grilleFraisStore";
import {
  SERIES_BAC, STATUTS_INSCRIPTION, TYPES_ADMISSION, DOCUMENTS_INSCRIPTION,
  MODES_PAIEMENT, STATUTS_PAIEMENT,
  generateMotDePasseEtudiant,
} from "@/lib/inscriptionConstants";
import { cn, formatCFA, formatShortDate } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = [
  { id: 1, label: "État civil", icon: User },
  { id: 2, label: "Scolarité ant.", icon: GraduationCap },
  { id: 3, label: "Inscription", icon: ClipboardCheck },
  { id: 4, label: "Pièces", icon: FileText },
  { id: 5, label: "Paiement", icon: CreditCard },
  { id: 6, label: "Confirmation", icon: Check },
];

interface Step1Data {
  prenom: string;
  nom: string;
  sexe: "M" | "F";
  dateNaissance: string;
  lieuNaissance: string;
  pays: string;
  nationalite: string;
  cni?: string;
  email: string;
  telephone?: string;
  adresse?: string;
  nomTuteur?: string;
  telTuteur?: string;
}

interface Step2Data {
  typeAdmission: "nouveau" | "transfert";
  serieBac?: string;
  anneeBac?: string;
  dernierEtablissement: string;
  universiteOrigine?: string;
  filiereOrigine?: string;
  niveauAtteint?: string;
  creditsValides?: number;
}

interface Step3Data {
  filiereId: string;
  niveauId: string;
  annee: string;
  statut: "actif" | "preinscrit" | "en_attente";
}

interface Step4Data {
  documents: Record<string, File | null>;
}

interface Step5Data {
  montantVerse: number;
  dateOperation: string;
  modePaiement: string;
  statutPaiement: string;
  numeroRecu: string;
  motDePasseGenere: string;
  /** Affectation uniquement si paiement payé */
  classeIdApresPaiement: string;
}

export default function AddStudentPage() {
  const [, setLocation] = useLocation();
  const classes = useClasses();
  const modelesFrais = useModelesFrais();
  useGrillesFrais(); // s'abonne pour recalculer si la grille tarifaire change
  const anneesAcademiques = useAnneesAcademiques();
  const anneeOptions = useMemo(
    () => [...anneesAcademiques].sort((a, b) => b.libelle.localeCompare(a.libelle)).map((a) => a.libelle),
    [anneesAcademiques],
  );
  const defaultAnnee = anneesAcademiques.find((a) => a.actuelle)?.libelle ?? anneeOptions[0] ?? "2025-2026";
  const [currentStep, setCurrentStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null);
  const [step3Data, setStep3Data] = useState<Step3Data | null>(null);
  const [step4Data, setStep4Data] = useState<Step4Data | null>(null);
  const [step5Data, setStep5Data] = useState<Step5Data | null>(null);
  const [matricule, setMatricule] = useState("");

  const form1 = useForm<Step1Data>({ defaultValues: { sexe: "M", pays: "Sénégal", nationalite: "Sénégalaise" } });
  const form2 = useForm<Step2Data>({ defaultValues: { typeAdmission: "nouveau", dernierEtablissement: "" } });
  const form3 = useForm<Step3Data>({ defaultValues: { annee: defaultAnnee, statut: "preinscrit" } });
  const form5 = useForm<Step5Data>({
    defaultValues: {
      montantVerse: 0,
      dateOperation: new Date().toISOString().split("T")[0],
      modePaiement: "Wave",
      statutPaiement: "paye",
      numeroRecu: "",
      motDePasseGenere: "",
      classeIdApresPaiement: "",
    },
  });

  const [documents, setDocuments] = useState<Record<string, File | null>>({});
  const [modeleFraisId, setModeleFraisId] = useState("");
  const [selectedEcheanceIds, setSelectedEcheanceIds] = useState<Set<string>>(new Set());
  const [motDePasse, setMotDePasse] = useState("");

  const selectedFiliere = form3.watch("filiereId");
  const typeAdmission = form2.watch("typeAdmission");
  const statutPaiementWatch = form5.watch("statutPaiement");
  const filteredNiveaux = NIVEAUX.filter((n) => n.filiereId === selectedFiliere);
  const filteredClasses = classes.filter((c) => {
    if (c.filiereId !== (step3Data?.filiereId || selectedFiliere)) return false;
    if (step3Data) {
      const niv = NIVEAUX.find((n) => n.id === step3Data.niveauId);
      if (niv && c.niveau !== niv.alias) return false;
      if (c.annee !== step3Data.annee) return false;
    }
    return true;
  });

  const niveauAlias = step3Data ? NIVEAUX.find((n) => n.id === step3Data.niveauId)?.alias ?? "" : "";

  const modelesDisponibles = useMemo(() => {
    if (!step3Data || !niveauAlias) return [];
    const ids = new Set(getModelesFraisDisponibles(step3Data.filiereId, niveauAlias, step3Data.annee));
    return modelesFrais.filter((m) => ids.has(m.id));
  }, [step3Data, niveauAlias, modelesFrais]);

  const grille = step3Data && niveauAlias && modeleFraisId
    ? getGrilleFrais(step3Data.filiereId, niveauAlias, step3Data.annee, modeleFraisId)
    : undefined;

  const lignesObligatoires = useMemo(
    () => grille?.lignes.filter((l) => l.modalite === "avant_inscription") ?? [],
    [grille],
  );
  const lignesEcheancier = useMemo(
    () => grille?.lignes.filter((l) => l.modalite === "echeances") ?? [],
    [grille],
  );

  interface EcheanceAffichee { id: string; ligne: LigneGrilleFrais; index: number; date: string; montant: number }
  const toutesEcheances = useMemo(() => {
    const anneeRef = step3Data?.annee ?? "";
    const result: EcheanceAffichee[] = [];
    for (const ligne of lignesEcheancier) {
      for (const ech of calculerEcheances(ligne, anneeRef)) {
        result.push({ id: `${ligne.id}#${ech.index}`, ligne, index: ech.index, date: ech.date, montant: ech.montant });
      }
    }
    return result;
  }, [lignesEcheancier, step3Data?.annee]);

  const echeancesSelectionnees = toutesEcheances.filter((e) => selectedEcheanceIds.has(e.id));
  const echeancesRestantes = toutesEcheances.filter((e) => !selectedEcheanceIds.has(e.id));

  const montantObligatoire = lignesObligatoires.reduce((s, l) => s + l.montant, 0);
  const montantEcheancesSelectionnees = echeancesSelectionnees.reduce((s, e) => s + e.montant, 0);
  const montantSuggere = montantObligatoire + montantEcheancesSelectionnees;
  const montantTotalTousFrais = montantObligatoire + toutesEcheances.reduce((s, e) => s + e.montant, 0);

  const factureLignes = useMemo(() => {
    const lignesAffichees: { label: string; montant: number }[] = lignesObligatoires.map((l) => ({ label: l.intitule, montant: l.montant }));
    for (const e of echeancesSelectionnees) {
      lignesAffichees.push({
        label: `${e.ligne.intitule} — Échéance ${e.index}/${nbEcheancesEffectif(e.ligne)} (${formatShortDate(e.date)})`,
        montant: e.montant,
      });
    }
    return lignesAffichees;
  }, [lignesObligatoires, echeancesSelectionnees]);

  const toggleEcheance = (id: string) => {
    setSelectedEcheanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectionnerToutesLesEcheances = () => {
    setSelectedEcheanceIds(new Set(toutesEcheances.map((e) => e.id)));
  };

  const ensureMatricule = (filiereId: string) => {
    if (!matricule) {
      const code = FILIERES.find((f) => f.id === filiereId)?.code;
      if (code) setMatricule(peekNextMatricule(code));
    }
  };

  const handleStep1 = form1.handleSubmit((data) => { setStep1Data(data); setCurrentStep(2); });
  const handleStep2 = form2.handleSubmit((data) => { setStep2Data(data); setCurrentStep(3); });
  const handleStep3 = form3.handleSubmit((data) => {
    ensureMatricule(data.filiereId);
    setStep3Data(data);
    setCurrentStep(4);
  });
  const handleStep4 = () => {
    setStep4Data({ documents });
    setCurrentStep(5);
  };
  const handleStep5 = form5.handleSubmit((data) => {
    setStep5Data({
      ...data,
      motDePasseGenere: motDePasse,
      montantVerse: montantSuggere,
    });
    setCurrentStep(6);
  });
  const handleSubmit = () => {
    if (!step1Data || !step3Data || !step5Data) return;
    const filiere = FILIERES.find((f) => f.id === step3Data.filiereId);
    const niveau = NIVEAUX.find((n) => n.id === step3Data.niveauId);
    const code = filiere?.code ?? "XXX";
    const finalMatricule = allocateMatricule(code);
    setMatricule(finalMatricule);

    const paye = step5Data.statutPaiement === "paye";
    const classeApres = paye ? step5Data.classeIdApresPaiement : "";

    const docsFournis = Object.entries(documents)
      .filter(([, f]) => !!f)
      .map(([id]) => id);

    let etudiant: EtudiantRecord;
    try {
      etudiant = registerNewEtudiant(
        {
          prenom: step1Data.prenom,
          nom: step1Data.nom,
          sexe: step1Data.sexe,
          dateNaissance: step1Data.dateNaissance,
          email: step1Data.email,
          telephone: step1Data.telephone,
          filiereId: step3Data.filiereId,
          classeId: "",
          niveau: niveau?.alias ?? "L1",
          statut: "preinscrit",
          annee: step3Data.annee,
          soldeDu: 0,
          inscriptionUniquePayee: false,
          modeleFraisId: modeleFraisId || undefined,
          lieuNaissance: step1Data.lieuNaissance,
          pays: step1Data.pays,
          nationalite: step1Data.nationalite,
          cni: step1Data.cni,
          typeAdmission: step2Data?.typeAdmission,
          documentsFournis: docsFournis,
        },
        finalMatricule,
      );

      // Ce qui est réglé maintenant (frais obligatoires + échéances cochées) : encaissé si
      // "Payé", sinon simplement facturé (émis, non encaissé) comme les échéances restantes.
      if (factureLignes.length > 0) {
        if (paye) {
          registerPaiement({
            etudiantId: etudiant.id,
            rubrique: "Facture d'inscription",
            montant: montantSuggere,
            moyen: step5Data.modePaiement,
            reference: step5Data.numeroRecu,
            date: step5Data.dateOperation,
            statut: "paye",
            lignes: factureLignes,
            classeId: classeApres || undefined,
            recordOnly: true,
          });
        } else {
          emettreQuittanceBrute({
            etudiantId: etudiant.id,
            date: step5Data.dateOperation,
            lignes: factureLignes,
            reference: step5Data.numeroRecu || `Facture inscription ${finalMatricule}`,
          });
        }
      }

      // Échéances non cochées : facturées à leur date d'échéance, à régler plus tard.
      for (const e of echeancesRestantes) {
        emettreQuittanceBrute({
          etudiantId: etudiant.id,
          date: e.date,
          dateLimite: e.date,
          lignes: [{ label: `${e.ligne.intitule} — Échéance ${e.index}/${nbEcheancesEffectif(e.ligne)}`, montant: e.montant }],
          reference: `${e.ligne.intitule} — Échéance ${e.index}/${nbEcheancesEffectif(e.ligne)}`,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inscription impossible");
      return;
    }
    setLocation(`/admin/students/${etudiant.id}`);
  };

  const InputField = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Étudiants", href: "/admin/students" }, { label: "Inscrire un étudiant" }]}
        title="Inscription d'un Étudiant"
        subtitle="Parcours complet : scolarité antérieure, pièces justificatives et paiement"
        actions={
          <button onClick={() => setLocation("/admin/students")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center shrink-0">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                currentStep === step.id ? "bg-primary text-white shadow-lg shadow-primary/30" :
                currentStep > step.id ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
              )}>
                {currentStep > step.id ? <Check size={14} /> : <step.icon size={14} />}
              </div>
              <span className={cn("text-[10px] font-medium mt-1 whitespace-nowrap", currentStep === step.id ? "text-primary" : "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 w-10 mx-1 mb-4 rounded-full", currentStep > step.id ? "bg-emerald-500" : "bg-muted")} />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Étape 1 — État civil + Contacts */}
        {currentStep === 1 && (
          <form onSubmit={handleStep1} className="bg-card border border-border rounded-2xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>État Civil</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Prénom *" error={form1.formState.errors.prenom?.message}>
                <input {...form1.register("prenom", { required: "Prénom requis", minLength: { value: 2, message: "Minimum 2 caractères" } })} className={inputClass} placeholder="Moussa" data-testid="input-prenom" />
              </InputField>
              <InputField label="Nom *" error={form1.formState.errors.nom?.message}>
                <input {...form1.register("nom", { required: "Nom requis" })} className={inputClass + " uppercase"} placeholder="SY" />
              </InputField>
              <InputField label="Sexe *">
                <div className="flex gap-3">
                  {(["M", "F"] as const).map((s) => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" {...form1.register("sexe")} value={s} className="w-4 h-4 text-primary" />
                      <span className="text-sm">{s === "M" ? "Masculin" : "Féminin"}</span>
                    </label>
                  ))}
                </div>
              </InputField>
              <InputField label="Date de naissance *" error={form1.formState.errors.dateNaissance?.message}>
                <input {...form1.register("dateNaissance", { required: "Date requise" })} type="date" className={inputClass} />
              </InputField>
              <InputField label="Lieu de naissance *" error={form1.formState.errors.lieuNaissance?.message}>
                <input {...form1.register("lieuNaissance", { required: "Lieu requis" })} className={inputClass} placeholder="Dakar" />
              </InputField>
              <InputField label="Pays *">
                <select {...form1.register("pays", { required: true })} className={inputClass}>
                  {["Sénégal", "Mali", "Côte d'Ivoire", "Guinée", "Mauritanie", "Gambie"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </InputField>
              <InputField label="Nationalité *">
                <input {...form1.register("nationalite", { required: "Nationalité requise" })} className={inputClass} placeholder="Sénégalaise" />
              </InputField>
              <InputField label="N° CNI / Passeport">
                <input {...form1.register("cni")} className={inputClass} placeholder="1 23456789" />
              </InputField>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5"><Phone size={12} /> Contacts</p>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Email *" error={form1.formState.errors.email?.message}>
                  <input {...form1.register("email", { required: "Email requis", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email invalide" } })} type="email" className={inputClass} placeholder="prenom.nom@edu.sn" />
                </InputField>
                <InputField label="Téléphone">
                  <input {...form1.register("telephone")} className={inputClass} placeholder="77 XXX XX XX" />
                </InputField>
                <InputField label="Adresse">
                  <input {...form1.register("adresse")} className={inputClass} placeholder="Quartier, Ville" />
                </InputField>
                <InputField label="Nom du tuteur">
                  <input {...form1.register("nomTuteur")} className={inputClass} placeholder="Mamadou SY" />
                </InputField>
                <InputField label="Tél. tuteur">
                  <input {...form1.register("telTuteur")} className={inputClass} placeholder="77 XXX XX XX" />
                </InputField>
              </div>
            </div>

            <button type="submit" className="flex items-center gap-2 w-full justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
              Suivant <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Étape 2 — Scolarité antérieure / Transfert */}
        {currentStep === 2 && (
          <form onSubmit={handleStep2} className="bg-card border border-border rounded-2xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Scolarité Antérieure</h3>
            <p className="text-sm text-muted-foreground">Renseignez le parcours scolaire ou universitaire avant l'inscription dans notre établissement.</p>

            <InputField label="Type d'admission *">
              <div className="grid grid-cols-2 gap-3">
                {TYPES_ADMISSION.map((t) => (
                  <label key={t.value} className={cn(
                    "flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all text-sm",
                    typeAdmission === t.value ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:bg-muted",
                  )}>
                    <input type="radio" {...form2.register("typeAdmission")} value={t.value} className="w-4 h-4" />
                    {t.label}
                  </label>
                ))}
              </div>
            </InputField>

            {typeAdmission === "nouveau" ? (
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Série du BAC *" error={form2.formState.errors.serieBac?.message}>
                  <select {...form2.register("serieBac", { required: "Série requise" })} className={inputClass}>
                    <option value="">Sélectionner</option>
                    {SERIES_BAC.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </InputField>
                <InputField label="Année BAC (obtention) *" error={form2.formState.errors.anneeBac?.message}>
                  <input {...form2.register("anneeBac", { required: "Année requise" })} type="number" min={2000} max={2026} className={inputClass} placeholder="2025" />
                </InputField>
                <InputField label="Dernier établissement *" error={form2.formState.errors.dernierEtablissement?.message}>
                  <input {...form2.register("dernierEtablissement", { required: "Établissement requis" })} className={inputClass + " col-span-2"} placeholder="Lycée Blaise Diagne, Dakar" />
                </InputField>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Université d'origine *">
                  <input {...form2.register("universiteOrigine", { required: "Université requise" })} className={inputClass} placeholder="UCAD, Dakar" />
                </InputField>
                <InputField label="Filière précédente *">
                  <input {...form2.register("filiereOrigine", { required: "Filière requise" })} className={inputClass} placeholder="Licence Informatique" />
                </InputField>
                <InputField label="Niveau atteint *">
                  <input {...form2.register("niveauAtteint", { required: "Niveau requis" })} className={inputClass} placeholder="Licence 2" />
                </InputField>
                <InputField label="Crédits validés (ECTS)">
                  <input {...form2.register("creditsValides", { valueAsNumber: true })} type="number" min={0} className={inputClass} placeholder="60" />
                </InputField>
                <InputField label="Dernier établissement *">
                  <input {...form2.register("dernierEtablissement", { required: "Établissement requis" })} className={inputClass + " col-span-2"} placeholder="Université Cheikh Anta Diop" />
                </InputField>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setCurrentStep(1)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <button type="submit" className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
                Suivant <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* Étape 3 — Inscription académique */}
        {currentStep === 3 && (
          <form onSubmit={handleStep3} className="bg-card border border-border rounded-2xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Inscription Académique</h3>

            <InputField label="Filière *" error={form3.formState.errors.filiereId?.message}>
              <select {...form3.register("filiereId", { required: "Filière requise" })} className={inputClass} onChange={(e) => { form3.setValue("filiereId", e.target.value); setMatricule(""); }}>
                <option value="">Sélectionner une filière</option>
                {FILIERES.filter((f) => f.statut === "actif").map((f) => (
                  <option key={f.id} value={f.id}>{f.code} – {f.nom}</option>
                ))}
              </select>
            </InputField>

            <div className="grid grid-cols-2 gap-4">
              <InputField label="Niveau *">
                <select {...form3.register("niveauId", { required: "Niveau requis" })} className={inputClass}>
                  <option value="">Sélectionner</option>
                  {filteredNiveaux.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
                </select>
              </InputField>
              <InputField label="Année académique *">
                <select {...form3.register("annee")} className={inputClass}>
                  {anneeOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </InputField>
            </div>

            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
              La <strong>classe pédagogique</strong> n&apos;est pas choisie ici : elle sera affectée <strong>après validation du paiement</strong> (étape suivante).
            </div>

            <InputField label="Statut provisoire *">
              <select {...form3.register("statut")} className={inputClass}>
                {STATUTS_INSCRIPTION.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </InputField>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Matricule (généré automatiquement)</label>
              <input
                type="text"
                readOnly
                value={selectedFiliere ? (matricule || peekNextMatricule(FILIERES.find((f) => f.id === selectedFiliere)?.code ?? "XXX")) : "—"}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-muted/50 font-mono cursor-not-allowed"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              />
            </div>

            {step2Data?.typeAdmission === "transfert" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                Transfert depuis <strong>{step2Data.universiteOrigine}</strong> — équivalence à valider par la direction des études.
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setCurrentStep(2)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <button type="submit" className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
                Suivant <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* Étape 4 — Pièces justificatives */}
        {currentStep === 4 && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Pièces Justificatives</h3>
            <p className="text-sm text-muted-foreground">Déposez un fichier par document requis (PDF, JPG ou PNG).</p>

            <div className="space-y-3">
              {DOCUMENTS_INSCRIPTION.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.label}</p>
                    {documents[doc.id] ? (
                      <p className="text-xs text-emerald-600 mt-0.5">{documents[doc.id]?.name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Aucun fichier</p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-medium cursor-pointer hover:bg-muted transition-colors">
                    <Upload size={14} />
                    {documents[doc.id] ? "Remplacer" : "Choisir"}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setDocuments((prev) => ({ ...prev, [doc.id]: file }));
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setCurrentStep(3)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <button type="button" onClick={handleStep4} className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
                Suivant <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Étape 5 — Paiement */}
        {currentStep === 5 && (
          <form onSubmit={handleStep5} className="bg-card border border-border rounded-2xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Paiement des Frais d'Inscription</h3>

            <InputField label="Modèle de frais *">
              <select
                value={modeleFraisId}
                onChange={(e) => { setModeleFraisId(e.target.value); setSelectedEcheanceIds(new Set()); }}
                className={inputClass}
              >
                <option value="">Sélectionner</option>
                {modelesDisponibles.map((m) => <option key={m.id} value={m.id}>{m.intitule}</option>)}
              </select>
              {modelesDisponibles.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Aucune grille tarifaire configurée pour cette filière/niveau/année. Configurez-la dans Finances &gt; Configuration des frais (grille tarifaire).
                </p>
              )}
            </InputField>

            {modeleFraisId && !grille && modelesDisponibles.length > 0 && (
              <p className="text-xs text-amber-600">Aucune grille tarifaire pour ce modèle de frais sur cette filière/niveau/année.</p>
            )}

            {grille && (
              <>
                {lignesObligatoires.length > 0 && (
                  <div className="rounded-xl border border-border p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">Frais obligatoires (payables à l'inscription)</p>
                    {lignesObligatoires.map((l) => (
                      <div key={l.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{l.intitule}</span>
                        <span className="font-medium">{formatCFA(l.montant)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {lignesEcheancier.length > 0 && (
                  <div className="rounded-xl border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">Frais échelonnés — cochez les échéances réglées maintenant</p>
                      <button type="button" onClick={selectionnerToutesLesEcheances} className="text-[11px] font-medium text-primary hover:underline">
                        Payer la totalité (toutes les échéances)
                      </button>
                    </div>
                    {lignesEcheancier.map((l) => (
                      <div key={l.id} className="space-y-1">
                        <p className="text-xs font-medium text-foreground">{l.intitule} <span className="text-muted-foreground font-normal">({nbEcheancesEffectif(l)} échéances)</span></p>
                        <div className="grid sm:grid-cols-2 gap-1.5">
                          {calculerEcheances(l, step3Data?.annee ?? "").map((ech) => {
                            const id = `${l.id}#${ech.index}`;
                            return (
                              <label key={id} className="flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-lg hover:bg-muted">
                                <input type="checkbox" checked={selectedEcheanceIds.has(id)} onChange={() => toggleEcheance(id)} className="w-3.5 h-3.5 rounded text-primary" />
                                <span className="flex-1 text-muted-foreground">Échéance {ech.index}/{nbEcheancesEffectif(l)} — {formatShortDate(ech.date)}</span>
                                <span className="font-medium">{formatCFA(ech.montant)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {factureLignes.length > 0 && (
                  <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">Facture — réglée maintenant</p>
                    {factureLignes.map((l) => (
                      <div key={l.label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span className="font-medium">{formatCFA(l.montant)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5 mt-1">
                      <span>Total à régler maintenant</span>
                      <span className="text-primary">{formatCFA(montantSuggere)}</span>
                    </div>
                  </div>
                )}

                {echeancesRestantes.length > 0 && (
                  <div className="rounded-xl border border-dashed border-border p-3 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Échéances restantes (facturées, à régler plus tard)</p>
                    {echeancesRestantes.map((e) => (
                      <div key={e.id} className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{e.ligne.intitule} — Échéance {e.index}/{nbEcheancesEffectif(e.ligne)} ({formatShortDate(e.date)})</span>
                        <span>{formatCFA(e.montant)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs font-semibold border-t border-border pt-1 mt-1">
                      <span>Total restant dû</span>
                      <span>{formatCFA(montantTotalTousFrais - montantSuggere)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <InputField label="Date d'opération *">
                <input {...form5.register("dateOperation", { required: true })} type="date" className={inputClass} />
              </InputField>
              <InputField label="Mode de paiement *">
                <select {...form5.register("modePaiement")} className={inputClass}>
                  {MODES_PAIEMENT.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </InputField>
              <InputField label="Statut du paiement *">
                <select {...form5.register("statutPaiement")} className={inputClass}>
                  {STATUTS_PAIEMENT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </InputField>
              <InputField label="N° reçu / Référence">
                <input {...form5.register("numeroRecu")} className={inputClass + " font-mono"} placeholder="Auto si vide" style={{ fontFamily: "JetBrains Mono, monospace" }} />
              </InputField>
            </div>

            {statutPaiementWatch === "paye" && (
              <InputField label="Affecter à une classe (après paiement) *">
                <select {...form5.register("classeIdApresPaiement", { required: statutPaiementWatch === "paye" })} className={inputClass}>
                  <option value="">Choisir la classe pédagogique</option>
                  {filteredClasses.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom} ({c.inscrits}/{c.max})</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">Obligatoire une fois le paiement validé — l&apos;étudiant n&apos;est versé en classe qu&apos;à cette étape.</p>
              </InputField>
            )}

            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Accès portail étudiant</p>
              <p className="text-xs text-muted-foreground mb-3">Connexion : matricule + mot de passe généré (modifiable par l'étudiant ultérieurement)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 px-3 py-2.5 bg-muted/50 border border-border rounded-xl font-mono text-sm" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                  {motDePasse || "—"}
                </div>
                <button
                  type="button"
                  onClick={() => setMotDePasse(generateMotDePasseEtudiant())}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  <Key size={14} /> Générer mot de passe
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setCurrentStep(4)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <button type="submit" className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
                Suivant <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* Étape 6 — Confirmation */}
        {currentStep === 6 && (
          <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ClipboardCheck size={28} className="text-emerald-600" />
              </div>
              <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Confirmer l'inscription</h3>
              <p className="text-sm text-muted-foreground">Vérifiez le récapitulatif avant validation définitive</p>
            </div>

            <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-2 mb-6 text-sm">
              {step1Data && (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Nom complet</span><span className="font-semibold">{step1Data.prenom} {step1Data.nom}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{step1Data.email}</span></div>
                </>
              )}
              {step2Data && (
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Parcours</span>
                  <span>{step2Data.typeAdmission === "nouveau" ? `BAC ${step2Data.serieBac} (${step2Data.anneeBac})` : `Transfert — ${step2Data.universiteOrigine}`}</span>
                </div>
              )}
              {step3Data && (
                <>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">Filière / Niveau</span>
                    <span>
                      {FILIERES.find((f) => f.id === step3Data.filiereId)?.code} —{" "}
                      {NIVEAUX.find((n) => n.id === step3Data.niveauId)?.nom}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Statut provisoire</span>
                    <StatusBadge status={step3Data.statut} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Matricule prévu</span>
                    <span className="font-mono font-bold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{matricule}</span>
                  </div>
                </>
              )}
              {step4Data && (
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Pièces jointes</span>
                  <span>{Object.values(step4Data.documents).filter(Boolean).length} / {DOCUMENTS_INSCRIPTION.length}</span>
                </div>
              )}
              {step5Data && (
                <>
                  <div className="border-t border-border pt-2 space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Facture — réglée maintenant</p>
                    {factureLignes.map((l) => (
                      <div key={l.label} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span>{formatCFA(l.montant)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-1">
                      <span>Montant versé</span>
                      <span className="text-primary">{formatCFA(step5Data.montantVerse)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Statut</span>
                      <span>{STATUTS_PAIEMENT.find((s) => s.value === step5Data.statutPaiement)?.label}</span>
                    </div>
                    {step5Data.statutPaiement === "paye" && step5Data.classeIdApresPaiement && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Classe affectée</span>
                        <span className="font-medium">
                          {classes.find((c) => c.id === step5Data.classeIdApresPaiement)?.nom ?? "—"}
                        </span>
                      </div>
                    )}
                  </div>
                  {echeancesRestantes.length > 0 && (
                    <div className="border-t border-border pt-2 space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Échéances restantes à régler</p>
                      {echeancesRestantes.map((e) => (
                        <div key={e.id} className="flex justify-between text-[11px] text-muted-foreground">
                          <span>{e.ligne.intitule} — Échéance {e.index}/{nbEcheancesEffectif(e.ligne)} ({formatShortDate(e.date)})</span>
                          <span>{formatCFA(e.montant)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-bold pt-1">
                        <span>Total restant dû</span>
                        <span>{formatCFA(montantTotalTousFrais - montantSuggere)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mot de passe étudiant</span>
                    <span className="font-mono text-xs" style={{ fontFamily: "JetBrains Mono, monospace" }}>{motDePasse ? "••••••••" : "Non généré"}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setCurrentStep(5)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <button onClick={handleSubmit} className="flex items-center gap-2 flex-1 justify-center py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors" data-testid="btn-create-student">
                <Check size={16} /> Confirmer l'inscription
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
