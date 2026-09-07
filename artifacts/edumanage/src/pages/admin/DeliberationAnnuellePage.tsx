import { useMemo, useState } from "react";
import {
  Scale, CheckCircle2, XCircle, AlertOctagon, Lock, Unlock, Printer, Users, TrendingUp, Plus, ArrowLeft, Eye, X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { FILIERES, NIVEAUX, SEMESTRES } from "@/data/mockData";
import { useStudentStore, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useReglesValidation } from "@/hooks/useReglesValidationStore";
import { useNiveaux } from "@/hooks/useNiveauStore";
import { useDeliberationsAnnuelles } from "@/hooks/useDeliberationAnnuelleStore";
import {
  chargerDeliberationAnnuelle, overrideDecisionAnnuelle, cloturerDeliberationAnnuelle, reouvrirDeliberationAnnuelle,
  DECISION_ANNUELLE_LABELS,
  type DeliberationAnnuelleRecord, type DecisionAnnuelle,
} from "@/data/deliberationAnnuelleStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, cn } from "@/lib/utils";

const DECISION_CONFIG: Record<DecisionAnnuelle, { label: string; color: string; bg: string; icon: React.ElementType; border: string }> = {
  admis: { label: DECISION_ANNUELLE_LABELS.admis, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50", icon: CheckCircle2, border: "border-emerald-200 dark:border-emerald-800" },
  admis_avec_dette: { label: DECISION_ANNUELLE_LABELS.admis_avec_dette, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50", icon: AlertOctagon, border: "border-amber-200 dark:border-amber-800" },
  redouble: { label: DECISION_ANNUELLE_LABELS.redouble, color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/50", icon: XCircle, border: "border-red-200 dark:border-red-800" },
  exclu: { label: DECISION_ANNUELLE_LABELS.exclu, color: "text-zinc-700 dark:text-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-900/50", icon: XCircle, border: "border-zinc-300 dark:border-zinc-700" },
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

function buildPvHtml(deliberation: DeliberationAnnuelleRecord): string {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const rows = deliberation.lignes
    .map((l) => {
      const cfg = DECISION_CONFIG[l.decisionFinale];
      const dette = l.uesNonValidees.length > 0 ? l.uesNonValidees.map((u) => u.ueCode).join(", ") : "—";
      return `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:10px;">${l.matricule}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${l.etudiant}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;">${l.moyenneAnnuelle.toFixed(2)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;">${l.creditsObtenus}/${l.creditsTotal}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:700;">${cfg.label.toUpperCase()}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:10px;">${dette}</td>
      </tr>`;
    })
    .join("");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>PV de délibération annuelle — ${deliberation.classe}</title>
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
    <h1>Procès-verbal de délibération annuelle</h1>
    <div class="meta">
      <strong>Filière :</strong> ${deliberation.filiere} — ${deliberation.niveauLabel} — ${deliberation.annee}<br/>
      <strong>Classe :</strong> ${deliberation.classe}<br/>
      <strong>Effectuée par :</strong> ${deliberation.effectuePar} le ${formatDate(deliberation.dateDeliberation.slice(0, 10))}<br/>
      <strong>Statut :</strong> ${deliberation.statut === "cloturee" ? "Clôturée" : deliberation.statut === "reouverte" ? "Réouverte" : "En cours"}
    </div>
    <table>
      <thead><tr><th>Matricule</th><th>Étudiant</th><th style="text-align:center;">Moyenne</th><th style="text-align:center;">Crédits</th><th style="text-align:center;">Décision</th><th>UE en dette</th></tr></thead>
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

function printPv(deliberation: DeliberationAnnuelleRecord) {
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;
  win.document.write(buildPvHtml(deliberation));
  win.document.close();
}

export default function DeliberationAnnuellePage() {
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const classes = useClasses();
  const annees = useAnneesAcademiques();
  const niveaux = useNiveaux();
  const reglesValidation = useReglesValidation();
  const deliberations = useDeliberationsAnnuelles();

  const [mode, setMode] = useState<"liste" | "form" | "detail">("liste");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingEtudiantId, setEditingEtudiantId] = useState<string | null>(null);
  const [drillDownEtudiantId, setDrillDownEtudiantId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deliberations;
    return deliberations.filter((d) => `${d.classe} ${d.effectuePar}`.toLowerCase().includes(q));
  }, [deliberations, search]);

  const open = (id: string) => { setActiveId(id); setMode("detail"); };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "classe", header: "Classe", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.classe as string}</span> },
    { key: "niveauLabel", header: "Niveau", render: (r) => <span className="text-sm">{r.niveauLabel as string}</span> },
    { key: "annee", header: "Année", render: (r) => <span className="text-sm">{r.annee as string}</span> },
    { key: "effectuePar", header: "Utilisateur", render: (r) => <span className="text-sm text-muted-foreground">{r.effectuePar as string}</span> },
    {
      key: "statut", header: "Statut",
      render: (r) => {
        const s = r.statut as DeliberationAnnuelleRecord["statut"];
        return <Badge tone={s === "cloturee" ? "emerald" : s === "reouverte" ? "red" : "amber"}>{s === "cloturee" ? "Clôturée" : s === "reouverte" ? "Réouverte" : "En cours"}</Badge>;
      },
    },
    {
      key: "actions", header: "",
      render: (row) => {
        const d = row as unknown as DeliberationAnnuelleRecord;
        return (
          <button onClick={() => open(d.id)} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors">
            <Eye size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluations" }, { label: "Délibération annuelle" }]}
        title="Délibération annuelle"
        subtitle="Bilan de l'année : moyenne annuelle, crédits cumulés, passage conditionnel (AJAC)"
        actions={
          mode === "liste" ? (
            <button onClick={() => setMode("form")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Plus size={14} /> Nouvelle délibération annuelle
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Classe, utilisateur..." className={inputClass} />
          </div>
          <DataTable columns={columns} data={filtered as unknown as Record<string, unknown>[]} emptyMessage="Aucune délibération annuelle — lancez-en une nouvelle." />
        </>
      )}

      {mode === "form" && (
        <NouvelleDeliberationAnnuelleForm
          annees={annees}
          classes={classes}
          niveaux={niveaux}
          etudiants={etudiants}
          reglesValidation={reglesValidation}
          auteur={currentUser?.name ?? "Administration"}
          onCharge={(id) => open(id)}
        />
      )}

      {mode === "detail" && activeId && (
        <DetailDeliberationAnnuelle
          deliberationId={activeId}
          auteur={currentUser?.name ?? "Administration"}
          etudiants={etudiants}
          niveaux={niveaux}
          reglesValidation={reglesValidation}
          editingEtudiantId={editingEtudiantId}
          setEditingEtudiantId={setEditingEtudiantId}
          onDrillDown={setDrillDownEtudiantId}
        />
      )}

      {drillDownEtudiantId && activeId && (
        <DrillDownEtudiantAnnuel
          deliberationId={activeId}
          etudiantId={drillDownEtudiantId}
          onClose={() => setDrillDownEtudiantId(null)}
        />
      )}
    </div>
  );
}

interface FormProps {
  annees: ReturnType<typeof useAnneesAcademiques>;
  classes: ReturnType<typeof useClasses>;
  niveaux: ReturnType<typeof useNiveaux>;
  etudiants: ReturnType<typeof useStudentStore>;
  reglesValidation: ReturnType<typeof useReglesValidation>;
  auteur: string;
  onCharge: (id: string) => void;
}

function NouvelleDeliberationAnnuelleForm({ annees, classes, niveaux, etudiants, reglesValidation, auteur, onCharge }: FormProps) {
  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = niveaux.find((n) => n.id === niveauId);

  const niveauxDisponibles = useMemo(() => niveaux.filter((n) => n.filiereId === filiereId), [niveaux, filiereId]);
  const classesDisponibles = useMemo(
    () => classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee),
    [classes, filiereId, niveau, annee],
  );
  const classeChoisie = classes.find((c) => c.id === classeId);
  const semestresDuNiveau = useMemo(
    () => (filiere && niveau ? SEMESTRES.filter((s) => s.filiere === filiere.code && s.niveau === niveau.alias).map((s) => s.alias) : []),
    [filiere, niveau],
  );

  const peutContinuer = !!filiereId && !!annee && !!niveauId && !!classeId && semestresDuNiveau.length > 0;

  const handleSuivant = () => {
    if (!peutContinuer || !filiere || !niveau || !classeChoisie) return;
    const regle = reglesValidation.find((r) => r.filiereId === filiereId && r.type === "annee");
    if (!regle) {
      toast.error("Aucune règle de validation \"Année\" configurée pour cette filière (Paramétrage bulletins)");
      return;
    }
    const roster = etudiants.filter((e) => e.classeId === classeId);
    const record = chargerDeliberationAnnuelle({
      filiereId,
      filiere: `${filiere.nom} — ${filiere.code}`,
      annee,
      niveauId,
      niveauAlias: niveau.alias,
      niveauLabel: niveau.nom,
      niveau,
      classeId,
      classe: classeChoisie.nom,
      semestresAlias: semestresDuNiveau,
      etudiants: roster.map((e) => ({ id: e.id, prenom: e.prenom, nom: e.nom, matricule: e.matricule })),
      regle,
      effectuePar: auteur,
    });
    onCharge(record.id);
  };

  return (
    <div className="max-w-3xl bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <h3 className="text-sm font-bold text-foreground">Délibération annuelle</h3>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
        <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); setClasseId(""); }} className={inputClass}>
          <option value="">Sélectionner</option>
          {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>)}
        </select>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année *</label>
          <select value={annee} onChange={(e) => { setAnnee(e.target.value); setClasseId(""); }} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")}>
            <option value="">Sélectionner</option>
            {annees.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}{a.actuelle ? " (courante)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
          <select value={niveauId} onChange={(e) => { setNiveauId(e.target.value); setClasseId(""); }} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")}>
            <option value="">Sélectionner</option>
            {niveauxDisponibles.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
        <select value={classeId} onChange={(e) => setClasseId(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")}>
          <option value="">Sélectionner</option>
          {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
      </div>
      {niveauId && semestresDuNiveau.length === 0 && (
        <p className="text-xs text-amber-600">Aucun semestre configuré pour ce niveau — créez d&apos;abord ses semestres (Académiques → Semestres).</p>
      )}
      {niveau && !niveau.passageConditionnelAutorise && (
        <p className="text-[11px] text-muted-foreground">Passage conditionnel (AJAC) non activé pour ce niveau — un étudiant sous le seuil de crédits redoublera directement, sans palier intermédiaire. Modifiable dans Académiques → Niveaux.</p>
      )}
      <div className="pt-2 border-t border-border">
        <button onClick={handleSuivant} disabled={!peutContinuer} className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Suivant
        </button>
      </div>
    </div>
  );
}

function DetailDeliberationAnnuelle({
  deliberationId, auteur, etudiants, niveaux, reglesValidation, editingEtudiantId, setEditingEtudiantId, onDrillDown,
}: {
  deliberationId: string; auteur: string;
  etudiants: ReturnType<typeof useStudentStore>;
  niveaux: ReturnType<typeof useNiveaux>;
  reglesValidation: ReturnType<typeof useReglesValidation>;
  editingEtudiantId: string | null; setEditingEtudiantId: (id: string | null) => void;
  onDrillDown: (etudiantId: string) => void;
}) {
  const deliberations = useDeliberationsAnnuelles();
  const deliberation = deliberations.find((d) => d.id === deliberationId);
  const [decisionFilter, setDecisionFilter] = useState("");

  if (!deliberation) {
    return <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">Délibération introuvable.</div>;
  }

  const cloture = deliberation.statut === "cloturee";
  const displayedLignes = decisionFilter ? deliberation.lignes.filter((l) => l.decisionFinale === decisionFilter) : deliberation.lignes;

  const stats = {
    total: deliberation.lignes.length,
    admis: deliberation.lignes.filter((l) => l.decisionFinale === "admis").length,
    avecDette: deliberation.lignes.filter((l) => l.decisionFinale === "admis_avec_dette").length,
    redouble: deliberation.lignes.filter((l) => l.decisionFinale === "redouble").length,
    exclu: deliberation.lignes.filter((l) => l.decisionFinale === "exclu").length,
  };
  const tauxReussite = stats.total > 0 ? Math.round(((stats.admis + stats.avecDette) / stats.total) * 100) : 0;

  const handleOverride = (etudiantId: string, decision: DecisionAnnuelle, decisionAuto: DecisionAnnuelle) => {
    const raison = decision !== decisionAuto ? (window.prompt("Motif de la correction manuelle (optionnel) :") ?? "") : "";
    overrideDecisionAnnuelle(deliberationId, etudiantId, decision, raison, auteur);
  };

  const handleRecharger = () => {
    const filiere = FILIERES.find((f) => f.id === deliberation.filiereId);
    const niveau = niveaux.find((n) => n.id === deliberation.niveauId);
    const regle = reglesValidation.find((r) => r.filiereId === deliberation.filiereId && r.type === "annee");
    const semestresAlias = filiere && niveau ? SEMESTRES.filter((s) => s.filiere === filiere.code && s.niveau === niveau.alias).map((s) => s.alias) : [];
    if (!filiere || !niveau || !regle || semestresAlias.length === 0) {
      toast.error("Impossible de recharger — filière/niveau/règle introuvable");
      return;
    }
    const roster = etudiants.filter((e) => e.classeId === deliberation.classeId);
    chargerDeliberationAnnuelle({
      filiereId: deliberation.filiereId,
      filiere: deliberation.filiere,
      annee: deliberation.annee,
      niveauId: deliberation.niveauId,
      niveauAlias: deliberation.niveau,
      niveauLabel: deliberation.niveauLabel,
      niveau,
      classeId: deliberation.classeId,
      classe: deliberation.classe,
      semestresAlias,
      etudiants: roster.map((e) => ({ id: e.id, prenom: e.prenom, nom: e.nom, matricule: e.matricule })),
      regle,
      effectuePar: auteur,
    });
    toast.success("Délibération annuelle rechargée avec les notes actuelles");
  };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">{deliberation.filiere} / {deliberation.niveauLabel} / {deliberation.annee}</h3>
            <p className="text-sm text-muted-foreground mt-1"><Users size={12} className="inline mr-1" /> Classe : <strong className="text-foreground">{deliberation.classe}</strong></p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={cloture ? "emerald" : deliberation.statut === "reouverte" ? "red" : "amber"}>
              {cloture ? "Clôturée" : deliberation.statut === "reouverte" ? "Réouverte" : "En cours"}
            </Badge>
            <button onClick={() => printPv(deliberation)} className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors">
              <Printer size={14} /> PV de délibération
            </button>
            {!cloture && (
              <button onClick={handleRecharger} className="flex items-center gap-2 px-3.5 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors">
                Recharger
              </button>
            )}
            {cloture ? (
              <button onClick={() => { reouvrirDeliberationAnnuelle(deliberationId); toast.success("Délibération réouverte"); }} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
                <Unlock size={14} /> Réouvrir
              </button>
            ) : (
              <button
                onClick={() => {
                  cloturerDeliberationAnnuelle(deliberationId);
                  toast.success(stats.avecDette > 0 ? `Jury clôturé — ${stats.avecDette} dette(s) de crédit enregistrée(s)` : "Jury clôturé");
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Lock size={14} /> Clôturer le jury de délibération
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "#6366f1" },
          { label: "Admis", value: stats.admis, icon: CheckCircle2, color: "#10b981" },
          { label: "Admis avec dette", value: stats.avecDette, icon: AlertOctagon, color: "#f59e0b" },
          { label: "Redoublent", value: stats.redouble, icon: XCircle, color: "#ef4444" },
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
            <h3 className="text-sm font-bold text-foreground">Bilan annuel des étudiants</h3>
          </div>
          <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className="px-3 py-2 text-xs border border-border rounded-xl bg-background">
            <option value="">Statut</option>
            <option value="admis">Admis</option>
            <option value="admis_avec_dette">Admis avec dette</option>
            <option value="redouble">Redouble</option>
            <option value="exclu">Exclu</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Étudiant</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Moyenne annuelle</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Crédits</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-5 py-3">Décision</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">UE en dette</th>
                <th className="text-center text-xs font-semibold text-muted-foreground px-3 py-3">Détails</th>
              </tr>
            </thead>
            <tbody>
              {displayedLignes.map((l, i) => {
                const cfg = DECISION_CONFIG[l.decisionFinale];
                const overridden = l.decisionFinale !== l.decisionAuto;
                const editing = editingEtudiantId === l.etudiantId;
                return (
                  <tr key={l.etudiantId} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                    <td className="px-5 py-3"><div className="font-semibold text-sm text-foreground">{l.matricule} - {l.etudiant}</div></td>
                    <td className="px-3 py-3 text-center"><span className={cn("text-sm font-bold font-mono", l.moyenneAnnuelle >= 10 ? "text-emerald-600" : "text-red-600")}>{l.moyenneAnnuelle.toFixed(2)}</span></td>
                    <td className="px-3 py-3 text-center text-sm">{l.creditsObtenus}/{l.creditsTotal}</td>
                    <td className="px-5 py-3">
                      {editing && !cloture ? (
                        <div className="flex items-center gap-1 justify-center flex-wrap">
                          {(Object.keys(DECISION_CONFIG) as DecisionAnnuelle[]).map((d) => {
                            const c = DECISION_CONFIG[d];
                            const active = l.decisionFinale === d;
                            return (
                              <button
                                key={d}
                                onClick={() => { handleOverride(l.etudiantId, d, l.decisionAuto); setEditingEtudiantId(null); }}
                                title={c.label}
                                className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-all", active ? `${c.bg} ${c.color} ${c.border}` : "border-border text-muted-foreground hover:bg-muted")}
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
                          title={overridden ? `Modifié par ${l.overrideModifiePar ?? auteur}${l.overrideRaison ? " — " + l.overrideRaison : ""} (auto : ${DECISION_CONFIG[l.decisionAuto].label})` : undefined}
                        >
                          <cfg.icon size={12} />
                          {cfg.label}
                          {overridden && <span className="text-[9px] opacity-70">(auto: {DECISION_CONFIG[l.decisionAuto].label})</span>}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {l.uesNonValidees.length > 0 ? l.uesNonValidees.map((u) => u.ueCode).join(", ") : "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => onDrillDown(l.etudiantId)} className="text-xs text-primary hover:underline">Détails</button>
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

function DrillDownEtudiantAnnuel({ deliberationId, etudiantId, onClose }: { deliberationId: string; etudiantId: string; onClose: () => void }) {
  const deliberations = useDeliberationsAnnuelles();
  const deliberation = deliberations.find((d) => d.id === deliberationId);
  const ligne = deliberation?.lignes.find((l) => l.etudiantId === etudiantId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Bilan annuel — {ligne?.etudiant ?? ""}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          {!ligne ? (
            <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
          ) : ligne.uesNonValidees.length === 0 ? (
            <p className="text-sm text-emerald-600 font-medium">Toutes les UE de l&apos;année sont validées.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">UE non validées cette année ({ligne.uesNonValidees.reduce((s, u) => s + u.ueCredits, 0)} crédits en dette) :</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Semestre</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">UE</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">Crédits</th>
                  </tr>
                </thead>
                <tbody>
                  {ligne.uesNonValidees.map((u) => (
                    <tr key={`${u.semestreAlias}-${u.ueId}`} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{u.semestreAlias}</td>
                      <td className="px-3 py-2 text-foreground">{u.ueCode} — {u.ueLibelle}</td>
                      <td className="px-3 py-2 text-center">{u.ueCredits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ligne.decisionFinale === "admis_avec_dette" && (
                <p className="text-[11px] text-amber-600">Ces UE seront enregistrées comme dette de crédit à la clôture de cette délibération (consultables ensuite dans la fiche de l&apos;étudiant).</p>
              )}
            </>
          )}
          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Retour</button>
          </div>
        </div>
      </div>
    </div>
  );
}
