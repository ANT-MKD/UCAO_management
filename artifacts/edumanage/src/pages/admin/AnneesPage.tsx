import { useState } from "react";
import { Plus, CheckCircle, Archive, RefreshCw, AlertTriangle, Calendar, Users, BookOpen, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { ANNEES_ACADEMIQUES, FILIERES, ETUDIANTS } from "@/data/mockData";
import { cn } from "@/lib/utils";

interface AnneeEtendue {
  id: string;
  libelle: string;
  actuelle: boolean;
  statut: "actuelle" | "archivee" | "future";
  nbInscrits: number;
  nbFilieres: number;
  periodeS1: string;
  periodeS2: string;
  dateOuverture: string;
  dateCloture: string;
}

const ANNEES_DATA: AnneeEtendue[] = [
  { id: "aa3", libelle: "2025-2026", actuelle: true, statut: "actuelle", nbInscrits: 847, nbFilieres: 5, periodeS1: "Sep 2025 – Jan 2026", periodeS2: "Fév 2026 – Jun 2026", dateOuverture: "2025-09-01", dateCloture: "2026-06-30" },
  { id: "aa2", libelle: "2024-2025", actuelle: false, statut: "archivee", nbInscrits: 810, nbFilieres: 5, periodeS1: "Sep 2024 – Jan 2025", periodeS2: "Fév 2025 – Jun 2025", dateOuverture: "2024-09-01", dateCloture: "2025-06-30" },
  { id: "aa1", libelle: "2023-2024", actuelle: false, statut: "archivee", nbInscrits: 745, nbFilieres: 4, periodeS1: "Sep 2023 – Jan 2024", periodeS2: "Fév 2024 – Jun 2024", dateOuverture: "2023-09-01", dateCloture: "2024-06-30" },
];

const STATUT_META = {
  actuelle: { label: "Année en cours", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", icon: CheckCircle, color: "#10b981" },
  archivee: { label: "Archivée", cls: "bg-muted text-muted-foreground", icon: Archive, color: "#9ca3af" },
  future: { label: "Prochaine", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300", icon: Calendar, color: "#3b82f6" },
};

export default function AnneesPage() {
  const [selected, setSelected] = useState<string | null>("aa3");
  const [confirmModal, setConfirmModal] = useState<"cloturer" | "nouvelle" | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAnnee, setNewAnnee] = useState({ libelle: "2026-2027", dateOuverture: "2026-09-01", dateCloture: "2027-06-30" });

  const anneeActuelle = ANNEES_DATA.find((a) => a.statut === "actuelle");
  const anneeSelectionnee = ANNEES_DATA.find((a) => a.id === selected);

  const semestres = anneeSelectionnee
    ? [
        { nom: "Semestre 1", periode: anneeSelectionnee.periodeS1, statut: anneeSelectionnee.statut === "actuelle" ? "actif" : "clos" },
        { nom: "Semestre 2", periode: anneeSelectionnee.periodeS2, statut: anneeSelectionnee.statut === "actuelle" ? "futur" : "clos" },
      ]
    : [];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Années Académiques" }]}
        title="Années Académiques"
        subtitle="Gestion du calendrier académique — ouverture, clôture et archivage des années"
        actions={
          <button onClick={() => setShowNewForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={14} /> Nouvelle année
          </button>
        }
      />

      {/* Alert active year */}
      {anneeActuelle && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl mb-5">
          <CheckCircle size={16} className="text-emerald-600 flex-shrink-0" />
          <div className="flex-1 text-sm text-emerald-800 dark:text-emerald-300">
            <span className="font-semibold">Année active :</span> {anneeActuelle.libelle} — {anneeActuelle.periodeS1} / {anneeActuelle.periodeS2}
          </div>
          <button onClick={() => setConfirmModal("cloturer")} className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            Clôturer l'année
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* List */}
        <div className="space-y-3">
          {ANNEES_DATA.map((annee) => {
            const meta = STATUT_META[annee.statut];
            return (
              <button
                key={annee.id}
                onClick={() => setSelected(annee.id)}
                className={cn(
                  "w-full text-left bg-card border rounded-xl p-4 transition-all hover:shadow-md",
                  selected === annee.id ? "border-primary shadow-sm ring-1 ring-primary/20" : "border-border hover:border-primary/30"
                )}
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>{annee.libelle}</span>
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", meta.cls)}>{meta.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users size={10} />{annee.nbInscrits} inscrits</span>
                  <span className="flex items-center gap-1"><BookOpen size={10} />{annee.nbFilieres} filières</span>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">{annee.periodeS1}</div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {anneeSelectionnee && (
          <div className="lg:col-span-2 space-y-4">
            {/* Header */}
            <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Année {anneeSelectionnee.libelle}</h3>
                  <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full mt-1 inline-block", STATUT_META[anneeSelectionnee.statut].cls)}>
                    {STATUT_META[anneeSelectionnee.statut].label}
                  </span>
                </div>
                {anneeSelectionnee.statut === "actuelle" && (
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmModal("cloturer")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
                      <Archive size={12} /> Clôturer
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Étudiants inscrits", value: anneeSelectionnee.nbInscrits },
                  { label: "Filières actives", value: anneeSelectionnee.nbFilieres },
                  { label: "Date d'ouverture", value: new Date(anneeSelectionnee.dateOuverture).toLocaleDateString("fr-FR") },
                  { label: "Date de clôture", value: new Date(anneeSelectionnee.dateCloture).toLocaleDateString("fr-FR") },
                ].map((f) => (
                  <div key={f.label} className="p-3 bg-muted/30 rounded-xl">
                    <div className="text-xs text-muted-foreground mb-1">{f.label}</div>
                    <div className="font-bold text-foreground">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Semestres */}
            <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h4 className="font-bold text-foreground mb-4">Semestres</h4>
              <div className="space-y-3">
                {semestres.map((s) => (
                  <div key={s.nom} className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border">
                    <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: s.statut === "actif" ? "#10b981" : s.statut === "futur" ? "#4f46e5" : "#d1d5db" }} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{s.nom}</div>
                      <div className="text-xs text-muted-foreground">{s.periode}</div>
                    </div>
                    <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full",
                      s.statut === "actif" ? "bg-emerald-50 text-emerald-700" :
                      s.statut === "futur" ? "bg-blue-50 text-blue-700" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {s.statut === "actif" ? "En cours" : s.statut === "futur" ? "À venir" : "Clôturé"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filières actives cette année */}
            <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
              <h4 className="font-bold text-foreground mb-4">Filières actives — {anneeSelectionnee.libelle}</h4>
              <div className="space-y-2">
                {FILIERES.filter((f) => f.statut === "actif").map((f) => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/20 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={12} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{f.code} — {f.nom}</div>
                      <div className="text-xs text-muted-foreground">{f.nbClasses} classes · {f.nbEtudiants} étudiants</div>
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Actif</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New year modal */}
      {showNewForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowNewForm(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-1">Créer une nouvelle année académique</h3>
            <p className="text-sm text-muted-foreground mb-5">L'année actuelle sera conservée jusqu'à clôture manuelle.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Libellé *</label>
                <input value={newAnnee.libelle} onChange={(e) => setNewAnnee(p => ({ ...p, libelle: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="ex: 2026-2027" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date d'ouverture</label>
                  <input type="date" value={newAnnee.dateOuverture} onChange={(e) => setNewAnnee(p => ({ ...p, dateOuverture: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date de clôture</label>
                  <input type="date" value={newAnnee.dateCloture} onChange={(e) => setNewAnnee(p => ({ ...p, dateCloture: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-xl">
                <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">Créer une nouvelle année ne ferme pas l'année en cours. Clôturez d'abord l'année actuelle si nécessaire.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowNewForm(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
              <button onClick={() => setShowNewForm(false)} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm cloturer */}
      {confirmModal === "cloturer" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-50 dark:bg-red-950/50 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Clôturer l'année {anneeActuelle?.libelle} ?</h3>
            <p className="text-sm text-muted-foreground mb-4">Cette action va archiver l'année en cours. Tous les relevés de notes et délibérations seront verrouillés. Cette action est irréversible.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
              <button onClick={() => setConfirmModal(null)} className="px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors">Clôturer l'année</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
