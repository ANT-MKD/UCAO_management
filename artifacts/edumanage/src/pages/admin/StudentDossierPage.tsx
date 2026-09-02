import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Edit, AlertTriangle, GraduationCap, FileText, CreditCard, Calendar, History, IdCard, Wallet, UserX, Eye, Award, ShieldOff, Users, StickyNote, Paperclip, Plus, Trash2, Phone } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FormModal } from "@/components/admin/FormModal";
import { MemosPanel } from "@/components/admin/MemosPanel";
import { DocumentsPanel } from "@/components/admin/DocumentsPanel";
import { useContacts } from "@/hooks/useContactStore";
import { addContact, deleteContact, CONTACT_ROLE_LABELS, type ContactRole } from "@/data/contactStore";
import { useRelances } from "@/hooks/useRelancePaiementStore";
import { getRelanceActivePour, relanceEstExpiree, relanceEstResolue } from "@/data/relancePaiementStore";
import { useMotifsBlocage } from "@/hooks/useMotifBlocageStore";
import { setEtudiantMotifBlocage } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, formatDate, cn } from "@/lib/utils";
import { useEtudiant, useInscriptions, usePaiementsByEtudiant, useNotes, useCahiers, useReleves, useStudentStore } from "@/hooks/useStudentStore";
import { resolveBulletin, BulletinPreviewModal } from "@/pages/admin/RelevesPage";
import { computeMoyenneAnnuelle, computeMoyenneProgramme } from "@/data/bulletinEngine";
import { useMentions } from "@/hooks/useMentionsStore";
import { useDeliberations } from "@/hooks/useDeliberationStore";
import { useAttestations } from "@/hooks/useAttestationStore";
import { TYPE_LABELS as ATTESTATION_TYPE_LABELS } from "@/data/attestationStore";
import { useAbsencesPeriode } from "@/hooks/useAbsencePeriodeStore";
import { getAssiduiteRowsPourEtudiant, getTauxPresencePourEtudiant } from "@/data/assiduiteEngine";
import { useAvoirDepots } from "@/hooks/useAvoirDepotStore";
import { useRemboursementsAvoir } from "@/hooks/useRemboursementAvoirStore";
import { useReductionsFrais } from "@/hooks/useReductionFraisStore";
import { useFraisEtudiant } from "@/hooks/useFraisEtudiantStore";
import { statutFraisEtudiant } from "@/data/fraisEtudiantStore";
import { useReprisFrais } from "@/hooks/useReprisFraisStore";
import { useTypesFrais } from "@/hooks/useFinanceSettingsStore";
import { useDerogationsPaiement } from "@/hooks/useDerogationPaiementStore";
import { statutDerogation, PORTEE_LABELS, type StatutDerogation } from "@/data/derogationPaiementStore";
import { useAbandons } from "@/hooks/useAbandonStore";
import { useCreditDettes } from "@/hooks/useCreditDetteStore";
import { soldeCreditDette } from "@/data/creditDetteStore";

interface StudentDossierPageProps {
  id: string;
}

const MOYEN_COLORS: Record<string, string> = {
  Wave: "#2563eb", OrangeMoney: "#ea580c", Virement: "#4f46e5", Especes: "#10b981",
};

