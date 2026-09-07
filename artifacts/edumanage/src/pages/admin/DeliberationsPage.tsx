import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Scale, CheckCircle2, XCircle, AlertTriangle, Ban, AlertOctagon,
  Lock, Unlock, Printer, Users, TrendingUp, Plus, ArrowLeft, Eye, X, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { FILIERES, NIVEAUX, SEMESTRES } from "@/data/mockData";
import { useStudentStore, useAnneesAcademiques, useCahiers } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useAbsencesPeriode } from "@/hooks/useAbsencePeriodeStore";
import { useReglesValidation } from "@/hooks/useReglesValidationStore";
import { useBulletinGenerations } from "@/hooks/useBulletinGenerationStore";
import { useDeliberations } from "@/hooks/useDeliberationStore";
import {
  chargerDeliberation, overrideDecision, cloturerDeliberation, reouvrirDeliberation, ajusterSeuilSession,
  DECISION_LABELS,
  type DeliberationRecord, type DecisionJury,
} from "@/data/deliberationStore";
import { decideValidation, type RegleValidationRecord } from "@/data/reglesValidationStore";
import { computeBulletinPourClasse } from "@/data/bulletinEngine";
import { getEvaluationsForClasseEc, getRattrapageEvaluation } from "@/data/evaluationStore";
import { getNoteForEvaluation } from "@/data/studentStore";
import { useTypesEvaluation } from "@/hooks/useTypeEvaluationStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, cn } from "@/lib/utils";

