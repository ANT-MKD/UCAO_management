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
import { getDeliberationForClasseSemestre, DECISION_LABELS, type DecisionJury } from "@/data/deliberationStore";
import { useDeliberations } from "@/hooks/useDeliberationStore";
import { useAuth } from "@/contexts/AuthContext";
import { getEtablissement } from "@/data/etablissementStore";
import { getSignatureConfig } from "@/data/signatureConfigStore";
import { estActionInterdite } from "@/data/motifBlocageStore";
import { formatDate, cn } from "@/lib/utils";

type ReleverEntry = ReleveRecord;

export interface BulletinResolu {
  etudiant: EtudiantRecord;
  ues: UeMoyenne[];
  moyenne: number;
  mention: string;
  creditsObtenus: number;
  creditsTotal: number;
  rang?: number;
  totalClasse: number;
  semestreAlias: string;
  /** Décision réelle du jury (deliberationStore), absente si aucune délibération n'a encore eu
   * lieu pour ce semestre — jamais fabriquée depuis un simple seuil moyenne >= 10. */
  decision?: DecisionJury;
  decisionLabel: string;
  /** Appréciation textuelle du jury dérivée de la vraie décision (ex. "Semestre validé") —
   * jamais un seuil moyenne >= 10 fabriqué. */
  appreciation: string;
  filiereNomComplet: string;
  niveauLabel: string;
}

const APPRECIATION_PAR_DECISION: Record<DecisionJury, string> = {
  admis: "Semestre validé",
  ajourne: "Semestre non validé",
  rattrapage: "Session de rattrapage requise",
  exclu: "Exclusion prononcée par le jury",
  a_declasser: "Déclassé — notes insuffisantes",
};

/** Résout un ReleveRecord (qui ne stocke qu'un nom de filière et de classe, pas leurs id) vers
 * le vrai bulletin de l'étudiant via le même moteur que Bulletin étudiants — remplace UE_LINES
 * et MOYENNES_PROMO, entièrement fabriqués et identiques pour n'importe quel étudiant. */
export function resolveBulletin(entry: ReleverEntry, etudiants: EtudiantRecord[]): BulletinResolu | undefined {
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

  // Décision réelle du jury (jamais un seuil moyenne >= 10 fabriqué) : lit la délibération
  // effectivement tenue pour cette classe/semestre, y compris une correction manuelle du jury.
  const deliberation = getDeliberationForClasseSemestre(etudiant.classeId, semestreObj.id);
  const ligne = deliberation?.lignes.find((l) => l.etudiantId === etudiant.id);
  const decision = ligne?.decisionFinale;
  const niveauObj = NIVEAUX.find((n) => n.filiereId === filiereObj.id && n.alias === etudiant.niveau);

  return {
    etudiant,
    ues: bulletin.ues,
    moyenne: bulletin.moyenneSession,
    mention: resoudreMention("moyenneSession", bulletin.moyenneSession, bulletin.moyenneSession >= 10).mention ?? "—",
    creditsObtenus: bulletin.creditsObtenus,
    creditsTotal: bulletin.creditsTotal,
    rang: rangIndex >= 0 ? rangIndex + 1 : undefined,
    totalClasse: moyennesClasse.length,
    semestreAlias: semestreObj.alias,
    decision,
    decisionLabel: decision ? DECISION_LABELS[decision] : "Non délibéré",
    appreciation: decision ? APPRECIATION_PAR_DECISION[decision] : "En attente de délibération",
    filiereNomComplet: filiereObj.nom,
    niveauLabel: niveauObj?.nom ?? etudiant.niveau,
  };
}

