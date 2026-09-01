import { useMemo, useState } from "react";
import { Eye, X, Printer, Plus, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { FILIERES, NIVEAUX, SEMESTRES } from "@/data/mockData";
import { useReleves, useStudentStore, useAnneesAcademiques, useNotes } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import type { ReleveRecord, EtudiantRecord } from "@/data/studentStore";
import { computeBulletin, type UeMoyenne } from "@/data/bulletinEngine";
import { resoudreMention } from "@/data/mentionsStore";
import { useMentions } from "@/hooks/useMentionsStore";
import { useScolariteConfigs } from "@/hooks/useScolariteConfigStore";
import { resolveCodeMethodeCalcul } from "@/data/scolariteConfigStore";
import { useMethodesCalcul } from "@/hooks/useBulletinMethodesStore";
import { useBulletinGenerations } from "@/hooks/useBulletinGenerationStore";
import { creerGeneration, type BulletinGenerationRecord, type EtudiantConcerneGeneration } from "@/data/bulletinGenerationStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, cn } from "@/lib/utils";

type ReleverEntry = ReleveRecord;

interface BulletinResolu {
  etudiant: EtudiantRecord;
  ues: UeMoyenne[];
  moyenne: number;
  mention: string;
  creditsObtenus: number;
  creditsTotal: number;
  rang?: number;
  totalClasse: number;
}

/** Résout un ReleveRecord (qui ne stocke qu'un nom de filière et de classe, pas leurs id) vers
 * le vrai bulletin de l'étudiant via le même moteur que Bulletin étudiants — remplace UE_LINES
 * et MOYENNES_PROMO, entièrement fabriqués et identiques pour n'importe quel étudiant. */
function resolveBulletin(entry: ReleverEntry, etudiants: EtudiantRecord[]): BulletinResolu | undefined {
  const etudiant = etudiants.find((e) => e.id === entry.etudiantId);
  if (!etudiant) return undefined;
  const filiereObj = FILIERES.find((f) => f.code === entry.filiere) ?? FILIERES.find((f) => f.id === etudiant.filiereId);
  const semestreObj = SEMESTRES.find((s) => `${s.nom} (${s.alias})` === entry.semestre);
  if (!filiereObj || !semestreObj) return undefined;

  const bulletin = computeBulletin(etudiant.id, etudiant.classeId, filiereObj.id, etudiant.niveau, semestreObj.alias);
  if (bulletin.moyenneSession === undefined) return undefined;

  // Rang réel au sein de la classe actuelle de l'étudiant, sur la même session.
  const roster = etudiants.filter((e) => e.classeId === etudiant.classeId);
  const moyennesClasse = roster
    .map((e) => ({ id: e.id, moy: computeBulletin(e.id, etudiant.classeId, filiereObj.id, etudiant.niveau, semestreObj.alias).moyenneSession }))
    .filter((r): r is { id: string; moy: number } => r.moy !== undefined)
    .sort((a, b) => b.moy - a.moy);
  const rangIndex = moyennesClasse.findIndex((r) => r.id === etudiant.id);

  return {
    etudiant,
    ues: bulletin.ues,
    moyenne: bulletin.moyenneSession,
    mention: resoudreMention("moyenneSession", bulletin.moyenneSession, bulletin.moyenneSession >= 10).mention ?? "—",
    creditsObtenus: bulletin.creditsObtenus,
    creditsTotal: bulletin.creditsTotal,
    rang: rangIndex >= 0 ? rangIndex + 1 : undefined,
    totalClasse: moyennesClasse.length,
  };
}

function buildPrintHtml(entry: ReleverEntry, resolved: BulletinResolu | undefined) {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  if (!resolved) {
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Relevé indisponible</title></head>
      <body style="font-family:sans-serif;padding:40px;text-align:center;color:#6b7280;">
        <p>Bulletin indisponible pour ${entry.etudiant} — notes insuffisantes pour cette session.</p>
      </body></html>`;
  }
  const { moyenne: moy, mention, creditsObtenus, creditsTotal, rang, totalClasse } = resolved;

  let tableRows = "";
  resolved.ues.forEach((ue) => {
    tableRows += `
      <tr style="background:#f0f4ff;font-weight:700;">
        <td style="padding:7px 10px;font-size:11px;color:#1e3a8a;border-bottom:1px solid #dde3f0;">${ue.code} - ${ue.libelle}</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;color:${ue.moyenne !== undefined ? (ue.moyenne >= 10 ? "#059669" : "#dc2626") : "#9ca3af"};font-weight:800;border-bottom:1px solid #dde3f0;">${ue.moyenne !== undefined ? ue.moyenne.toFixed(2) : "En attente"}</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;color:#6b7280;border-bottom:1px solid #dde3f0;">—</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;color:#6b7280;border-bottom:1px solid #dde3f0;">—</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;border-bottom:1px solid #dde3f0;">${ue.credits}</td>
        <td style="padding:7px 10px;text-align:center;border-bottom:1px solid #dde3f0;">${ue.moyenne !== undefined ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:9999px;background:${ue.validee ? "#d1fae5" : "#fee2e2"};color:${ue.validee ? "#065f46" : "#991b1b"};">${ue.validee ? "VALIDÉ" : "NON VALIDÉ"}</span>` : ""}</td>
      </tr>`;
    ue.ecs.forEach((ec) => {
      tableRows += `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:6px 10px 6px 24px;font-size:10.5px;color:#374151;">↳ ${ec.libelle}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10.5px;color:${ec.moyenne !== undefined ? (ec.moyenne >= 10 ? "#059669" : "#dc2626") : "#d1d5db"};font-weight:700;">${ec.moyenne !== undefined ? ec.moyenne.toFixed(2) : "—"}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10.5px;color:#6b7280;">${ec.cc !== undefined ? ec.cc.toFixed(1) : "—"}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10.5px;color:#6b7280;">${ec.ef !== undefined ? ec.ef.toFixed(1) : "—"}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10.5px;color:#6b7280;">${ec.credits}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10.5px;color:#9ca3af;">—</td>
        </tr>`;
    });
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Relevé de Notes — ${entry.etudiant}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; font-size: 11px; color: #111827; background: #fff; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #4f46e5; padding-bottom: 14px; margin-bottom: 14px; }
  .logo-block { display: flex; flex-direction: column; }
  .logo-name { font-family: Arial, sans-serif; font-size: 20px; font-weight: 900; color: #4f46e5; letter-spacing: -0.5px; }
  .logo-sub { font-size: 9px; color: #6b7280; margin-top: 2px; letter-spacing: 1px; text-transform: uppercase; }
  .doc-title-block { text-align: right; }
  .doc-title { font-size: 16px; font-weight: 900; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-ref { font-size: 9px; color: #6b7280; margin-top: 3px; font-family: monospace; }
  .stamp { width: 68px; height: 68px; border: 2px solid #4f46e5; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #4f46e5; text-align: center; font-family: Arial, sans-serif; }
  .stamp-top { font-size: 7px; font-weight: 700; letter-spacing: 0.5px; }
  .stamp-year { font-size: 10px; font-weight: 900; }
  .identity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f8faff; border: 1px solid #e0e7ff; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
  .identity-item label { display: block; font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif; margin-bottom: 2px; }
  .identity-item span { font-size: 11.5px; font-weight: 700; color: #111827; }
  .section-title { font-family: Arial, sans-serif; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #4f46e5; margin-bottom: 8px; border-left: 3px solid #4f46e5; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #dde3f0; border-radius: 8px; overflow: hidden; margin-bottom: 14px; }
  thead tr { background: #4f46e5; color: white; }
  thead th { padding: 8px 10px; font-family: Arial, sans-serif; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; }
  thead th:first-child { text-align: left; }
  tfoot tr { background: #111827; color: white; }
  tfoot td { padding: 10px; font-family: Arial, sans-serif; font-size: 12px; font-weight: 900; text-align: center; }
  tfoot td:first-child { text-align: left; }
  .result-strip { display: flex; align-items: center; gap: 20px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
  .result-item { text-align: center; }
  .result-item .label { font-size: 8px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif; }
  .result-item .value { font-size: 18px; font-weight: 900; font-family: Arial, sans-serif; margin-top: 2px; }
  .result-item .value.mention { font-size: 14px; }
  .divider { width: 1px; background: rgba(255,255,255,0.3); align-self: stretch; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 8px; }
  .sig-box { border-top: 1px solid #d1d5db; padding-top: 8px; text-align: center; }
  .sig-label { font-size: 9px; color: #6b7280; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif; }
  .sig-line { font-size: 9px; color: #9ca3af; border-top: 1px dashed #d1d5db; padding-top: 4px; }
  .footer { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; font-size: 8.5px; color: #9ca3af; font-family: Arial, sans-serif; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div class="logo-block">
      <div class="logo-name">EduManage</div>
      <div class="logo-sub">Institut Supérieur de Formation</div>
      <div style="font-size:9px;color:#6b7280;margin-top:4px;">Dakar, Sénégal · Tél: +221 33 000 00 00</div>
    </div>
    <div class="stamp">
      <div class="stamp-top">OFFICIEL</div>
      <div class="stamp-year">2025<br/>2026</div>
      <div class="stamp-top">EduManage</div>
    </div>
    <div class="doc-title-block">
      <div class="doc-title">Relevé de Notes</div>
      <div style="font-size:10px;color:#4f46e5;font-weight:700;margin-top:3px;">Semestriel Officiel</div>
      <div class="doc-ref">N° REL-S1-2026-${entry.matricule.split("-").pop()?.padStart(4,"0")}</div>
      <div style="font-size:9px;color:#6b7280;margin-top:2px;">Délivré le ${now}</div>
    </div>
  </div>

  <!-- IDENTITY -->
  <div class="identity-grid">
    <div class="identity-item"><label>Nom complet</label><span>${entry.etudiant}</span></div>
    <div class="identity-item"><label>Matricule</label><span style="font-family:monospace;">${entry.matricule}</span></div>
    <div class="identity-item"><label>Filière</label><span>${entry.filiere}</span></div>
    <div class="identity-item"><label>Classe</label><span>${entry.classe}</span></div>
    <div class="identity-item"><label>Année académique</label><span>${resolved.etudiant.annee}</span></div>
    <div class="identity-item"><label>Semestre</label><span>${entry.semestre}</span></div>
  </div>

  <!-- NOTES TABLE -->
  <div class="section-title">Détail des Unités d'Enseignement</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">UE / Élément Constitutif</th>
        <th>Moyenne</th>
        <th>CC</th>
        <th>Examen</th>
        <th>Crédits</th>
        <th>Résultat</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td>MOYENNE GÉNÉRALE PONDÉRÉE</td>
        <td>${moy.toFixed(2)} / 20</td>
        <td>—</td>
        <td>—</td>
        <td>${creditsObtenus} / ${creditsTotal}</td>
        <td style="color:#6ee7b7;">${mention.toUpperCase()}</td>
      </tr>
    </tfoot>
  </table>

  <!-- RESULT STRIP -->
  <div class="result-strip">
    <div class="result-item"><div class="label">Moyenne générale</div><div class="value">${moy.toFixed(2)}<span style="font-size:12px;opacity:0.7;"> /20</span></div></div>
    <div class="divider"></div>
    <div class="result-item"><div class="label">Mention</div><div class="value mention">${mention}</div></div>
    <div class="divider"></div>
    <div class="result-item"><div class="label">Crédits validés</div><div class="value">${creditsObtenus}<span style="font-size:12px;opacity:0.7;"> /${creditsTotal}</span></div></div>
    <div class="divider"></div>
    <div class="result-item"><div class="label">Rang promo</div><div class="value">${rang ?? "—"}${typeof rang === "number" ? `<span style='font-size:12px;opacity:0.7;'>e / ${totalClasse}</span>` : ""}</div></div>
    <div class="divider"></div>
    <div class="result-item"><div class="label">Décision jury</div><div class="value mention" style="color:${moy >= 10 ? "#6ee7b7" : "#fca5a5"};">${moy >= 10 ? "ADMIS(E)" : "AJOURNÉ(E)"}</div></div>
  </div>

  <!-- SIGNATURES -->
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-label">Le Directeur Académique</div>
      <div class="sig-line">Signature &amp; Cachet Officiel</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Le Directeur Général</div>
      <div class="sig-line">Signature &amp; Cachet Officiel</div>
    </div>
    <div class="sig-box">
      <div class="sig-label">Date de délivrance</div>
      <div class="sig-line" style="color:#111827;font-weight:700;">${now}</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <span>EduManage — Institut Supérieur de Formation · Dakar, Sénégal</span>
    <span>Ce document est officiel et certifié conforme aux registres de l'institution.</span>
    <span>N° REL-S1-2026-${entry.matricule.split("-").pop()?.padStart(4,"0")}</span>
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

function printReleve(entry: ReleverEntry, resolved: BulletinResolu | undefined) {
  const html = buildPrintHtml(entry, resolved);
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";
const TOUTES_LES_CLASSES = "__toutes__";

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "emerald" | "red" | "amber" }) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
  return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap", tones[tone])}>{children}</span>;
}

export default function RelevesPage() {
  const generations = useBulletinGenerations();
  const etudiants = useStudentStore();
  const classes = useClasses();
  const annees = useAnneesAcademiques();
  const scolariteConfigs = useScolariteConfigs();
  const methodesCalcul = useMethodesCalcul();
  const { currentUser } = useAuth();
  useNotes();
  useEvaluations();
  useMentions(); // s'abonne pour recalculer les mentions/appréciations si la configuration change

  const [mode, setMode] = useState<"liste" | "nouvelle" | "consultation">("liste");
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<ReleverEntry | null>(null);
  const [search, setSearch] = useState("");

  const etudiantById = useMemo(() => {
    const map = new Map(etudiants.map((e) => [e.id, e]));
    return map;
  }, [etudiants]);

  const filteredGenerations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return generations;
    return generations.filter((g) => `${g.numero} ${g.filiere} ${g.semestre} ${g.classe}`.toLowerCase().includes(q));
  }, [generations, search]);

  const openGeneration = (id: string) => { setActiveGenerationId(id); setMode("consultation"); };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "numero", header: "Intitulé génération", sortable: true,
      render: (row) => {
        const g = row as unknown as BulletinGenerationRecord;
        return (
          <div>
            <button onClick={() => openGeneration(g.id)} className="font-semibold text-primary hover:underline">{g.numero}</button>
            <div className="text-xs text-muted-foreground mt-0.5">
              Effectuée le {formatDate(g.effectueLe.slice(0, 10))} par {g.effectuePar}
              {" "}
              <Badge tone={g.statut === "succes" ? "emerald" : g.statut === "echec" ? "red" : "amber"}>
                {g.statut === "succes" ? "Succès" : g.statut === "echec" ? "Échec" : "Partiel"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Filière : <span className="font-semibold text-foreground">{g.filiere}</span> | {g.annee} | {g.niveauLabel} | {g.classe}
            </div>
          </div>
        );
      },
    },
    { key: "semestre", header: "Session", render: (r) => <span className="text-sm">{r.semestre as string}</span> },
    {
      key: "actions", header: "",
      render: (row) => {
        const g = row as unknown as BulletinGenerationRecord;
        return (
          <button onClick={() => openGeneration(g.id)} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors" data-testid={`generation-ouvrir-${g.id}`}>
            <Eye size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluations" }, { label: "Les générations de bulletin" }]}
        title="Les générations de bulletin"
        subtitle="Génération par lot, consultation et prévisualisation des bulletins officiels"
        actions={
          mode === "liste" ? (
            <button onClick={() => setMode("nouvelle")} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="generation-nouvelle-bouton">
              <Plus size={14} /> Nouvelle génération de bulletin
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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Intitulé génération, session..." className={inputClass} data-testid="generation-recherche" />
          </div>
          <DataTable
            columns={columns}
            data={filteredGenerations as unknown as Record<string, unknown>[]}
            emptyMessage="Aucune génération de bulletin — lancez-en une nouvelle."
          />
        </>
      )}

      {mode === "nouvelle" && (
        <NouvelleGenerationForm
          annees={annees}
          classes={classes}
          etudiants={etudiants}
          scolariteConfigs={scolariteConfigs}
          methodesCalcul={methodesCalcul}
          auteur={currentUser?.name ?? "Administration"}
          onCreated={(ids) => {
            if (ids.length === 1) openGeneration(ids[0]);
            else setMode("liste");
          }}
          onCancel={() => setMode("liste")}
        />
      )}

      {mode === "consultation" && activeGenerationId && <ConsultationGeneration generationId={activeGenerationId} />}

      {/* ===== PREVIEW MODAL ===== */}
      {previewEntry && (() => {
        const resolved = resolveBulletin(previewEntry, etudiants);

        if (!resolved) {
          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewEntry(null)}>
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Aperçu indisponible</h3>
                  <button onClick={() => setPreviewEntry(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    <X size={16} className="text-gray-500" />
                  </button>
                </div>
                <div className="p-6 text-sm text-muted-foreground">
                  Bulletin indisponible pour {previewEntry.etudiant} — notes insuffisantes pour la session « {previewEntry.semestre} ».
                </div>
                <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-slate-700">
                  <button onClick={() => setPreviewEntry(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Fermer</button>
                </div>
              </div>
            </div>
          );
        }

        const { moyenne: moy, mention, creditsObtenus, creditsTotal, rang, totalClasse } = resolved;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewEntry(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Aperçu — Relevé de Notes Officiel</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{previewEntry.etudiant} · {previewEntry.matricule} · {previewEntry.semestre}</p>
                </div>
                <button onClick={() => setPreviewEntry(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              {/* A4 document preview */}
              <div className="overflow-y-auto flex-1 p-6 bg-gray-100 dark:bg-slate-800">
                <div className="bg-white text-gray-900 rounded-xl shadow-lg mx-auto" style={{ maxWidth: 680, padding: "32px 36px", fontFamily: "Georgia, serif" }}>

                  {/* Document header */}
                  <div className="flex items-start justify-between border-b-2 border-indigo-600 pb-5 mb-5">
                    <div>
                      <div style={{ fontFamily: "Arial, sans-serif", fontSize: 22, fontWeight: 900, color: "#4f46e5" }}>EduManage</div>
                      <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginTop: 2 }}>Institut Supérieur de Formation</div>
                      <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 4 }}>Dakar, Sénégal · Tél: +221 33 000 00 00</div>
                    </div>
                    <div style={{ width: 64, height: 64, border: "2px solid #4f46e5", borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#4f46e5", textAlign: "center" }}>
                      <span style={{ fontSize: 7, fontWeight: 700, fontFamily: "Arial" }}>OFFICIEL</span>
                      <span style={{ fontSize: 10, fontWeight: 900, fontFamily: "Arial" }}>2025<br />2026</span>
                      <span style={{ fontSize: 7, fontFamily: "Arial" }}>EduManage</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 17, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 }}>Relevé de Notes</div>
                      <div style={{ fontSize: 11, color: "#4f46e5", fontWeight: 700, marginTop: 3, fontFamily: "Arial" }}>Semestriel Officiel</div>
                      <div style={{ fontSize: 9, color: "#9ca3af", fontFamily: "monospace", marginTop: 3 }}>N° REL-S1-2026-{previewEntry.matricule.split("-").pop()?.padStart(4, "0")}</div>
                      <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>Délivré le {formatDate(new Date())}</div>
                    </div>
                  </div>

                  {/* Identity grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                    {[
                      ["Nom complet", previewEntry.etudiant],
                      ["Matricule", previewEntry.matricule],
                      ["Filière", previewEntry.filiere],
                      ["Classe", previewEntry.classe],
                      ["Année académique", resolved.etudiant.annee],
                      ["Semestre", previewEntry.semestre],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "Arial", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "Arial" }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Section title */}
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#4f46e5", borderLeft: "3px solid #4f46e5", paddingLeft: 8, marginBottom: 8, fontFamily: "Arial" }}>Détail des Unités d'Enseignement</div>

                  {/* Notes table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, marginBottom: 14, border: "1px solid #dde3f0", borderRadius: 8, overflow: "hidden" }}>
                    <thead>
                      <tr style={{ background: "#4f46e5", color: "white" }}>
                        {["UE / Élément Constitutif", "Moyenne", "CC", "Examen", "Crédits", "Résultat"].map((h) => (
                          <th key={h} style={{ padding: "7px 9px", fontFamily: "Arial", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: h === "UE / Élément Constitutif" ? "left" : "center" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resolved.ues.map((ue) => [
                        <tr key={ue.id} style={{ background: "#f0f4ff", fontWeight: 700 }}>
                          <td style={{ padding: "6px 9px", fontSize: 10.5, color: "#1e3a8a", borderBottom: "1px solid #dde3f0" }}>{ue.code} - {ue.libelle}</td>
                          <td style={{ padding: "6px 9px", textAlign: "center", fontSize: 11, color: ue.moyenne !== undefined ? (ue.moyenne >= 10 ? "#059669" : "#dc2626") : "#9ca3af", fontWeight: 800, borderBottom: "1px solid #dde3f0" }}>{ue.moyenne !== undefined ? ue.moyenne.toFixed(2) : "En attente"}</td>
                          <td style={{ padding: "6px 9px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #dde3f0" }}>—</td>
                          <td style={{ padding: "6px 9px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #dde3f0" }}>—</td>
                          <td style={{ padding: "6px 9px", textAlign: "center", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #dde3f0" }}>{ue.credits}</td>
                          <td style={{ padding: "6px 9px", textAlign: "center", borderBottom: "1px solid #dde3f0" }}>
                            {ue.moyenne !== undefined && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 9999, background: ue.validee ? "#d1fae5" : "#fee2e2", color: ue.validee ? "#065f46" : "#991b1b" }}>{ue.validee ? "VALIDÉ" : "NON VALIDÉ"}</span>
                            )}
                          </td>
                        </tr>,
                        ...ue.ecs.map((ec) => (
                          <tr key={ec.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "5px 9px 5px 22px", fontSize: 10, color: "#374151" }}>↳ {ec.libelle}</td>
                            <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10.5, color: ec.moyenne !== undefined ? (ec.moyenne >= 10 ? "#059669" : "#dc2626") : "#d1d5db", fontWeight: 700 }}>{ec.moyenne !== undefined ? ec.moyenne.toFixed(2) : "—"}</td>
                            <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10, color: "#6b7280" }}>{ec.cc !== undefined ? ec.cc.toFixed(1) : "—"}</td>
                            <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10, color: "#6b7280" }}>{ec.ef !== undefined ? ec.ef.toFixed(1) : "—"}</td>
                            <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10, color: "#9ca3af" }}>{ec.credits}</td>
                            <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10, color: "#d1d5db" }}>—</td>
                          </tr>
                        )),
                      ])}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#111827", color: "white" }}>
                        <td style={{ padding: "9px 9px", fontFamily: "Arial", fontSize: 11, fontWeight: 900 }}>MOYENNE GÉNÉRALE PONDÉRÉE</td>
                        <td style={{ padding: "9px 9px", textAlign: "center", fontSize: 12, fontWeight: 900 }}>{moy.toFixed(2)} / 20</td>
                        <td colSpan={2} style={{ textAlign: "center", fontSize: 10, color: "#9ca3af" }}>—</td>
                        <td style={{ padding: "9px 9px", textAlign: "center", fontSize: 11, fontWeight: 900 }}>{creditsObtenus} / {creditsTotal}</td>
                        <td style={{ padding: "9px 9px", textAlign: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#6ee7b7" }}>{mention.toUpperCase()}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Result strip */}
                  <div style={{ display: "flex", gap: 0, background: "linear-gradient(135deg, #4f46e5, #7c3aed)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "white", alignItems: "center" }}>
                    {[
                      { label: "Moyenne", value: `${moy.toFixed(2)}/20` },
                      { label: "Mention", value: mention },
                      { label: "Crédits", value: `${creditsObtenus}/${creditsTotal}` },
                      { label: "Rang", value: rang !== undefined ? `${rang}e / ${totalClasse}` : "—" },
                      { label: "Décision", value: moy >= 10 ? "ADMIS(E)" : "AJOURNÉ(E)", color: moy >= 10 ? "#6ee7b7" : "#fca5a5" },
                    ].map((item, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center", ...(i > 0 ? { borderLeft: "1px solid rgba(255,255,255,0.2)" } : {}) }}>
                        <div style={{ fontSize: 8, opacity: 0.75, textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "Arial" }}>{item.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "Arial", marginTop: 3, color: item.color ?? "white" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Signatures */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    {["Le Directeur Académique", "Le Directeur Général", "Date de délivrance"].map((sig, i) => (
                      <div key={sig} style={{ borderTop: "1px solid #d1d5db", paddingTop: 8, textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 24, fontFamily: "Arial" }}>{sig}</div>
                        <div style={{ fontSize: 9, color: i === 2 ? "#111827" : "#9ca3af", borderTop: "1px dashed #d1d5db", paddingTop: 4, fontWeight: i === 2 ? 700 : 400 }}>
                          {i === 2 ? formatDate(new Date()) : "Signature & Cachet"}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 8, color: "#9ca3af", fontFamily: "Arial" }}>
                    <span>EduManage — Institut Supérieur · Dakar, Sénégal</span>
                    <span>Document officiel certifié conforme</span>
                    <span>N° REL-S1-2026-{previewEntry.matricule.split("-").pop()?.padStart(4, "0")}</span>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl">
                <span className="text-xs text-muted-foreground">Aperçu fidèle au document imprimé en A4</span>
                <div className="flex gap-3">
                  <button onClick={() => setPreviewEntry(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Fermer</button>
                  <button
                    onClick={() => printReleve(previewEntry, resolved)}
                    className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Printer size={14} /> Imprimer / Exporter PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

interface NouvelleGenerationFormProps {
  annees: ReturnType<typeof useAnneesAcademiques>;
  classes: ReturnType<typeof useClasses>;
  etudiants: EtudiantRecord[];
  scolariteConfigs: ReturnType<typeof useScolariteConfigs>;
  methodesCalcul: ReturnType<typeof useMethodesCalcul>;
  auteur: string;
  onCreated: (ids: string[]) => void;
  onCancel: () => void;
}

function NouvelleGenerationForm({ annees, classes, etudiants, scolariteConfigs, methodesCalcul, auteur, onCreated, onCancel }: NouvelleGenerationFormProps) {
  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [tousEtudiants, setTousEtudiants] = useState(true);
  const [etudiantIdsChoisis, setEtudiantIdsChoisis] = useState<Set<string>>(new Set());
  const [lancement, setLancement] = useState(false);

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
  const toutesLesClasses = classeId === TOUTES_LES_CLASSES;
  const classeChoisie = classes.find((c) => c.id === classeId);

  const etudiantsDeLaClasse = useMemo(
    () => (classeChoisie ? etudiants.filter((e) => e.classeId === classeChoisie.id) : []),
    [etudiants, classeChoisie],
  );

  const config = filiereId ? scolariteConfigs.find((c) => c.filiereId === filiereId) : undefined;
  const codeMoySession = resolveCodeMethodeCalcul(config, "moyenneSession");
  const methodeLabel = methodesCalcul.find((m) => m.niveau === "moyenneSession" && m.code === codeMoySession)?.intitule ?? codeMoySession;

  const peutLancer = !!filiereId && !!annee && !!niveauId && !!classeId && !!semestreId && (toutesLesClasses || tousEtudiants || etudiantIdsChoisis.size > 0);

  const handleFiliereChange = (v: string) => { setFiliereId(v); setNiveauId(""); setClasseId(""); setSemestreId(""); setTousEtudiants(true); setEtudiantIdsChoisis(new Set()); };
  const handleNiveauChange = (v: string) => { setNiveauId(v); setClasseId(""); setSemestreId(""); setTousEtudiants(true); setEtudiantIdsChoisis(new Set()); };
  const handleClasseChange = (v: string) => { setClasseId(v); setTousEtudiants(true); setEtudiantIdsChoisis(new Set()); };

  const toggleEtudiant = (id: string) => {
    setEtudiantIdsChoisis((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleLancer = () => {
    if (!peutLancer || !filiere || !niveau || !semestre) return;
    setLancement(true);
    try {
      const ciblesClasses = toutesLesClasses
        ? classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau.alias && c.annee === annee)
        : classeChoisie ? [classeChoisie] : [];

      if (ciblesClasses.length === 0) {
        toast.error("Aucune classe à générer pour cette combinaison");
        return;
      }

      const idsCrees: string[] = [];
      for (const c of ciblesClasses) {
        const roster = etudiants.filter((e) => e.classeId === c.id);
        const cibleEtudiants = toutesLesClasses || tousEtudiants ? roster : roster.filter((e) => etudiantIdsChoisis.has(e.id));
        if (cibleEtudiants.length === 0) continue;
        const generation = creerGeneration({
          filiereId,
          filiere: `${filiere.nom}-${filiere.code}`,
          annee,
          niveauAlias: niveau.alias,
          niveauLabel: niveau.nom,
          classeId: c.id,
          classe: c.nom,
          semestreId,
          semestreAlias: semestre.alias,
          semestreLabel: `${semestre.nom} (${semestre.alias})`,
          etudiants: cibleEtudiants.map((e) => ({ id: e.id, prenom: e.prenom, nom: e.nom, matricule: e.matricule, classeId: c.id, classe: c.nom })),
          effectuePar: auteur,
        });
        idsCrees.push(generation.id);
      }

      if (idsCrees.length === 0) {
        toast.error("Aucun étudiant à générer pour cette sélection");
        return;
      }
      toast.success(`${idsCrees.length} génération(s) de bulletin lancée(s)`);
      onCreated(idsCrees);
    } finally {
      setLancement(false);
    }
  };

  return (
    <div className="max-w-3xl bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <h3 className="text-sm font-bold text-foreground">Nouvelle génération bulletin</h3>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
        <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="generation-filiere">
          <option value="">Sélectionner</option>
          {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>)}
        </select>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année *</label>
          <select value={annee} onChange={(e) => { setAnnee(e.target.value); setClasseId(""); }} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="generation-annee">
            <option value="">Sélectionner</option>
            {annees.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}{a.actuelle ? " (courante)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
          <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="generation-niveau">
            <option value="">Sélectionner</option>
            {niveauxDisponibles.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
          <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="generation-classe">
            <option value="">Sélectionner</option>
            <option value={TOUTES_LES_CLASSES}>Générer pour toutes les classes</option>
            {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
          <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="generation-semestre">
            <option value="">Sélectionner</option>
            {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
          </select>
        </div>
      </div>

      {filiereId && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2">
          Méthode de calcul (Moy. session) réellement appliquée pour cette filière : <span className="font-semibold text-foreground">{methodeLabel}</span> — configurable dans Paramétrage bulletins.
        </p>
      )}

      {classeId && !toutesLesClasses && (
        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
            <input type="checkbox" checked={tousEtudiants} onChange={(e) => setTousEtudiants(e.target.checked)} className="rounded" data-testid="generation-tous-etudiants" />
            Générer pour tous les étudiants ({etudiantsDeLaClasse.length})
          </label>
          {!tousEtudiants && (
            <div className="border border-border rounded-xl divide-y divide-border max-h-56 overflow-y-auto">
              {etudiantsDeLaClasse.map((e) => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                  <input type="checkbox" checked={etudiantIdsChoisis.has(e.id)} onChange={() => toggleEtudiant(e.id)} className="rounded" data-testid={`generation-etudiant-${e.id}`} />
                  {e.matricule} - {e.prenom} {e.nom}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {toutesLesClasses && (
        <p className="text-xs text-muted-foreground">Une génération distincte sera lancée pour chaque classe du niveau, pour tous leurs étudiants.</p>
      )}

      <div className="flex gap-3 pt-2 border-t border-border">
        <button onClick={handleLancer} disabled={!peutLancer || lancement} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-testid="generation-lancer">
          {lancement ? "Génération…" : "Lancer la génération"}
        </button>
        <button onClick={onCancel} className="px-5 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
      </div>
    </div>
  );
}

function ConsultationGeneration({ generationId }: { generationId: string }) {
  const generations = useBulletinGenerations();
  const generation = generations.find((g) => g.id === generationId);
  const releves = useReleves();
  const etudiants = useStudentStore();
  const [previewEntry, setPreviewEntry] = useState<ReleveRecord | null>(null);

  if (!generation) {
    return <div className="bg-card border border-border rounded-xl p-10 text-center text-sm text-muted-foreground">Génération introuvable.</div>;
  }

  const handlePreview = (etu: EtudiantConcerneGeneration) => {
    const releve = etu.releveId ? releves.find((r) => r.id === etu.releveId) : undefined;
    if (releve) setPreviewEntry(releve);
    else toast.error("Bulletin indisponible pour cet étudiant — notes insuffisantes pour cette session.");
  };

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Consultation génération bulletin</h3>
            <p className="text-sm text-muted-foreground mt-1">Numéro : <span className="font-mono font-semibold text-foreground">{generation.numero}</span> — Effectuée le {formatDate(generation.effectueLe.slice(0, 10))} par {generation.effectuePar}</p>
          </div>
          <Badge tone={generation.statut === "succes" ? "emerald" : generation.statut === "echec" ? "red" : "amber"}>
            {generation.statut === "succes" ? "Succès" : generation.statut === "echec" ? "Échec" : "Partiel"}
          </Badge>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4 text-sm">
          <p className="text-muted-foreground">Filière : <span className="font-semibold text-foreground">{generation.filiere}</span> | {generation.niveauLabel} | {generation.annee}</p>
          <p className="text-muted-foreground">Classe : <span className="font-semibold text-foreground">{generation.classe}</span> | {generation.semestre}</p>
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={14} /> {generation.nbSucces} succès</span>
          <span className="flex items-center gap-1.5 text-red-600"><XCircle size={14} /> {generation.nbEchec} échec</span>
          {generation.nbDeclasses > 0 && (
            <span className="flex items-center gap-1.5 text-purple-600"><XCircle size={14} /> {generation.nbDeclasses} à déclasser</span>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-4 border-b border-border">
          <h4 className="text-sm font-semibold text-foreground">Les étudiants concernés</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Etudiant</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase">Suggestion</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {generation.etudiantsConcernes.map((e) => (
              <tr key={e.etudiantId} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <div className="font-medium text-foreground">{e.matricule} - {e.etudiant}</div>
                  <div className={cn("text-xs mt-0.5", e.statut === "succes" ? "text-emerald-600" : e.statut === "a_declasser" ? "text-purple-600" : "text-red-600")}>
                    {e.statut === "succes" ? "Bulletin généré avec succès" : e.statut === "a_declasser" ? "À déclasser" : `Échec — ${e.motifEchec ?? "notes insuffisantes"}`}
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {e.statut === "echec"
                    ? "Compléter la saisie des notes pour cette session"
                    : e.statut === "a_declasser"
                      ? (e.raisonsDeclassement ?? []).map((r) => `${r.ecLibelle} — ${r.typeEvaluationLabel} : ${r.nbNotesReelles}/${r.nbNotesRequis}`).join(" · ")
                      : "—"}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => handlePreview(e)}
                    disabled={e.statut !== "succes"}
                    className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    data-testid={`generation-etudiant-preview-${e.etudiantId}`}
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previewEntry && (() => {
        const resolved = resolveBulletin(previewEntry, etudiants);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewEntry(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Prévisualisation bulletin</h3>
                <button onClick={() => setPreviewEntry(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
              {!resolved ? (
                <div className="p-6 text-sm text-muted-foreground">Bulletin indisponible — notes insuffisantes pour cette session.</div>
              ) : (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">{previewEntry.etudiant.charAt(0)}</div>
                    <div>
                      <p className="font-bold text-foreground">{previewEntry.matricule} - {previewEntry.etudiant}</p>
                      <p className="text-xs text-muted-foreground">{previewEntry.filiere} | {previewEntry.classe} | {previewEntry.semestre}</p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <p>Moyenne session : <span className="font-bold text-primary">{resolved.moyenne.toFixed(2)}</span></p>
                    <p>Nombre de crédits obtenus : <span className="font-bold text-foreground">{resolved.creditsObtenus.toFixed(1)} / {resolved.creditsTotal.toFixed(1)}</span></p>
                  </div>
                  <div className="border border-border rounded-xl divide-y divide-border">
                    {resolved.ues.map((ue) => (
                      <div key={ue.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-2">
                        <span className={cn("font-medium", ue.validee ? "text-foreground" : "text-red-600")}>{ue.code} - {ue.libelle}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          Crédits : {ue.credits} | Obtenus : {ue.creditsObtenus} | Moyenne : {ue.moyenne !== undefined ? ue.moyenne.toFixed(2) : "—"}
                          {" "}
                          {ue.moyenne !== undefined && (ue.validee ? <CheckCircle2 size={12} className="inline text-emerald-600 ml-1" /> : <XCircle size={12} className="inline text-red-600 ml-1" />)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => printReleve(previewEntry, resolved)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                      <Printer size={14} /> Imprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