export default function StudentDossierPage({ id }: StudentDossierPageProps) {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("informations");
  const [blocageOpen, setBlocageOpen] = useState(false);
  const [motifChoisi, setMotifChoisi] = useState("");
  const [contactModalRole, setContactModalRole] = useState<ContactRole | null>(null);
  const [contactForm, setContactForm] = useState({ nomComplet: "", telephone: "", email: "", adresse: "", lien: "" });
  const contacts = useContacts();

  const motifsBlocage = useMotifsBlocage();
  const relances = useRelances();
  const student = useEtudiant(id);
  const inscriptions = useInscriptions(id);
  const studentPaiements = usePaiementsByEtudiant(id);
  const allNotes = useNotes();
  const studentNotes = allNotes.filter((n) => n.etudiantId === id);
  const etudiants = useStudentStore();
  const allReleves = useReleves();
  const studentReleves = allReleves.filter((r) => r.etudiantId === id);
  const allAttestations = useAttestations();
  const studentAttestations = allAttestations.filter((a) => a.etudiantId === id);
  const allCreditDettes = useCreditDettes();
  const studentDettes = allCreditDettes.filter((d) => d.etudiantId === id);
  useMentions(); // s'abonne pour refléter la vraie mention si la configuration change
  useDeliberations(); // s'abonne pour refléter la vraie décision de jury si une délibération change
  const [previewReleve, setPreviewReleve] = useState<(typeof studentReleves)[number] | null>(null);
  // Moyennes réelles (bulletinEngine) combinant les bulletins de semestre déjà calculés — jamais
  // affichées nulle part avant cette reconnexion, alors que la méthode de calcul est configurable
  // dans Paramétrage bulletins (onglet Méthodes de calcul).
  const moyenneAnnuelle = student ? computeMoyenneAnnuelle(student.id, student.classeId, student.filiereId, student.niveau) : undefined;
  const moyenneProgramme = student ? computeMoyenneProgramme(student.id, student.filiereId) : undefined;
  const avoirDepots = useAvoirDepots();
  const avoirRemboursements = useRemboursementsAvoir();
  const studentDepots = avoirDepots.filter((d) => d.etudiantId === id);
  const studentRemboursements = avoirRemboursements.filter((r) => r.etudiantId === id);
  const reductionsFrais = useReductionsFrais();
  const studentReductions = reductionsFrais.filter((r) => r.etudiantId === id);
  const fraisEtudiant = useFraisEtudiant();
  const typesFrais = useTypesFrais();
  const studentFrais = fraisEtudiant.filter((l) => l.etudiantId === id);
  const typeFraisLabel = (typeFraisId: string) => typesFrais.find((t) => t.id === typeFraisId)?.intitule ?? "Frais";
  const reprisesFrais = useReprisFrais();
  const studentReprisesEnCours = reprisesFrais.filter((r) => r.etudiantId === id && r.statut !== "valide");
  const derogationsPaiement = useDerogationsPaiement();
  const studentDerogations = derogationsPaiement.filter((d) => d.etudiantId === id);
  const studentDerogationActive = studentDerogations.find((d) => statutDerogation(d) === "active");
  const abandons = useAbandons();
  useCahiers(); // souscription pour re-rendre l'onglet Absences quand un cahier change
  useAbsencesPeriode(); // idem pour les couvertures par période
  const studentAbandons = abandons.filter((a) => a.etudiantId === id);
  const studentAbandonActif = studentAbandons.find((a) => !a.reintegre);
  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-bold text-foreground mb-2">Étudiant introuvable</h2>
        <button onClick={() => setLocation("/admin/students")} className="text-primary hover:underline text-sm">
          Retour à la liste
        </button>
      </div>
    );
  }

  const totalPaye = studentPaiements.reduce((sum, p) => sum + p.montant, 0);

  const motifActif = student.motifBlocageId ? motifsBlocage.find((m) => m.id === student.motifBlocageId) : undefined;
  const relanceActive = relances.find((r) => r.etudiantId === id && r.statut === "active");
  const relanceBloquante = relanceActive && !relanceEstResolue(relanceActive) && relanceEstExpiree(relanceActive);

  const openBlocage = () => {
    setMotifChoisi(student.motifBlocageId ?? "");
    setBlocageOpen(true);
  };

  const studentContacts = contacts.filter((c) => c.etudiantId === id);
  const openContactModal = (role: ContactRole) => {
    setContactForm({ nomComplet: "", telephone: "", email: "", adresse: "", lien: "" });
    setContactModalRole(role);
  };
  const handleSaveContact = () => {
    if (!currentUser || !contactModalRole || !contactForm.nomComplet.trim()) return;
    addContact({
      etudiantId: id,
      role: contactModalRole,
      nomComplet: contactForm.nomComplet.trim(),
      telephone: contactForm.telephone.trim() || undefined,
      email: contactForm.email.trim() || undefined,
      adresse: contactForm.adresse.trim() || undefined,
      lien: contactForm.lien.trim() || undefined,
    }, currentUser.id);
    toast.success("Contact ajouté.");
    setContactModalRole(null);
  };
  const handleDeleteContact = (contactId: string) => {
    if (!currentUser) return;
    deleteContact(contactId, currentUser.id);
    toast.success("Contact supprimé.");
  };

  const handleSaveBlocage = () => {
    if (!currentUser) return;
    setEtudiantMotifBlocage(student.id, motifChoisi || undefined, currentUser.id);
    toast.success(motifChoisi ? "Blocage assigné." : "Blocage retiré.");
    setBlocageOpen(false);
  };

  const TABS = [
    { key: "informations", label: "Informations", icon: GraduationCap },
    { key: "parcours", label: "Parcours", icon: History },
    { key: "notes", label: "Bulletins", icon: FileText },
    { key: "paiements", label: "Paiements", icon: CreditCard },
    { key: "absences", label: "Absences", icon: Calendar },
    { key: "contacts", label: "Contacts", icon: Users },
    { key: "memos", label: "Mémos", icon: StickyNote },
    { key: "documents", label: "Documents", icon: Paperclip },
  ];

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => setLocation("/admin/students")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        data-testid="btn-back"
      >
        <ArrowLeft size={15} /> Retour aux étudiants
      </button>

      {/* Banner */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <UserAvatar name={`${student.prenom} ${student.nom}`} size="lg" src={student.photoDataUrl} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              {student.prenom} {student.nom}
            </h1>
            <StatusBadge status={student.statut} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono font-bold text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>
              {student.matricule}
            </span>
            <span>·</span>
            <span>{student.filiere}</span>
            <span>·</span>
            <span>{student.classe}</span>
            <span>·</span>
            <span>{student.niveau}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {student.soldeDu > 0 && (
              <div className={cn("flex items-center gap-1.5 text-xs font-medium", studentDerogationActive ? "text-blue-600" : "text-red-500")}>
                <AlertTriangle size={12} />
                Solde dû : {formatCFA(student.soldeDu)}
                {studentDerogationActive && ` — dérogation active (${PORTEE_LABELS[studentDerogationActive.portee]})`}
              </div>
            )}
            {student.soldeAvoir > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <Wallet size={12} />
                Solde avoir : {formatCFA(student.soldeAvoir)}
              </div>
            )}
          </div>
          {studentAbandonActif ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-3 py-1.5 w-fit">
              <UserX size={12} />
              En abandon depuis le {formatDate(studentAbandonActif.dateAbandon)} — motif : {studentAbandonActif.motif}
              <button onClick={() => setLocation("/admin/abandons")} className="underline hover:no-underline">Voir le dossier</button>
            </div>
          ) : studentAbandons.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/40 rounded-xl px-3 py-1.5 w-fit">
              <History size={12} />
              A été en abandon puis réintégré(e) — <button onClick={() => setLocation("/admin/abandons")} className="underline hover:no-underline">voir l&apos;historique</button>
            </div>
          )}
          {motifActif && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-1.5 w-fit" data-testid="student-blocage-badge">
              <ShieldOff size={12} />
              Blocage actif : {motifActif.intitule}
              <button onClick={openBlocage} className="underline hover:no-underline">Gérer</button>
            </div>
          )}
          {relanceBloquante && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-3 py-1.5 w-fit" data-testid="student-relance-bloquante">
              <ShieldOff size={12} />
              Portail bloqué — impayé non régularisé depuis le {formatDate(relanceActive!.dateEcheance)}
            </div>
          )}
          {relanceActive && !relanceBloquante && !relanceEstResolue(relanceActive) && (
            <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-1.5 w-fit">
              Relance envoyée — échéance le {formatDate(relanceActive.dateEcheance)}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          <button onClick={openBlocage} className={cn("flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-medium transition-colors", motifActif ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "border-border hover:bg-muted")} data-testid="student-gerer-blocage">
            <ShieldOff size={13} /> {motifActif ? "Blocage actif" : "Motif de blocage"}
          </button>
          <button onClick={() => setLocation(`/admin/students/card?id=${encodeURIComponent(student.id)}`)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors">
            <IdCard size={13} /> Carte étudiant
          </button>
          <button onClick={() => setLocation(`/admin/students/reinscription?matricule=${encodeURIComponent(student.matricule)}`)} className="flex items-center gap-1.5 px-3 py-2 border border-indigo-300 text-indigo-700 rounded-xl text-xs font-medium hover:bg-indigo-50 transition-colors">
            <History size={13} /> Réinscrire
          </button>
          {!studentAbandonActif && (
            <button onClick={() => setLocation(`/admin/abandons/nouveau?matricule=${encodeURIComponent(student.matricule)}`)} className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-600 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors">
              <UserX size={13} /> Nouvel abandon
            </button>
          )}
          <button onClick={() => setLocation(`/admin/paiements/new`)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors">
            <CreditCard size={13} /> Paiement
          </button>
          <button onClick={() => setLocation(`/admin/students/new`)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors">
            <Edit size={13} /> Modifier
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
              activeTab === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            data-testid={`tab-${tab.key}`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        {activeTab === "informations" && (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>État Civil</h3>
              <div className="space-y-3">
                {[
                  { label: "Prénom", value: student.prenom },
                  { label: "Nom", value: student.nom },
                  { label: "Sexe", value: student.sexe === "M" ? "Masculin" : "Féminin" },
                  { label: "Date de naissance", value: formatDate(student.dateNaissance) },
                  { label: "Lieu de naissance", value: student.lieuNaissance },
                  { label: "Nationalité", value: student.nationalite },
                  { label: "Pays", value: student.pays },
                  { label: "N° CNI / Passeport", value: student.cni },
                  { label: "Matricule", value: student.matricule, mono: true },
                  { label: "1ère inscription", value: String(student.anneePremiereInscription) },
                  { label: "Inscription unique payée", value: student.inscriptionUniquePayee ? "Oui" : "Non" },
                ].filter((f) => f.value).map((f) => (
                  <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{f.label}</span>
                    <span className={cn("text-sm text-foreground font-medium", f.mono && "font-mono")} style={f.mono ? { fontFamily: "JetBrains Mono, monospace" } : {}}>
                      {f.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Coordonnées</h3>
              <div className="space-y-3">
                {[
                  { label: "Email", value: student.email },
                  { label: "Téléphone", value: student.telephone },
                  { label: "Adresse", value: student.adresse },
                  { label: "Filière", value: student.filiere },
                  { label: "Classe", value: student.classe },
                  { label: "Année", value: student.annee },
                ].filter((f) => f.value).map((f) => (
                  <div key={f.label} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{f.label}</span>
                    <span className="text-sm text-foreground font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "parcours" && (
          <div>
            {studentDettes.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
                  Dettes de crédits (passage conditionnel — AJAC)
                </h3>
                <div className="space-y-2">
                  {studentDettes.map((d) => (
                    <div key={d.id} className={cn(
                      "flex items-center justify-between gap-3 p-3 rounded-xl border text-sm",
                      d.statut === "en_cours" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
                    )}>
                      <div>
                        <span className="font-semibold text-foreground">{d.ueCode} — {d.ueLibelle}</span>
                        <span className="text-muted-foreground ml-2">{d.ueCredits} crédits · {d.niveauLabelOrigine} ({d.semestreOrigine}) · {d.annee}</span>
                      </div>
                      {d.statut === "en_cours" ? (
                        <button
                          onClick={() => { soldeCreditDette(d.id, currentUser?.id ?? "admin"); toast.success(`Dette soldée — ${d.ueCode}`); }}
                          className="shrink-0 px-3 py-1.5 text-xs font-medium border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
                        >
                          Marquer soldée
                        </button>
                      ) : (
                        <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">Soldée le {d.dateSoldee ? formatDate(d.dateSoldee.slice(0, 10)) : ""}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
              Historique des inscriptions
            </h3>
            {inscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune inscription enregistrée</p>
            ) : (
              <div className="relative pl-6 border-l-2 border-indigo-200 space-y-4">
                {inscriptions.map((ins) => (
                  <div key={ins.id} className="relative">
                    <div className="absolute -left-[25px] top-4 w-3 h-3 rounded-full bg-indigo-500 border-2 border-card" />
                    <div className="ml-2 p-4 rounded-xl border border-border bg-muted/20">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-bold text-foreground">{ins.annee}</span>
                        <StatusBadge status={ins.statut} />
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          ins.type === "correction" ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                            : ins.type === "bascule" ? "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                            : "bg-indigo-50 text-indigo-700",
                        )}>
                          {ins.type === "premiere" ? "1ère inscription" : ins.type === "correction" ? "Correction" : ins.type === "bascule" ? "Bascule annuelle" : "Réinscription"}
                        </span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <span>Filière : <strong className="text-foreground">{ins.filiere}</strong></span>
                        <span>Niveau : <strong className="text-foreground">{ins.niveau}</strong></span>
                        <span>Classe : <strong className="text-foreground">{ins.classe}</strong></span>
                        <span>Date : {formatDate(ins.dateInscription)}</span>
                        {ins.specialite && <span>Spécialité : <strong className="text-foreground">{ins.specialite}</strong></span>}
                        {ins.modeleFrais && <span>Modèle de frais : <strong className="text-foreground">{ins.modeleFrais}</strong></span>}
                        {ins.effectuePar && <span>Effectuée par : <strong className="text-foreground">{ins.effectuePar}</strong></span>}
                        {ins.soldeDu > 0 && (
                          <span className="text-red-500 sm:col-span-2">Solde dû : {formatCFA(ins.soldeDu)}</span>
                        )}
                        {ins.type === "correction" && ins.motif && (
                          <span className="sm:col-span-2 text-amber-700 dark:text-amber-300">Motif : {ins.motif}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-8">
            {/* ===== Moyennes annuelle / programme (bulletinEngine — jamais affichées avant) ===== */}
            {(moyenneAnnuelle?.moyenne !== undefined || moyenneProgramme?.moyenne !== undefined) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {moyenneAnnuelle?.moyenne !== undefined && (
                  <div className="p-4 border border-border rounded-xl bg-muted/20">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Moyenne annuelle — {student.niveau}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{moyenneAnnuelle.moyenne.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/20</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">{moyenneAnnuelle.creditsObtenus}/{moyenneAnnuelle.creditsTotal} crédits obtenus</p>
                  </div>
                )}
                {moyenneProgramme?.moyenne !== undefined && (
                  <div className="p-4 border border-border rounded-xl bg-muted/20">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Moyenne de programme</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{moyenneProgramme.moyenne.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/20</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">{moyenneProgramme.anneesRetenues.map((a) => `${a.niveau} (${a.annee})`).join(" · ")}</p>
                  </div>
                )}
              </div>
            )}

            {/* ===== Bulletins générés (vrai pipeline : Génération → Délibération) ===== */}
            <div>
              <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Bulletins</h3>
              {studentReleves.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
                  Aucun bulletin généré pour cet étudiant pour l'instant — voir Bulletins &gt; Génération bulletins.
                </p>
              ) : (
                <div className="space-y-2">
                  {studentReleves.map((releve) => {
                    const resolved = resolveBulletin(releve, etudiants);
                    return (
                      <div key={releve.id} className="flex items-center justify-between gap-3 p-4 border border-border rounded-xl">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{releve.semestre}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {resolved ? (
                              <>Moyenne <span className="font-bold text-foreground">{resolved.moyenne.toFixed(2)}/20</span> · Mention {resolved.mention} · Décision : <span className="font-medium">{resolved.decisionLabel}</span></>
                            ) : (
                              "Bulletin indisponible pour cette session"
                            )}
                          </p>
                        </div>
                        <button
                          onClick={() => setPreviewReleve(releve)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors flex-shrink-0"
                          data-testid={`dossier-bulletin-apercu-${releve.id}`}
                        >
                          <Eye size={13} /> Aperçu
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ===== Attestations délivrées (attestationStore réel) ===== */}
            <div>
              <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Attestations délivrées</h3>
              {studentAttestations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">Aucune attestation délivrée pour cet étudiant.</p>
              ) : (
                <div className="border border-border rounded-xl divide-y divide-border">
                  {studentAttestations.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <Award size={14} className="text-primary flex-shrink-0" />
                        <span className="font-medium text-foreground">{ATTESTATION_TYPE_LABELS[a.type]}</span>
                        {a.semestreLabel && <span className="text-xs text-muted-foreground">· {a.semestreLabel}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                        <span className="font-mono">{a.numero}</span>
                        <span>{formatDate(a.dateGeneration)}</span>
                        <span className={cn("px-2 py-0.5 rounded-full font-medium", a.statut === "envoyee" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300")}>
                          {a.statut === "envoyee" ? "Envoyée" : "Générée"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ===== Détail des notes saisies (brut, par évaluation) ===== */}
            <div>
              <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Notes saisies — détail</h3>
              {studentNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune note disponible</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">EC</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Note /20</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentNotes.map((n) => (
                      <tr key={n.id} className={cn("border-b border-border last:border-0", n.note < 10 && "bg-red-50/50 dark:bg-red-950/20")}>
                        <td className="px-4 py-3 font-medium text-foreground">{n.ec}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 bg-muted text-muted-foreground rounded">{n.type}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("font-bold text-base", n.note >= 10 ? "text-emerald-600" : "text-red-500")}>
                            {n.note}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {previewReleve && (
              <BulletinPreviewModal entry={previewReleve} resolved={resolveBulletin(previewReleve, etudiants)} onClose={() => setPreviewReleve(null)} />
            )}
          </div>
        )}

        {activeTab === "paiements" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Historique des Paiements</h3>
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">Total payé : <span className="font-bold text-emerald-600">{formatCFA(totalPaye)}</span></span>
                {student.soldeDu > 0 && <span className="text-muted-foreground">Restant dû : <span className="font-bold text-red-500">{formatCFA(student.soldeDu)}</span></span>}
              </div>
            </div>
            {studentPaiements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun paiement enregistré</p>
            ) : (
              <div className="relative pl-6 border-l-2 border-primary/20 space-y-4">
                {[...studentPaiements].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
                  <div key={p.id} className="relative">
                    <div className="absolute -left-[25px] top-3 w-3 h-3 rounded-full bg-primary border-2 border-card" />
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border ml-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${MOYEN_COLORS[p.moyen] ?? "#64748b"}15` }}>
                        <CreditCard size={16} style={{ color: MOYEN_COLORS[p.moyen] ?? "#64748b" }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{p.rubrique}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(p.date)} · {p.reference} · {p.moyen}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-600">{formatCFA(p.montant)}</div>
                        <StatusBadge status={p.statut} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(studentDepots.length > 0 || studentRemboursements.length > 0) && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Historique Avoir</h3>
                  <span className="text-sm text-muted-foreground">
                    Solde actuel : <span className="font-bold text-emerald-600">{formatCFA(student.soldeAvoir)}</span>
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    ...studentDepots.map((d) => ({ id: d.id, type: "Dépôt" as const, reference: d.reference, date: d.date, montant: d.montant, annulee: d.annulee, href: `/admin/avoir/depots/${d.id}` })),
                    ...studentRemboursements.map((r) => ({ id: r.id, type: "Remboursement" as const, reference: r.reference, date: r.date, montant: r.montant, annulee: r.annulee, href: `/admin/avoir/remboursements/${r.id}` })),
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((mvt) => (
                      <div
                        key={mvt.id}
                        onClick={() => setLocation(mvt.href)}
                        className="flex items-center gap-4 p-3.5 bg-muted/30 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", mvt.type === "Dépôt" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700")}>
                          {mvt.type}
                        </span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{mvt.reference}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(mvt.date)}</div>
                        </div>
                        <div className="text-right">
                          <div className={cn("font-bold", mvt.type === "Dépôt" ? "text-emerald-600" : "text-orange-600")}>
                            {mvt.type === "Dépôt" ? "+" : "−"}{formatCFA(mvt.montant)}
                          </div>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", mvt.annulee ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                            {mvt.annulee ? "Annulé" : "Validé"}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {studentReductions.length > 0 && (
              <div className="mt-8">
                <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Historique des Réductions</h3>
                <div className="space-y-2">
                  {[...studentReductions].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                    <div
                      key={r.id}
                      onClick={() => setLocation(`/admin/reductions-frais/${r.id}`)}
                      className="flex items-center gap-4 p-3.5 bg-muted/30 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{r.reference}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(r.date)} · Taux {r.tauxApplique}%</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-orange-600">−{formatCFA(r.totalReduit)}</div>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", r.annulee ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                          {r.annulee ? "Annulée" : "Validée"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {studentFrais.length > 0 && (
              <div className="mt-8">
                <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Frais étudiant (ad-hoc)</h3>
                <div className="space-y-2">
                  {[...studentFrais].sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe)).map((l) => {
                    const statut = statutFraisEtudiant(l, studentPaiements);
                    const STATUT_META = {
                      en_attente: { label: "Non quittancé", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
                      quittance: { label: "Quittancé", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
                      annule: { label: "Annulé", cls: "bg-muted text-muted-foreground" },
                    }[statut];
                    return (
                      <div key={l.id} className="flex items-center gap-4 p-3.5 bg-muted/30 rounded-xl border border-border">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{typeFraisLabel(l.typeFraisId)} <span className="text-xs text-muted-foreground">({l.annee})</span></div>
                          <div className="text-xs text-muted-foreground">{formatDate(l.ajouteLe)}{statut === "annule" && l.motifAnnulation ? ` · Motif : ${l.motifAnnulation}` : ""}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-foreground">{formatCFA(l.montant)}</div>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_META.cls)}>{STATUT_META.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {studentReprisesEnCours.length > 0 && (
              <div className="mt-8">
                <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Reprise ancien système (en cours)</h3>
                <div className="space-y-2">
                  {[...studentReprisesEnCours].sort((a, b) => b.importeLe.localeCompare(a.importeLe)).map((r) => {
                    const meta = r.statut === "rejete"
                      ? { label: "Rejetée", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" }
                      : { label: "En attente de validation", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" };
                    return (
                      <div key={r.id} className="flex items-center gap-4 p-3.5 bg-muted/30 rounded-xl border border-border">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">Ancien code {r.ancienCode} <span className="text-xs text-muted-foreground">({r.libelleAnneeScolaire})</span></div>
                          <div className="text-xs text-muted-foreground">{formatDate(r.importeLe)}{r.statut === "rejete" && r.motifRejet ? ` · Motif : ${r.motifRejet}` : ""}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-foreground">{formatCFA(r.montant)}</div>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", meta.cls)}>{meta.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {studentDerogations.length > 0 && (
              <div className="mt-8">
                <h3 className="font-bold text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Dérogations des paiements</h3>
                <div className="space-y-2">
                  {[...studentDerogations].sort((a, b) => b.date.localeCompare(a.date)).map((d) => {
                    const statut = statutDerogation(d);
                    const STATUT_META: Record<StatutDerogation, { label: string; cls: string }> = {
                      active: { label: "Active", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
                      expiree: { label: "Expirée", cls: "bg-muted text-muted-foreground" },
                      revoquee: { label: "Révoquée", cls: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
                    };
                    return (
                      <div
                        key={d.id}
                        onClick={() => setLocation(`/admin/derogation-paiement/${d.id}`)}
                        className="flex items-center gap-4 p-3.5 bg-muted/30 rounded-xl border border-border cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{d.reference} — {PORTEE_LABELS[d.portee]}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(d.date)} · Valable jusqu&apos;au {formatDate(d.dateFin)}{statut === "revoquee" && d.motifRevocation ? ` · Motif révocation : ${d.motifRevocation}` : ""}</div>
                        </div>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_META[statut].cls)}>{STATUT_META[statut].label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "absences" && (() => {
          const studentAssiduite = getAssiduiteRowsPourEtudiant(id);
          const { pct: tauxPresence } = getTauxPresencePourEtudiant(id);
          const nbTotal = studentAssiduite.length;
          const nbJustif = studentAssiduite.filter((a) => a.justifie).length;
          const nbNonJustif = nbTotal - nbJustif;
          return (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Suivi des Absences — d&apos;après le cahier de textes</h3>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Total absences/retards", value: nbTotal, color: "text-foreground" },
                  { label: "Non justifiées", value: nbNonJustif, color: "text-red-500" },
                  { label: "Justifiées", value: nbJustif, color: "text-amber-600" },
                  { label: "Taux de présence", value: `${tauxPresence}%`, color: "text-emerald-600" },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center border border-border">
                    <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mb-5">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Taux de présence global</span>
                  <span className="font-semibold text-emerald-600">{tauxPresence}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${tauxPresence}%` }} />
                </div>
              </div>
              {studentAssiduite.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune absence ni retard enregistré</p>
              ) : (
                <div className="relative pl-6 border-l-2 border-amber-200 space-y-3">
                  {studentAssiduite.map((ab) => (
                    <div key={ab.id} className="relative">
                      <div className={cn("absolute -left-[25px] top-4 w-3 h-3 rounded-full border-2 border-card", ab.justifie ? "bg-amber-400" : "bg-red-400")} />
                      <div className={cn("flex items-center gap-4 p-4 rounded-xl border ml-2",
                        ab.justifie ? "bg-amber-50/50 border-amber-100" : "bg-red-50/50 border-red-100"
                      )}>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{ab.ec}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(ab.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · {ab.classe}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{ab.type === "absence" ? "Absence" : `Retard${ab.retardMinutes ? ` ${ab.retardMinutes}min` : ""}`}</span>
                        <div className="text-right">
                          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full",
                            ab.justifie ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                          )}>
                            {ab.justifie ? "Justifiée" : "Non justifiée"}
                          </span>
                          {ab.justification && <div className="text-[10px] text-muted-foreground mt-0.5">{ab.justification}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {activeTab === "contacts" && (
          <div className="space-y-6">
            {(["pere", "mere", "tuteur", "autre"] as ContactRole[]).map((role) => {
              const rows = studentContacts.filter((c) => c.role === role);
              const multiple = role === "tuteur" || role === "autre";
              return (
                <div key={role}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-foreground">{CONTACT_ROLE_LABELS[role]}{multiple ? "s" : ""}</h4>
                    {(multiple || rows.length === 0) && (
                      <button onClick={() => openContactModal(role)} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline" data-testid={`contact-ajouter-${role}`}>
                        <Plus size={12} /> Ajouter
                      </button>
                    )}
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Aucun contact renseigné.</p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-xl border border-border" data-testid={`contact-ligne-${c.id}`}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Phone size={13} className="text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-foreground truncate">{c.nomComplet}{c.lien ? ` — ${c.lien}` : ""}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{[c.telephone, c.email, c.adresse].filter(Boolean).join(" · ") || "—"}</div>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteContact(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "memos" && <MemosPanel entiteType="etudiant" entiteId={id} />}
        {activeTab === "documents" && <DocumentsPanel entiteType="etudiant" entiteId={id} />}
      </div>

      <FormModal open={!!contactModalRole} onClose={() => setContactModalRole(null)} title={contactModalRole ? `Ajouter — ${CONTACT_ROLE_LABELS[contactModalRole]}` : ""} size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom complet *</label>
            <input value={contactForm.nomComplet} onChange={(e) => setContactForm((f) => ({ ...f, nomComplet: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="contact-nom" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone</label>
              <input value={contactForm.telephone} onChange={(e) => setContactForm((f) => ({ ...f, telephone: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
              <input value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Adresse</label>
            <input value={contactForm.adresse} onChange={(e) => setContactForm((f) => ({ ...f, adresse: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {contactModalRole === "autre" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Lien de parenté</label>
              <input value={contactForm.lien} onChange={(e) => setContactForm((f) => ({ ...f, lien: e.target.value }))} placeholder="ex: Grand frère" className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}
          <button onClick={handleSaveContact} disabled={!contactForm.nomComplet.trim()} className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors" data-testid="contact-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>

      <FormModal open={blocageOpen} onClose={() => setBlocageOpen(false)} title="Motif de blocage" size="md">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Restreint des actions précises (accès portail, impression de documents) pour cet étudiant, sans désactiver son dossier.
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motif</label>
            <select value={motifChoisi} onChange={(e) => setMotifChoisi(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" data-testid="student-motif-select">
              <option value="">Aucun — aucune restriction</option>
              {motifsBlocage.map((m) => <option key={m.id} value={m.id}>{m.intitule}</option>)}
            </select>
          </div>
          {motifChoisi && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2">
              Actions interdites : {motifsBlocage.find((m) => m.id === motifChoisi)?.actionsInterdites.length ?? 0} action(s) — voir Paramètres → Motifs de blocage pour le détail.
            </div>
          )}
          <button
            onClick={handleSaveBlocage}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            data-testid="student-blocage-sauvegarder"
          >
            Sauvegarder
          </button>
        </div>
      </FormModal>
    </div>
  );
}