export function buildPrintHtml(entry: ReleverEntry, resolved: BulletinResolu | undefined) {
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  if (!resolved) {
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Relevé indisponible</title></head>
      <body style="font-family:sans-serif;padding:40px;text-align:center;color:#6b7280;">
        <p>Bulletin indisponible pour ${entry.etudiant} — notes insuffisantes pour cette session.</p>
      </body></html>`;
  }
  const { moyenne: moy, creditsObtenus, creditsTotal } = resolved;
  // Année réelle DE CE SEMESTRE (pas l'année actuelle de l'étudiant, qui avance à chaque passage
  // de niveau) — repli sur l'année actuelle pour les relevés créés avant l'ajout du champ.
  const anneeReleve = entry.annee ?? resolved.etudiant.annee;
  const [prenomEtu, ...nomEtuParts] = entry.etudiant.split(" ");
  const nomComplet = `${entry.matricule} - ${nomEtuParts.join(" ").toUpperCase()} ${prenomEtu}`;
  const etab = getEtablissement();
  const sceau = etab.nom.split(/\s+/).filter((w) => w.length > 2).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "EM";
  const sig = getSignatureConfig("bulletin");

  let tableRows = "";
  resolved.ues.forEach((ue) => {
    const ueResultat = ue.moyenne !== undefined ? (ue.validee ? "UE Acquise" : "UE Non Acquise") : "";
    tableRows += `
      <tr class="ue-row">
        <td>${ue.code} - ${ue.libelle}</td>
        <td class="c">${ue.moyenne !== undefined ? ue.moyenne.toFixed(2) : "—"}</td>
        <td class="c">${ue.credits}</td>
        <td class="c" style="color:${ue.validee ? "#166534" : "#991b1b"};">${ueResultat}</td>
      </tr>`;
    ue.ecs.forEach((ec) => {
      tableRows += `
        <tr>
          <td class="ec-label">${ec.libelle}</td>
          <td class="c">${ec.moyenne !== undefined ? ec.moyenne.toFixed(2) : "—"}</td>
          <td class="c"></td>
          <td class="c"></td>
        </tr>`;
    });
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Relevé de Notes — ${entry.etudiant}</title>
<style>
  @page { size: A4; margin: 16mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: #1f2937; background: #fff; }
  .header-box { border: 2px solid #1f2937; border-radius: 10px; padding: 12px 18px; display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .seal { width: 58px; height: 58px; border-radius: 50%; border: 2px solid #5b21b6; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #5b21b6; flex-shrink: 0; }
  .seal-top { font-size: 6px; font-weight: 700; letter-spacing: 0.5px; }
  .seal-main { font-size: 11px; font-weight: 900; }
  .header-text { flex: 1; text-align: center; }
  .header-text .l1 { font-size: 14px; font-weight: 800; color: #111827; }
  .header-text .l2 { font-size: 11px; color: #374151; margin-top: 1px; }
  .header-text .l3 { font-size: 9.5px; font-style: italic; color: #6b7280; margin-top: 1px; }
  .header-text .l4 { font-size: 11.5px; font-weight: 800; color: #111827; text-transform: uppercase; margin-top: 4px; }
  .title-pill { border: 1.5px solid #1f2937; border-radius: 999px; padding: 6px 20px; width: fit-content; margin: 0 auto 18px; text-align: center; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .identity-lines { margin-bottom: 14px; line-height: 1.9; }
  .identity-lines .id-label { display: inline-block; width: 150px; color: #111827; font-weight: 700; }
  .identity-lines .id-value { color: #1f2937; }
  .intro { margin-bottom: 8px; font-size: 11.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  thead tr { background: #5b21b6; color: white; }
  thead th { padding: 7px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; text-align: center; border: 1px solid #4c1d95; }
  thead th:first-child { text-align: left; }
  td { border: 1px solid #d1d5db; padding: 5px 10px; font-size: 10.5px; }
  td.c { text-align: center; }
  tr.ue-row td { background: #ddd6fe; font-weight: 700; color: #111827; }
  td.ec-label { padding-left: 10px; color: #374151; }
  tfoot tr td { background: #111827; color: white; font-weight: 800; font-size: 11px; padding: 8px 10px; }
  tfoot tr td:first-child { text-align: left; }
  tfoot tr td.c { text-align: center; }
  .jury-table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  .jury-table th { border: 1px solid #1f2937; background: #5b21b6; color: white; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; text-align: left; }
  .jury-table td { border: 1px solid #1f2937; padding: 16px 10px; font-size: 11.5px; vertical-align: top; }
  .jury-table td:first-child { font-weight: 700; }
  .date-line { text-align: right; font-size: 10.5px; margin-top: 10px; }
  .signature-block { display: flex; justify-content: flex-end; margin-top: 8px; }
  .footer { margin-top: 30px; border-top: 1px solid #d1d5db; padding-top: 8px; text-align: center; font-size: 8.5px; color: #6b7280; line-height: 1.5; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <!-- HEADER -->
  <div class="header-box">
    <div class="seal"><span class="seal-top">INSTITUT</span><span class="seal-main">${sceau}</span><span class="seal-top">&nbsp;</span></div>
    <div class="header-text">
      ${etab.logoDataUrl ? `<img src="${etab.logoDataUrl}" style="height:36px;object-fit:contain;margin-bottom:4px" />` : ""}
      <div class="l4">${etab.nom}</div>
      <div class="l2">${etab.adresse}</div>
    </div>
    <div class="seal"><span class="seal-top">OFFICIEL</span><span class="seal-main">${anneeReleve.split("-")[0]}</span><span class="seal-top">&nbsp;</span></div>
  </div>

  <div class="title-pill">Relevé de Notes ${resolved.semestreAlias === "S1" ? "Semestre 1" : resolved.semestreAlias === "S2" ? "Semestre 2" : entry.semestre}</div>

  <!-- IDENTITY -->
  <div class="identity-lines">
    <div><span class="id-label">Prénom et Nom :</span><span class="id-value">${nomComplet}</span></div>
    <div><span class="id-label">Date de naissance :</span><span class="id-value">${resolved.etudiant.dateNaissance ? formatDate(resolved.etudiant.dateNaissance) : "—"}${resolved.etudiant.lieuNaissance ? ` à ${resolved.etudiant.lieuNaissance}` : ""}</span></div>
    <div><span class="id-label">Inscrit en :</span><span class="id-value">${resolved.filiereNomComplet} en ${resolved.niveauLabel} pour l'année académique ${anneeReleve}</span></div>
    <div><span class="id-label">Classe :</span><span class="id-value">${entry.classe}</span></div>
  </div>

  <p class="intro">A obtenu les notes suivantes</p>

  <table>
    <thead>
      <tr>
        <th style="text-align:left;">Matières</th>
        <th>Moyenne</th>
        <th>Crédits</th>
        <th>Résultats</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
    <tfoot>
      <tr>
        <td>Moyenne ${resolved.semestreAlias === "S1" ? "Semestre 1" : resolved.semestreAlias === "S2" ? "Semestre 2" : entry.semestre}</td>
        <td class="c">${moy.toFixed(2)}</td>
        <td class="c">${creditsObtenus}/${creditsTotal}</td>
        <td class="c"></td>
      </tr>
    </tfoot>
  </table>

  <!-- JURY / DIRECTEUR -->
  <table class="jury-table">
    <thead>
      <tr>
        <th>Appréciation du Jury</th>
        <th>Le Directeur</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${resolved.appreciation}</td>
        <td>${sig.actif && sig.imageDataUrl ? `<img src="${sig.imageDataUrl}" style="height:36px;object-fit:contain" />` : ""}${sig.actif && sig.signataireNom ? `<div style="font-size:10px;font-weight:700;margin-top:2px;">${sig.signataireNom}</div>` : ""}</td>
      </tr>
    </tbody>
  </table>

  <div class="date-line">Fait à ${etab.adresse.split(",")[0]}, le ${now}</div>
  <div class="signature-block">
    <div class="seal" style="border-color:#dc2626;color:#dc2626;"><span class="seal-top">${sceau}</span><span class="seal-main">OK</span><span class="seal-top">Officiel</span></div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div>${etab.nom}${etab.adresse ? ` — ${etab.adresse}` : ""}</div>
    <div>${[etab.telephone && `Tél : ${etab.telephone}`, etab.email && `Email : ${etab.email}`, etab.siteWeb && `Site web : ${etab.siteWeb}`].filter(Boolean).join(" · ")}</div>
    <div>N° REL-${resolved.semestreAlias}-${anneeReleve.split("-")[0]}-${entry.matricule.split("-").pop()?.padStart(4,"0")} — Ce document est officiel et certifié conforme aux registres de l'institution.</div>
  </div>
</body>
</html>`;
}

function printReleve(entry: ReleverEntry, resolved: BulletinResolu | undefined) {
  if (estActionInterdite(entry.etudiantId, "impression_bulletin")) {
    toast.error(`Impression bloquée pour ${entry.etudiant} — un motif de blocage l'interdit (voir Paramètres → Motifs de blocage).`);
    return;
  }
  const html = buildPrintHtml(entry, resolved);
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.print();
}

/** Aperçu du bulletin — un seul gabarit (buildPrintHtml), rendu dans un iframe, réutilisé partout
 * où un bulletin doit être prévisualisé (Relevés, Génération, et le portail étudiant) : l'aperçu
 * est donc toujours pixel pour pixel identique au document réellement imprimé, plus de gabarit
 * React dupliqué qui pourrait diverger. */
export function BulletinPreviewModal({ entry, resolved, onClose }: { entry: ReleverEntry; resolved: BulletinResolu | undefined; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Aperçu — Relevé de Notes Officiel</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{entry.etudiant} · {entry.matricule} · {entry.semestre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {!resolved ? (
          <div className="p-6 text-sm text-muted-foreground">
            Bulletin indisponible pour {entry.etudiant} — notes insuffisantes pour la session « {entry.semestre} ».
          </div>
        ) : (
          <iframe title="Aperçu relevé" srcDoc={buildPrintHtml(entry, resolved)} className="flex-1 w-full bg-gray-100 dark:bg-slate-800" data-testid="releve-preview-iframe" />
        )}

        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 bg-gray-50 dark:bg-slate-800/50 rounded-b-2xl">
          <span className="text-xs text-muted-foreground">Aperçu identique au document imprimé</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Fermer</button>
            {resolved && (
              <button onClick={() => printReleve(entry, resolved)} className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
                <Printer size={14} /> Imprimer / Exporter PDF
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
  useDeliberations(); // s'abonne pour refléter la vraie décision de jury si une délibération change

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
      {previewEntry && (
        <BulletinPreviewModal entry={previewEntry} resolved={resolveBulletin(previewEntry, etudiants)} onClose={() => setPreviewEntry(null)} />
      )}
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
  useDeliberations(); // s'abonne pour refléter la vraie décision de jury si une délibération change
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

      {previewEntry && (
        <BulletinPreviewModal entry={previewEntry} resolved={resolveBulletin(previewEntry, etudiants)} onClose={() => setPreviewEntry(null)} />
      )}
    </div>
  );
}