const DECISION_CONFIG: Record<DecisionJury, { label: string; color: string; bg: string; icon: React.ElementType; border: string }> = {
  admis: { label: DECISION_LABELS.admis, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50", icon: CheckCircle2, border: "border-emerald-200 dark:border-emerald-800" },
  ajourne: { label: DECISION_LABELS.ajourne, color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/50", icon: XCircle, border: "border-red-200 dark:border-red-800" },
  rattrapage: { label: DECISION_LABELS.rattrapage, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50", icon: AlertTriangle, border: "border-amber-200 dark:border-amber-800" },
  exclu: { label: DECISION_LABELS.exclu, color: "text-zinc-700 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-900/50", icon: Ban, border: "border-zinc-300 dark:border-zinc-700" },
  a_declasser: { label: DECISION_LABELS.a_declasser, color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/50", icon: AlertOctagon, border: "border-purple-200 dark:border-purple-800" },
};

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "emerald" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
  return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap", tones[tone])}>{children}</span>;
}

function buildPvHtml(deliberation: DeliberationRecord): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const rows = deliberation.lignes
    .map((l) => {
      const cfg = DECISION_CONFIG[l.decisionFinale];
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px;">${l.matricule}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${l.etudiant}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;">${l.moyenne.toFixed(2)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${l.creditsObtenus}/${l.creditsTotal}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;">${cfg.label.toUpperCase()}</td>
      </tr>`;
    })
    .join("");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>PV de délibération — ${deliberation.classe}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    body { font-family: 'Georgia', serif; font-size: 12px; color: #111827; }
    h1 { font-family: Arial, sans-serif; font-size: 18px; color: #4f46e5; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    thead th { background: #4f46e5; color: white; font-family: Arial, sans-serif; font-size: 10px; text-transform: uppercase; padding: 8px 10px; text-align: left; }
    .meta { background: #f8faff; border: 1px solid #e0e7ff; border-radius: 8px; padding: 12px 16px; margin-top: 10px; font-family: Arial, sans-serif; font-size: 11px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 40px; }
    .sig-box { border-top: 1px solid #d1d5db; padding-top: 8px; text-align: center; font-family: Arial, sans-serif; font-size: 10px; color: #6b7280; }
  </style>
  </head><body>
    <h1>Procès-verbal de délibération</h1>
    <div class="meta">
      <strong>Filière :</strong> ${deliberation.filiere} — ${deliberation.niveauLabel} — ${deliberation.annee}<br/>
      <strong>Classe :</strong> ${deliberation.classe} &nbsp;|&nbsp; <strong>Session :</strong> ${deliberation.semestre}<br/>
      <strong>Effectuée par :</strong> ${deliberation.effectuePar} le ${formatDate(deliberation.dateDeliberation.slice(0, 10))}<br/>
      <strong>Statut :</strong> ${deliberation.statut === "cloturee" ? "Clôturée" : deliberation.statut === "reouverte" ? "Réouverte" : "En cours"}
    </div>
    <table>
      <thead><tr><th>Matricule</th><th>Étudiant</th><th style="text-align:center;">Moyenne</th><th style="text-align:center;">Crédits</th><th style="text-align:center;">Décision</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="signatures">
      <div class="sig-box">Le Président du jury<br/><br/><br/>Signature</div>
      <div class="sig-box">Le Secrétaire<br/><br/><br/>Signature</div>
      <div class="sig-box">Fait le ${now}</div>
    </div>
    <script>window.onload = function(){ window.print(); }</script>
  </body></html>`;
}

function printPv(deliberation: DeliberationRecord) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;
  win.document.write(buildPvHtml(deliberation));
  win.document.close();
}

export default function DeliberationsPage() {
  const [, setLocation] = useLocation();
  const urlSearch = useSearch();
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const classes = useClasses();
  const annees = useAnneesAcademiques();
  const reglesValidation = useReglesValidation();
  const generations = useBulletinGenerations();
  const deliberations = useDeliberations();
  useCahiers(); // souscription pour re-rendre quand un cahier (donc l'assiduité réelle) change
  useAbsencesPeriode(); // idem pour les couvertures par période

  const [mode, setMode] = useState<"liste" | "form" | "detail">("liste");
  const [activeDeliberationId, setActiveDeliberationId] = useState<string | null>(null);
  const [bloqueSansGeneration, setBloqueSansGeneration] = useState<{ filiere: string; classe: string; semestre: string } | null>(null);
  const [search, setSearch] = useState("");
  const [drillDownEtudiantId, setDrillDownEtudiantId] = useState<string | null>(null);
  const [editingEtudiantId, setEditingEtudiantId] = useState<string | null>(null);

  // Ouverture directe depuis un lien externe (ex. "Voir la délibération de cette classe" depuis
  // le Rattrapage) : si une délibération existe déjà pour ce classeId/semestreId, l'ouvrir tout
  // de suite plutôt que de laisser l'admin la rechercher dans la liste.
  useEffect(() => {
    const params = new URLSearchParams(urlSearch);
    const classeId = params.get("classeId");
    const semestreId = params.get("semestreId");
    if (!classeId || !semestreId) return;
    const match = deliberations.find((d) => d.classeId === classeId && d.semestreId === semestreId);
    if (match) {
      setActiveDeliberationId(match.id);
      setBloqueSansGeneration(null);
      setMode("detail");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lecture des query params une seule fois au montage
  }, []);

  const filteredDeliberations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deliberations;
    return deliberations.filter((d) => `${d.classe} ${d.semestre} ${d.effectuePar}`.toLowerCase().includes(q));
  }, [deliberations, search]);

  const openDeliberation = (id: string) => { setActiveDeliberationId(id); setBloqueSansGeneration(null); setMode("detail"); };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "classe", header: "Classe", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.classe as string}</span> },
    { key: "semestre", header: "Session", render: (r) => <span className="text-sm">{r.semestre as string}</span> },
    { key: "effectuePar", header: "Utilisateur", render: (r) => <span className="text-sm text-muted-foreground">{r.effectuePar as string}</span> },
    { key: "dateDeliberation", header: "Date délibération", render: (r) => <span className="text-xs text-muted-foreground">{formatDate((r.dateDeliberation as string).slice(0, 10))}</span> },
    {
      key: "statut", header: "Statut",
      render: (r) => {
        const s = r.statut as DeliberationRecord["statut"];
        return <Badge tone={s === "cloturee" ? "emerald" : s === "reouverte" ? "red" : "amber"}>{s === "cloturee" ? "Clôturée" : s === "reouverte" ? "Réouverte" : "En cours"}</Badge>;
      },
    },
    {
      key: "actions", header: "",
      render: (row) => {
        const d = row as unknown as DeliberationRecord;
        return (
          <button onClick={() => openDeliberation(d.id)} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors" data-testid={`deliberation-ouvrir-${d.id}`}>
            <Eye size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluations" }, { label: "Délibération" }]}
        title="Délibération"
        subtitle="Décisions du jury à partir des bulletins réellement générés"
        actions={
          mode === "liste" ? (
            <button onClick={() => setMode("form")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="deliberation-nouvelle-bouton">
              <Plus size={14} /> Nouvelle délibération
            </button>
          ) : (
            <button onClick={() => setMode("liste")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
              <ArrowLeft size={15} /> Retour
            </button>
          )
        }
      />

      {mode === "liste" && (
        <>
          <div className="mb-4 max-w-sm">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Classe, session, utilisateur..." className={inputClass} data-testid="deliberation-recherche" />
          </div>
          <DataTable
            columns={columns}
            data={filteredDeliberations as unknown as Record<string, unknown>[]}
            emptyMessage="Aucune délibération — lancez-en une nouvelle."
          />
        </>
      )}

      {mode === "form" && (
        <NouvelleDeliberationForm
          annees={annees}
          classes={classes}
          etudiants={etudiants}
          reglesValidation={reglesValidation}
          generations={generations}
          auteur={currentUser?.name ?? "Administration"}
          onCharge={(id) => openDeliberation(id)}
          onBloque={(info) => { setBloqueSansGeneration(info); setMode("detail"); }}
        />
      )}

      {mode === "detail" && bloqueSansGeneration && (
        <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h3 className="text-base font-bold text-foreground">{bloqueSansGeneration.filiere}</h3>
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground">Classe : <strong className="text-foreground">{bloqueSansGeneration.classe}</strong></span>
              <span className="text-sm text-muted-foreground">Session : <strong className="text-foreground">{bloqueSansGeneration.semestre}</strong></span>
            </div>
          </div>
          <p className="text-sm font-medium text-red-600" data-testid="deliberation-aucun-bulletin">Aucun bulletin n'a encore été généré pour cette classe.</p>
          <p className="text-xs text-muted-foreground mt-1">La délibération s'appuie sur des bulletins réellement générés — lancez d'abord une génération pour cette classe et cette session.</p>
          <button onClick={() => setLocation("/admin/releves")} className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="deliberation-aller-generation">
            Aller à la génération de bulletin
          </button>
        </div>
      )}

      {mode === "detail" && !bloqueSansGeneration && activeDeliberationId && (
        <DetailDeliberation
          deliberationId={activeDeliberationId}
          auteur={currentUser?.name ?? "Administration"}
          etudiants={etudiants}
          reglesValidation={reglesValidation}
          editingEtudiantId={editingEtudiantId}
          setEditingEtudiantId={setEditingEtudiantId}
          onDrillDown={setDrillDownEtudiantId}
        />
      )}

      {drillDownEtudiantId && activeDeliberationId && (
        <DrillDownEtudiant
          deliberationId={activeDeliberationId}
          etudiantId={drillDownEtudiantId}
          onClose={() => setDrillDownEtudiantId(null)}
        />
      )}
    </div>
  );
}

interface NouvelleDeliberationFormProps {
  annees: ReturnType<typeof useAnneesAcademiques>;
  classes: ReturnType<typeof useClasses>;
  etudiants: ReturnType<typeof useStudentStore>;
  reglesValidation: ReturnType<typeof useReglesValidation>;
  generations: ReturnType<typeof useBulletinGenerations>;
  auteur: string;
  onCharge: (id: string) => void;
  onBloque: (info: { filiere: string; classe: string; semestre: string }) => void;
}

function NouvelleDeliberationForm({ annees, classes, etudiants, reglesValidation, generations, auteur, onCharge, onBloque }: NouvelleDeliberationFormProps) {
  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const semestre = SEMESTRES.find((s) => s.id === semestreId);

  const niveauxDisponibles = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const classesDisponibles = useMemo(
    () => classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee),
    [classes, filiereId, niveau, annee],
  );
  const semestresDisponibles = useMemo(
    () => SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias),
    [filiere, niveau],
  );
  const classeChoisie = classes.find((c) => c.id === classeId);

  const peutContinuer = !!filiereId && !!annee && !!niveauId && !!classeId && !!semestreId;

  const handleSuivant = () => {
    if (!peutContinuer || !filiere || !niveau || !semestre || !classeChoisie) return;
    const semestreLabel = `${semestre.nom} (${semestre.alias})`;

    const aDesBulletins = generations.some((g) => g.classeId === classeId && g.semestreId === semestreId && g.nbSucces > 0);
    if (!aDesBulletins) {
      onBloque({ filiere: `${filiere.nom} — ${niveau.nom} — ${annee}`, classe: classeChoisie.nom, semestre: semestreLabel });
      return;
    }

    const regle = reglesValidation.find((r) => r.filiereId === filiereId && r.type === "semestre");
    if (!regle) {
      toast.error("Aucune règle de validation configurée pour cette filière (Paramétrage bulletins)");
      return;
    }

    const roster = etudiants.filter((e) => e.classeId === classeId);
    const record = chargerDeliberation({
      filiereId,
      filiere: `${filiere.nom} — ${filiere.code}`,
      annee,
      niveauAlias: niveau.alias,
      niveauLabel: niveau.nom,
      classeId,
      classe: classeChoisie.nom,
      semestreId,
      semestreAlias: semestre.alias,
      semestreLabel,
      etudiants: roster.map((e) => ({ id: e.id, prenom: e.prenom, nom: e.nom, matricule: e.matricule })),
      regle,
      effectuePar: auteur,
    });
    onCharge(record.id);
  };

  return (
    <div className="max-w-3xl bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <h3 className="text-sm font-bold text-foreground">Délibération</h3>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
        <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); setClasseId(""); setSemestreId(""); }} className={inputClass} data-testid="deliberation-filiere">
          <option value="">Sélectionner</option>
          {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>)}
        </select>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année *</label>
          <select value={annee} onChange={(e) => { setAnnee(e.target.value); setClasseId(""); }} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="deliberation-annee">
            <option value="">Sélectionner</option>
            {annees.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}{a.actuelle ? " (courante)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
          <select value={niveauId} onChange={(e) => { setNiveauId(e.target.value); setClasseId(""); setSemestreId(""); }} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="deliberation-niveau">
            <option value="">Sélectionner</option>
            {niveauxDisponibles.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
          </select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
          <select value={classeId} onChange={(e) => setClasseId(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="deliberation-classe">
            <option value="">Sélectionner</option>
            {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
          <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="deliberation-semestre">
            <option value="">Sélectionner</option>
            {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
          </select>
        </div>
      </div>
      <div className="pt-2 border-t border-border">
        <button onClick={handleSuivant} disabled={!peutContinuer} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-testid="deliberation-suivant">
          Suivant
        </button>
      </div>
    </div>
  );
}

function DetailDeliberation({
  deliberationId, auteur, etudiants, reglesValidation, editingEtudiantId, setEditingEtudiantId, onDrillDown,
}: {
  deliberationId: string; auteur: string;
  etudiants: ReturnType<typeof useStudentStore>;
  reglesValidation: ReturnType<typeof useReglesValidation>;
  editingEtudiantId: string | null; setEditingEtudiantId: (id: string | null) => void;
  onDrillDown: (etudiantId: string) => void;
}) {
  const deliberations = useDeliberations();
  const deliberation = deliberations.find((d) => d.id === deliberationId);
  const [decisionFilter, setDecisionFilter] = useState("");

  if (!deliberation) {
    return <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">Délibération introuvable.</div>;
  }

  const cloture = deliberation.statut === "cloturee";
  const regleSemestre = reglesValidation.find((r) => r.filiereId === deliberation.filiereId && r.type === "semestre");

  const handleRecharger = () => {
    const semestre = SEMESTRES.find((s) => s.id === deliberation.semestreId);
    const regle = reglesValidation.find((r) => r.filiereId === deliberation.filiereId && r.type === "semestre");
    if (!semestre || !regle) {
      toast.error("Impossible de recharger — filière/session introuvable ou règle de validation manquante");
      return;
    }
    const roster = etudiants.filter((e) => e.classeId === deliberation.classeId);
    chargerDeliberation({
      filiereId: deliberation.filiereId,
      filiere: deliberation.filiere,
      annee: deliberation.annee,
      niveauAlias: deliberation.niveau,
      niveauLabel: deliberation.niveauLabel,
      classeId: deliberation.classeId,
      classe: deliberation.classe,
      semestreId: deliberation.semestreId,
      semestreAlias: semestre.alias,
      semestreLabel: deliberation.semestre,
      etudiants: roster.map((e) => ({ id: e.id, prenom: e.prenom, nom: e.nom, matricule: e.matricule })),
      regle,
      effectuePar: auteur,
    });
    toast.success("Délibération rechargée avec les notes actuelles");
  };
  const displayedLignes = decisionFilter ? deliberation.lignes.filter((l) => l.decisionFinale === decisionFilter) : deliberation.lignes;

  const stats = {
    total: deliberation.lignes.length,
    admis: deliberation.lignes.filter((l) => l.decisionFinale === "admis").length,
    ajourne: deliberation.lignes.filter((l) => l.decisionFinale === "ajourne").length,
    rattrapage: deliberation.lignes.filter((l) => l.decisionFinale === "rattrapage").length,
    exclu: deliberation.lignes.filter((l) => l.decisionFinale === "exclu").length,
    aDeclasser: deliberation.lignes.filter((l) => l.decisionFinale === "a_declasser").length,
  };
  const tauxReussite = stats.total > 0 ? Math.round((stats.admis / stats.total) * 100) : 0;
  const moyGeneral = stats.total > 0 ? (deliberation.lignes.reduce((s, l) => s + l.moyenne, 0) / stats.total).toFixed(2) : "—";

  const handleOverride = (etudiantId: string, decision: DecisionJury, decisionAuto: DecisionJury) => {
    const raison = decision !== decisionAuto ? (window.prompt("Motif de la correction manuelle (optionnel) :") ?? "") : "";
    overrideDecision(deliberationId, etudiantId, decision, raison, auteur);
  };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">{deliberation.filiere} / {deliberation.niveauLabel} / {deliberation.annee}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              <Users size={12} className="inline mr-1" /> Classe : <strong className="text-foreground">{deliberation.classe}</strong>
              {" · "}Session : <strong className="text-foreground">{deliberation.semestre}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={cloture ? "emerald" : deliberation.statut === "reouverte" ? "red" : "amber"}>
              {cloture ? "Clôturée" : deliberation.statut === "reouverte" ? "Réouverte" : "En cours"}
            </Badge>
            <button onClick={() => printPv(deliberation)} className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors" data-testid="deliberation-pv">
              <Printer size={14} /> PV de délibération
            </button>
            {!cloture && (
              <button onClick={handleRecharger} className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors" title="Recalculer les moyennes et décisions avec les notes actuelles (ex. après un rattrapage)" data-testid="deliberation-recharger">
                <RotateCcw size={14} /> Recharger
              </button>
            )}
            {cloture ? (
              <button onClick={() => { reouvrirDeliberation(deliberationId); toast.success("Délibération réouverte"); }} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors" data-testid="deliberation-reouvrir">
                <Unlock size={14} /> Réouvrir
              </button>
            ) : (
              <button onClick={() => { cloturerDeliberation(deliberationId); toast.success("Jury clôturé"); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors" data-testid="deliberation-cloturer">
                <Lock size={14} /> Clôturer le jury de délibération
              </button>
            )}
          </div>
        </div>
      </div>

      {deliberation.seuilOverride !== undefined && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-300">
          <Scale size={13} className="shrink-0" />
          <span>
            Seuil de session ajusté à <strong>{deliberation.seuilOverride}</strong> par <strong>{deliberation.seuilOverrideModifiePar}</strong>
            {deliberation.seuilOverrideModifieLe ? ` le ${formatDate(deliberation.seuilOverrideModifieLe.slice(0, 10))}` : ""}
            {deliberation.seuilOverrideRaison ? ` — motif : ${deliberation.seuilOverrideRaison}` : ""}
          </span>
        </div>
      )}

      {!cloture && regleSemestre && (
        <SeuilSimulateur deliberation={deliberation} regle={regleSemestre} auteur={auteur} />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "#6366f1" },
          { label: "Admis", value: stats.admis, icon: CheckCircle2, color: "#10b981" },
          { label: "Rattrapage", value: stats.rattrapage, icon: AlertTriangle, color: "#f59e0b" },
          { label: "Ajournés", value: stats.ajourne, icon: XCircle, color: "#ef4444" },
          { label: "Exclus", value: stats.exclu, icon: Ban, color: "#71717a" },
          { label: "À déclasser", value: stats.aDeclasser, icon: AlertOctagon, color: "#9333ea" },
          { label: "Taux réussite", value: `${tauxReussite}%`, icon: TrendingUp, color: "#4f46e5" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
            <Icon size={18} style={{ color }} className="mx-auto mb-1.5" />
            <div className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Liste des bulletins de note</h3>
          </div>
          <div className="flex items-center gap-3">
            <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className="px-3 py-2 text-xs border border-border rounded-xl bg-background" data-testid="deliberation-filtre-statut">
              <option value="">Statut</option>
              <option value="admis">Admis</option>
              <option value="ajourne">Ajourné</option>
              <option value="rattrapage">Rattrapage</option>
              <option value="exclu">Exclu</option>
            </select>
            <span className="text-xs text-muted-foreground">Moyenne générale : <span className="font-bold text-foreground font-mono">{moyGeneral}/20</span></span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Étudiant</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Moyenne</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Crédits obtenus</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Crédits Total</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-5 py-3">Résultats</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Détails</th>
              </tr>
            </thead>
            <tbody>
              {displayedLignes.map((l, i) => {
                const cfg = DECISION_CONFIG[l.decisionFinale];
                const overridden = l.decisionFinale !== l.decisionAuto;
                const editing = editingEtudiantId === l.etudiantId;
                return (
                  <tr key={l.etudiantId} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")} data-testid={`deliberation-ligne-${l.etudiantId}`}>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-sm text-foreground">{l.matricule} - {l.etudiant}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn("text-sm font-bold font-mono", l.moyenne >= 10 ? "text-emerald-600" : "text-red-600")}>{l.moyenne.toFixed(2)}</span>
                    </td>
                    <td className="px-3 py-3 text-center text-sm">{l.creditsObtenus}</td>
                    <td className="px-3 py-3 text-center text-sm">{l.creditsTotal}</td>
                    <td className="px-5 py-3">
                      {editing && !cloture ? (
                        <div className="flex items-center gap-1 justify-center flex-wrap">
                          {(Object.keys(DECISION_CONFIG) as DecisionJury[]).map((d) => {
                            const c = DECISION_CONFIG[d];
                            const active = l.decisionFinale === d;
                            return (
                              <button
                                key={d}
                                onClick={() => { handleOverride(l.etudiantId, d, l.decisionAuto); setEditingEtudiantId(null); }}
                                title={c.label}
                                className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-all", active ? `${c.bg} ${c.color} ${c.border}` : "border-border text-muted-foreground hover:bg-muted")}
                                data-testid={`deliberation-decision-${l.etudiantId}-${d}`}
                              >
                                <c.icon size={11} />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <button
                          onClick={() => !cloture && setEditingEtudiantId(l.etudiantId)}
                          disabled={cloture}
                          className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border mx-auto", cfg.bg, cfg.color, cfg.border, cloture ? "cursor-default" : "cursor-pointer hover:opacity-80")}
                          data-testid={`deliberation-badge-${l.etudiantId}`}
                          title={
                            overridden
                              ? `Modifié par ${l.overrideModifiePar ?? auteur}${l.overrideRaison ? " — " + l.overrideRaison : ""} (auto : ${DECISION_CONFIG[l.decisionAuto].label})`
                              : l.raisonsDeclassement && l.raisonsDeclassement.length > 0
                                ? l.raisonsDeclassement.map((r) => `${r.ecLibelle} — ${r.typeEvaluationLabel} : ${r.nbNotesReelles}/${r.nbNotesRequis} note(s)`).join(" · ")
                                : undefined
                          }
                        >
                          <cfg.icon size={12} />
                          {cfg.label}
                          {overridden && <span className="text-[9px] opacity-70">(auto: {DECISION_CONFIG[l.decisionAuto].label})</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => onDrillDown(l.etudiantId)} className="text-xs text-primary hover:underline" data-testid={`deliberation-details-${l.etudiantId}`}>
                        Détails
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Simulateur de seuil de session (péréquation) : le jury peut déplacer le seuil de moyenne de
 * passage retenu pour CETTE délibération et voir en direct combien d'étudiants basculeraient,
 * avant de valider (avec motif obligatoire) — jamais une modification silencieuse ni un
 * changement du paramétrage global (regle.moyennePassage). Les décisions déjà corrigées
 * manuellement par le jury (decisionFinale !== decisionAuto) ne bougent jamais avec le curseur. */
function SeuilSimulateur({ deliberation, regle, auteur }: { deliberation: DeliberationRecord; regle: RegleValidationRecord; auteur: string }) {
  const seuilActuel = deliberation.seuilOverride ?? regle.moyennePassage;
  const [open, setOpen] = useState(false);
  const [seuil, setSeuil] = useState(seuilActuel);

  useEffect(() => { setSeuil(seuilActuel); }, [seuilActuel]);

  const lignesAutomatiques = deliberation.lignes.filter((l) => l.decisionFinale === l.decisionAuto && l.decisionAuto !== "a_declasser");
  const simulation = useMemo(() => {
    const regleSimulee: RegleValidationRecord = { ...regle, moyennePassage: seuil };
    const counts: Record<DecisionJury, number> = { admis: 0, ajourne: 0, rattrapage: 0, exclu: 0, a_declasser: 0 };
    for (const l of deliberation.lignes) {
      if (l.decisionFinale !== l.decisionAuto || l.decisionAuto === "a_declasser") { counts[l.decisionFinale]++; continue; }
      counts[decideValidation(l.moyenne, l.creditsObtenus, l.absences, regleSimulee)]++;
    }
    return counts;
  }, [seuil, deliberation.lignes, regle]);

  const bascules = useMemo(() => {
    const regleSimulee: RegleValidationRecord = { ...regle, moyennePassage: seuil };
    return lignesAutomatiques.filter((l) => decideValidation(l.moyenne, l.creditsObtenus, l.absences, regleSimulee) !== l.decisionAuto);
  }, [seuil, lignesAutomatiques, regle]);

  const handleAppliquer = () => {
    if (seuil === seuilActuel) return;
    const raison = window.prompt(`Motif de l'ajustement du seuil de cette session (${seuilActuel} → ${seuil}) :`) ?? "";
    if (!raison.trim()) {
      toast.error("Un motif est requis pour ajuster le seuil de session");
      return;
    }
    ajusterSeuilSession(deliberation.id, seuil, raison.trim(), auteur, regle);
    toast.success(`Seuil de session ajusté à ${seuil}`);
    setOpen(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center justify-between w-full text-left" data-testid="deliberation-seuil-toggle">
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Simulateur de seuil de session</h3>
            <p className="text-xs text-muted-foreground">
              Seuil actuel : <strong className="text-foreground">{seuilActuel}</strong>
              {deliberation.seuilOverride !== undefined ? " (ajusté pour cette session)" : " (standard de la règle de validation)"}
            </p>
          </div>
        </div>
        <span className="text-xs text-primary font-medium shrink-0">{open ? "Réduire" : "Ajuster"}</span>
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="range" min={0} max={20} step={0.25} value={seuil}
              onChange={(e) => setSeuil(parseFloat(e.target.value))}
              className="flex-1" data-testid="deliberation-seuil-slider"
            />
            <span className="font-mono text-lg font-bold text-foreground w-16 text-right">{seuil.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-3">
              <div className="text-xl font-bold text-emerald-600">{simulation.admis}</div>
              <div className="text-[10px] text-muted-foreground">Admis</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/40 rounded-xl p-3">
              <div className="text-xl font-bold text-amber-600">{simulation.rattrapage}</div>
              <div className="text-[10px] text-muted-foreground">Rattrapage</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/40 rounded-xl p-3">
              <div className="text-xl font-bold text-red-600">{simulation.ajourne}</div>
              <div className="text-[10px] text-muted-foreground">Ajournés</div>
            </div>
          </div>
          {bascules.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {bascules.length} étudiant(s) basculeraient avec ce seuil : {bascules.map((l) => l.etudiant).join(", ")}
            </p>
          )}
          <button
            onClick={handleAppliquer}
            disabled={seuil === seuilActuel}
            className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="deliberation-seuil-appliquer"
          >
            Valider ce seuil pour cette session
          </button>
        </div>
      )}
    </div>
  );
}

function DrillDownEtudiant({ deliberationId, etudiantId, onClose }: { deliberationId: string; etudiantId: string; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const deliberations = useDeliberations();
  const deliberation = deliberations.find((d) => d.id === deliberationId);
  const ligne = deliberation?.lignes.find((l) => l.etudiantId === etudiantId);
  const semestreAlias = SEMESTRES.find((s) => s.id === deliberation?.semestreId)?.alias;
  const bulletin = deliberation && semestreAlias ? computeBulletinPourClasse(etudiantId, deliberation.classeId, semestreAlias) : undefined;
  const [notesEc, setNotesEc] = useState<{ id: string; libelle: string } | null>(null);
  const niveauId = deliberation ? NIVEAUX.find((n) => n.filiereId === deliberation.filiereId && n.alias === deliberation.niveau)?.id : undefined;

  const allerAuRattrapage = (ecId: string) => {
    if (!deliberation) return;
    const params = new URLSearchParams({
      filiereId: deliberation.filiereId,
      annee: deliberation.annee,
      niveauId: niveauId ?? "",
      classeId: deliberation.classeId,
      semestreId: deliberation.semestreId,
      ecId,
    });
    setLocation(`/admin/notes/rattrapage?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Consultation bulletin étudiant — {ligne?.etudiant ?? ""}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6">
          {!bulletin || bulletin.ues.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun détail disponible pour cet étudiant.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Unité enseignement</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Module</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Note CC</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Note Ex</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Moyenne module</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Moyenne UE</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Crédit UE</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {bulletin.ues.flatMap((ue) =>
                  ue.ecs.map((ec, i) => (
                    <tr key={ec.id} className="border-b border-border last:border-0">
                      {i === 0 && (
                        <td className="px-3 py-2 align-top font-medium text-foreground" rowSpan={ue.ecs.length}>{ue.code} - {ue.libelle}</td>
                      )}
                      <td className="px-3 py-2 text-muted-foreground">
                        {ec.libelle}
                        {ec.ef !== undefined && ec.moyenne !== undefined && ec.moyenne < 10 && (
                          <button
                            onClick={() => allerAuRattrapage(ec.id)}
                            className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 hover:opacity-80"
                            title="Aller au rattrapage de ce module"
                            data-testid={`deliberation-rattrapage-${ec.id}`}
                          >
                            Rattrapage
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">{ec.cc !== undefined ? ec.cc.toFixed(2) : "—"}</td>
                      <td className="px-3 py-2 text-center">{ec.ef !== undefined ? ec.ef.toFixed(2) : "—"}</td>
                      <td className="px-3 py-2 text-center font-semibold">{ec.moyenne !== undefined ? ec.moyenne.toFixed(2) : "—"}</td>
                      {i === 0 && (
                        <td className="px-3 py-2 text-center align-top font-semibold text-primary" rowSpan={ue.ecs.length}>{ue.moyenne !== undefined ? ue.moyenne.toFixed(2) : "—"}</td>
                      )}
                      {i === 0 && (
                        <td className="px-3 py-2 text-center align-top" rowSpan={ue.ecs.length}>{ue.credits}</td>
                      )}
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => setNotesEc({ id: ec.id, libelle: ec.libelle })}
                          className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors"
                          title="Les notes de l'étudiant"
                          data-testid={`deliberation-notes-ec-${ec.id}`}
                        >
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          )}
          <div className="flex justify-end pt-4">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Retour</button>
          </div>
        </div>
      </div>

      {notesEc && deliberation && (
        <NotesEtudiantModal
          classeId={deliberation.classeId}
          semestreId={deliberation.semestreId}
          ecId={notesEc.id}
          ecLibelle={notesEc.libelle}
          etudiantId={etudiantId}
          annee={deliberation.annee}
          onClose={() => setNotesEc(null)}
        />
      )}
    </div>
  );
}

/** "Les notes de l'étudiant" — détail des évaluations brutes derrière la moyenne d'un module :
 * une ligne par évaluation réellement planifiée (Nouvelle évaluation) pour cet EC/classe, avec la
 * note de l'étudiant si elle existe. Rend visible ce que la composite CC/EF agrège quand un EC a
 * plusieurs devoirs/examens (Regroupement type de devoir) — jamais une seule ligne fabriquée. */
function NotesEtudiantModal({
  classeId, semestreId, ecId, ecLibelle, etudiantId, annee, onClose,
}: {
  classeId: string; semestreId: string; ecId: string; ecLibelle: string; etudiantId: string; annee: string; onClose: () => void;
}) {
  const typesEvaluation = useTypesEvaluation();
  const rattrapage = getRattrapageEvaluation(classeId, ecId, semestreId);
  const evaluations = [...getEvaluationsForClasseEc(classeId, ecId), ...(rattrapage ? [rattrapage] : [])];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 bg-primary text-white rounded-t-2xl">
          <h3 className="text-base font-bold">Les notes de l'étudiant</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6">
          {evaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune évaluation planifiée pour {ecLibelle}.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Année</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Cours</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Professeur</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Date évaluation</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Type évaluation</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Note</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((ev) => {
                  const note = getNoteForEvaluation(etudiantId, ev.id);
                  const typeLabel = ev.typeEvaluationId
                    ? typesEvaluation.find((t) => t.id === ev.typeEvaluationId)?.intitule
                    : undefined;
                  return (
                    <tr key={ev.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{annee}</td>
                      <td className="px-3 py-2 text-foreground">{ecLibelle}</td>
                      <td className="px-3 py-2 text-muted-foreground">{ev.professeur}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{formatDate(ev.dateCreation)}</td>
                      <td className="px-3 py-2 text-center">{typeLabel ?? (ev.type === "devoir" ? "Devoir" : "Examen")}{ev.session === "rattrapage" ? " (rattrapage)" : ""}</td>
                      <td className="px-3 py-2 text-center font-semibold">{note ? note.note.toFixed(2) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="flex justify-end pt-4">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </div>
      </div>
    </div>
  );
}

