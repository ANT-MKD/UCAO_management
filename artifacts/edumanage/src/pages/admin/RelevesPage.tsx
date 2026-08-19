import { useState, useMemo } from "react";
import { Eye, Download, Send, FileText, X, Printer } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { MOYENNES_PROMO, FILIERES, SEMESTRES } from "@/data/mockData";
import { useReleves, useStudentStore, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import type { ReleveRecord } from "@/data/studentStore";
import { formatDate, getMention, cn } from "@/lib/utils";

type ReleverEntry = ReleveRecord;

const STATUT_LABELS = {
  envoye: { label: "Envoyé", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  genere: { label: "Généré", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  en_attente: { label: "En attente", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
};

const UE_LINES = [
  { ue: "UE Fondements Informatique", ecs: [
    { libelle: "Architecture des Ordinateurs", cc: 13.5, ef: 14.0, credits: 2 },
    { libelle: "Systèmes d'Exploitation", cc: 15.0, ef: 14.5, credits: 4 },
  ]},
  { ue: "UE Algorithmique & Programmation", ecs: [
    { libelle: "Algorithmique I", cc: 14.5, ef: 13.0, credits: 4 },
    { libelle: "Programmation C", cc: 13.0, ef: 12.0, credits: 4 },
  ]},
  { ue: "UE Mathématiques", ecs: [
    { libelle: "Mathématiques pour l'Informatique", cc: 12.0, ef: 11.5, credits: 4 },
    { libelle: "Statistiques Descriptives", cc: 11.0, ef: 10.5, credits: 2 },
  ]},
  { ue: "UE Communication", ecs: [
    { libelle: "Français Professionnel", cc: 14.0, ef: 13.5, credits: 2 },
    { libelle: "Anglais Technique", cc: 12.5, ef: 11.0, credits: 2 },
  ]},
];

function moyenneUE(ecs: { cc: number; ef: number; credits: number }[]): number {
  const totalPoints = ecs.reduce((s, ec) => s + ((ec.cc + ec.ef) / 2) * ec.credits, 0);
  const totalCredits = ecs.reduce((s, ec) => s + ec.credits, 0);
  return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

function buildPrintHtml(entry: ReleverEntry, promo: typeof MOYENNES_PROMO[0] | undefined) {
  const moy = promo?.moyenneGenerale ?? 13.33;
  const mention = promo?.mention ?? getMention(moy);
  const creditsTotal = promo?.credits ?? 30;
  const rang = promo?.rang ?? "—";
  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  let tableRows = "";
  UE_LINES.forEach(({ ue, ecs }) => {
    const mUE = moyenneUE(ecs);
    const totalCredUE = ecs.reduce((s, ec) => s + ec.credits, 0);
    const valide = mUE >= 10;
    tableRows += `
      <tr style="background:#f0f4ff;font-weight:700;">
        <td style="padding:7px 10px;font-size:11px;color:#1e3a8a;border-bottom:1px solid #dde3f0;">${ue}</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;color:${mUE >= 10 ? "#059669" : "#dc2626"};font-weight:800;border-bottom:1px solid #dde3f0;">${mUE.toFixed(2)}</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;color:#6b7280;border-bottom:1px solid #dde3f0;">—</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;color:#6b7280;border-bottom:1px solid #dde3f0;">—</td>
        <td style="padding:7px 10px;text-align:center;font-size:11px;border-bottom:1px solid #dde3f0;">${totalCredUE}</td>
        <td style="padding:7px 10px;text-align:center;border-bottom:1px solid #dde3f0;"><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:9999px;background:${valide ? "#d1fae5" : "#fee2e2"};color:${valide ? "#065f46" : "#991b1b"};">${valide ? "VALIDÉ" : "NON VALIDÉ"}</span></td>
      </tr>`;
    ecs.forEach(ec => {
      const noteEC = (ec.cc + ec.ef) / 2;
      tableRows += `
        <tr style="border-bottom:1px solid #f1f5f9;">
          <td style="padding:6px 10px 6px 24px;font-size:10.5px;color:#374151;">↳ ${ec.libelle}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10.5px;color:${noteEC >= 10 ? "#059669" : "#dc2626"};font-weight:700;">${noteEC.toFixed(2)}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10.5px;color:#6b7280;">${ec.cc.toFixed(1)}</td>
          <td style="padding:6px 10px;text-align:center;font-size:10.5px;color:#6b7280;">${ec.ef.toFixed(1)}</td>
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
    <div class="identity-item"><label>Année académique</label><span>2025-2026</span></div>
    <div class="identity-item"><label>Semestre</label><span>Semestre 1 (S1)</span></div>
  </div>

  <!-- NOTES TABLE -->
  <div class="section-title">Détail des Unités d'Enseignement</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;">UE / Élément Constitutif</th>
        <th>Moyenne</th>
        <th>CC (40%)</th>
        <th>Examen (60%)</th>
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
        <td>${creditsTotal} / 30</td>
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
    <div class="result-item"><div class="label">Crédits validés</div><div class="value">${creditsTotal}<span style="font-size:12px;opacity:0.7;"> /30</span></div></div>
    <div class="divider"></div>
    <div class="result-item"><div class="label">Rang promo</div><div class="value">${rang}${typeof rang === "number" ? "<span style='font-size:12px;opacity:0.7;'>e</span>" : ""}</div></div>
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

function printReleve(entry: ReleverEntry, promo: typeof MOYENNES_PROMO[0] | undefined) {
  const html = buildPrintHtml(entry, promo);
  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

export default function RelevesPage() {
  const releves = useReleves();
  const etudiants = useStudentStore();
  const classes = useClasses();
  const annees = useAnneesAcademiques();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewEntry, setPreviewEntry] = useState<ReleverEntry | null>(null);
  const [search, setSearch] = useState("");
  const [annee, setAnnee] = useState("2025-2026");
  const [filiereId, setFiliereId] = useState("");
  const [niveau, setNiveau] = useState("");
  const [semestre, setSemestre] = useState("");
  const [classeId, setClasseId] = useState("");
  const [statut, setStatut] = useState("");
  const [docType, setDocType] = useState<"tous" | "releve" | "bulletin">("tous");
  const [session, setSession] = useState("");

  const handleGenerateAll = () => {
    setGenerating(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); setGenerating(false); return 100; }
        return p + 8;
      });
    }, 150);
  };

  const etudiantById = useMemo(() => {
    const map = new Map(etudiants.map((e) => [e.id, e]));
    return map;
  }, [etudiants]);

  const filteredClasses = useMemo(() => {
    return classes.filter((c) => {
      if (filiereId && c.filiereId !== filiereId) return false;
      if (niveau && c.niveau !== niveau) return false;
      if (annee && c.annee !== annee) return false;
      return true;
    });
  }, [classes, filiereId, niveau, annee]);

  const niveauxOpts = useMemo(() => {
    const list = classes
      .filter((c) => (!filiereId || c.filiereId === filiereId) && (!annee || c.annee === annee))
      .map((c) => c.niveau);
    return [...new Set(list)].sort();
  }, [classes, filiereId, annee]);

  const semestresOpts = useMemo(() => {
    const fromData = [...new Set(releves.map((r) => r.semestre).filter(Boolean))];
    const fromMock = SEMESTRES
      .filter((s) => {
        if (filiereId) {
          const f = FILIERES.find((x) => x.id === filiereId);
          if (f && s.filiere !== f.code) return false;
        }
        if (niveau && s.niveau !== niveau) return false;
        return true;
      })
      .map((s) => `${s.alias} ${annee || "2025-2026"}`);
    return [...new Set([...fromData, ...fromMock])].sort();
  }, [releves, filiereId, niveau, annee]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return releves.filter((r) => {
      const etu = etudiantById.get(r.etudiantId);
      if (annee && etu && etu.annee !== annee) {
        // Semestre string often embeds year; also check semestre field
        if (!r.semestre.includes(annee.split("-")[0]) && !r.semestre.includes(annee)) return false;
      }
      if (filiereId) {
        const f = FILIERES.find((x) => x.id === filiereId);
        if (f && r.filiere !== f.code && etu?.filiereId !== filiereId) return false;
      }
      if (niveau && etu && etu.niveau !== niveau) return false;
      if (classeId && etu && etu.classeId !== classeId) return false;
      if (classeId && !etu && r.classe !== classes.find((c) => c.id === classeId)?.nom) return false;
      if (semestre && r.semestre !== semestre && !r.semestre.startsWith(semestre.split(" ")[0])) return false;
      if (statut && r.statut !== statut) return false;
      if (docType === "bulletin") {
        const isBulletin = r.semestre.toLowerCase().includes("annuel") || r.semestre.toLowerCase().includes("bulletin");
        if (!isBulletin) return false;
      }
      if (docType === "releve" && (r.semestre.toLowerCase().includes("annuel") || r.semestre.toLowerCase().includes("bulletin"))) return false;
      if (session === "normale" && r.semestre.toLowerCase().includes("rattrapage")) return false;
      if (session === "rattrapage" && !r.semestre.toLowerCase().includes("rattrapage")) return false;
      if (q) {
        const hay = `${r.etudiant} ${r.matricule} ${r.classe} ${r.filiere}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [releves, etudiantById, annee, filiereId, niveau, classeId, classes, semestre, statut, docType, session, search]);

  const stats = {
    total: filtered.length,
    envoyes: filtered.filter((r) => r.statut === "envoye").length,
    generes: filtered.filter((r) => r.statut === "genere").length,
    attente: filtered.filter((r) => r.statut === "en_attente").length,
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const resetFilters = () => {
    setAnnee("2025-2026");
    setFiliereId("");
    setNiveau("");
    setSemestre("");
    setClasseId("");
    setStatut("");
    setDocType("tous");
    setSession("");
    setSearch("");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluations" }, { label: "Relevés & Bulletins" }]}
        title="Relevés & Bulletins"
        subtitle="Génération, prévisualisation et envoi des relevés de notes officiels"
        actions={
          <button onClick={handleGenerateAll} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <FileText size={14} /> Générer pour toute la promotion
          </button>
        }
      />

      {/* Filtres complets */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5 space-y-3" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Filtres</h3>
          <button type="button" onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground underline">
            Réinitialiser
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Année académique</label>
            <select className={inputClass} value={annee} onChange={(e) => { setAnnee(e.target.value); setClasseId(""); }}>
              <option value="">Toutes</option>
              {annees.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}{a.actuelle ? " (courante)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Filière</label>
            <select className={inputClass} value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveau(""); setSemestre(""); setClasseId(""); }}>
              <option value="">Toutes</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Niveau</label>
            <select className={inputClass} value={niveau} onChange={(e) => { setNiveau(e.target.value); setSemestre(""); setClasseId(""); }}>
              <option value="">Tous</option>
              {niveauxOpts.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Semestre</label>
            <select className={inputClass} value={semestre} onChange={(e) => setSemestre(e.target.value)}>
              <option value="">Tous</option>
              {semestresOpts.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Classe pédagogique</label>
            <select className={inputClass} value={classeId} onChange={(e) => setClasseId(e.target.value)}>
              <option value="">Toutes</option>
              {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Statut document</label>
            <select className={inputClass} value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option value="">Tous</option>
              <option value="en_attente">En attente</option>
              <option value="genere">Généré</option>
              <option value="envoye">Envoyé</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Type de document</label>
            <select className={inputClass} value={docType} onChange={(e) => setDocType(e.target.value as typeof docType)}>
              <option value="tous">Relevés & bulletins</option>
              <option value="releve">Relevé semestriel</option>
              <option value="bulletin">Bulletin annuel</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Session</label>
            <select className={inputClass} value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="">Toutes</option>
              <option value="normale">Session normale</option>
              <option value="rattrapage">Session de rattrapage</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">Recherche</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Étudiant, matricule, classe, filière…"
            className={inputClass}
          />
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} résultat(s) sur {releves.length} relevé(s)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: "Total (filtrés)", value: stats.total, color: "text-foreground" },
          { label: "Envoyés", value: stats.envoyes, color: "text-emerald-600" },
          { label: "Générés", value: stats.generes, color: "text-blue-600" },
          { label: "En attente", value: stats.attente, color: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {generating && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Génération en cours...</span>
            <span className="text-sm font-bold text-primary">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Liste des relevés</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Étudiant", "Matricule", "Filière", "Classe", "Semestre", "Statut", "Date génération", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Aucun relevé ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            ) : filtered.map((r) => {
              const s = STATUT_LABELS[r.statut];
              return (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{r.etudiant}</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground">{r.matricule}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.filiere}</td>
                  <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-lg">{r.classe}</span></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.semestre}</td>
                  <td className="px-4 py-3"><span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", s.cls)}>{s.label}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.dateGeneration ? formatDate(r.dateGeneration) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewEntry(r)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Aperçu du relevé"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => printReleve(r, MOYENNES_PROMO.find((m) => m.etudiantId === r.etudiantId))}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Télécharger / Imprimer PDF"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => {}}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-emerald-600 transition-colors"
                        title="Envoyer par email"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== PREVIEW MODAL ===== */}
      {previewEntry && (() => {
        const promo = MOYENNES_PROMO.find((m) => m.etudiantId === previewEntry.etudiantId);
        const moy = promo?.moyenneGenerale ?? 13.33;
        const mention = promo?.mention ?? getMention(moy);
        const creditsTotal = promo?.credits ?? 30;
        const rang = promo?.rang ?? "—";

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPreviewEntry(null)}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Aperçu — Relevé de Notes Officiel</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{previewEntry.etudiant} · {previewEntry.matricule} · S1 2025-2026</p>
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
                      ["Année académique", "2025-2026"],
                      ["Semestre", "Semestre 1 (S1)"],
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
                        {["UE / Élément Constitutif", "Moyenne", "CC (40%)", "Examen (60%)", "Crédits", "Résultat"].map((h) => (
                          <th key={h} style={{ padding: "7px 9px", fontFamily: "Arial", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: h === "UE / Élément Constitutif" ? "left" : "center" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {UE_LINES.map(({ ue, ecs }) => {
                        const mUE = moyenneUE(ecs);
                        const credUE = ecs.reduce((sum, ec) => sum + ec.credits, 0);
                        return [
                          <tr key={ue} style={{ background: "#f0f4ff", fontWeight: 700 }}>
                            <td style={{ padding: "6px 9px", fontSize: 10.5, color: "#1e3a8a", borderBottom: "1px solid #dde3f0" }}>{ue}</td>
                            <td style={{ padding: "6px 9px", textAlign: "center", fontSize: 11, color: mUE >= 10 ? "#059669" : "#dc2626", fontWeight: 800, borderBottom: "1px solid #dde3f0" }}>{mUE.toFixed(2)}</td>
                            <td style={{ padding: "6px 9px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #dde3f0" }}>—</td>
                            <td style={{ padding: "6px 9px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #dde3f0" }}>—</td>
                            <td style={{ padding: "6px 9px", textAlign: "center", fontSize: 10, color: "#6b7280", borderBottom: "1px solid #dde3f0" }}>{credUE}</td>
                            <td style={{ padding: "6px 9px", textAlign: "center", borderBottom: "1px solid #dde3f0" }}>
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 9999, background: mUE >= 10 ? "#d1fae5" : "#fee2e2", color: mUE >= 10 ? "#065f46" : "#991b1b" }}>{mUE >= 10 ? "VALIDÉ" : "NON VALIDÉ"}</span>
                            </td>
                          </tr>,
                          ...ecs.map((ec) => {
                            const noteEC = (ec.cc + ec.ef) / 2;
                            return (
                              <tr key={ec.libelle} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "5px 9px 5px 22px", fontSize: 10, color: "#374151" }}>↳ {ec.libelle}</td>
                                <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10.5, color: noteEC >= 10 ? "#059669" : "#dc2626", fontWeight: 700 }}>{noteEC.toFixed(2)}</td>
                                <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10, color: "#6b7280" }}>{ec.cc.toFixed(1)}</td>
                                <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10, color: "#6b7280" }}>{ec.ef.toFixed(1)}</td>
                                <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10, color: "#9ca3af" }}>{ec.credits}</td>
                                <td style={{ padding: "5px 9px", textAlign: "center", fontSize: 10, color: "#d1d5db" }}>—</td>
                              </tr>
                            );
                          })
                        ];
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#111827", color: "white" }}>
                        <td style={{ padding: "9px 9px", fontFamily: "Arial", fontSize: 11, fontWeight: 900 }}>MOYENNE GÉNÉRALE PONDÉRÉE</td>
                        <td style={{ padding: "9px 9px", textAlign: "center", fontSize: 12, fontWeight: 900 }}>{moy.toFixed(2)} / 20</td>
                        <td colSpan={2} style={{ textAlign: "center", fontSize: 10, color: "#9ca3af" }}>—</td>
                        <td style={{ padding: "9px 9px", textAlign: "center", fontSize: 11, fontWeight: 900 }}>{creditsTotal} / 30</td>
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
                      { label: "Crédits", value: `${creditsTotal}/30` },
                      { label: "Rang", value: `${rang}e` },
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
                    onClick={() => printReleve(previewEntry, promo)}
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

