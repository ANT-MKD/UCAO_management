import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Lock, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { cloturerClasses } from "@/data/structureStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function ClotureAnneePage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const classes = useClasses();
  const searchStr = useSearch();
  const params = useMemo(() => new URLSearchParams(searchStr), [searchStr]);

  const [filiereId, setFiliereId] = useState(params.get("filiereId") ?? "");
  const [niveauId, setNiveauId] = useState(() => {
    const niveauAlias = params.get("niveau");
    const fId = params.get("filiereId");
    return niveauAlias && fId ? (NIVEAUX.find((n) => n.filiereId === fId && n.alias === niveauAlias)?.id ?? "") : "";
  });
  const [annee, setAnnee] = useState(params.get("annee") ?? "");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const niveauxFiliere = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);

  const cohorteChoisie = !!filiereId && !!niveauId && !!annee;

  // Pas de useMemo ici : structureStore.ts mute les classes en place (Object.assign) sans
  // recréer la référence du tableau, donc un useMemo dépendant de [classes] resterait périmé.
  const classesTrouvees = cohorteChoisie
    ? classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee)
    : [];

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (selectedIds.size === 0) return;
    setSaving(true);
    try {
      cloturerClasses([...selectedIds], observations, currentUser?.name ?? "Administration");
      toast.success(`${selectedIds.size} classe(s) clôturée(s)`);
      setSelectedIds(new Set());
      setObservations({});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Classe" }, { label: "Clôture année" }]}
        title="Clôture année"
        subtitle="Clôturer une ou plusieurs classes pédagogiques d'un programme, d'une année et d'un niveau"
        actions={
          <button onClick={() => setLocation("/admin/classes")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme *</label>
          <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); setSelectedIds(new Set()); }} className={inputClass} data-testid="cloture-annee-programme">
            <option value="">Sélectionner</option>
            {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire *</label>
            <select value={annee} onChange={(e) => { setAnnee(e.target.value); setSelectedIds(new Set()); }} className={inputClass} data-testid="cloture-annee-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => { setNiveauId(e.target.value); setSelectedIds(new Set()); }} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="cloture-annee-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
          <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Classes de cette cohorte {selectedIds.size > 0 && <span className="text-primary font-normal text-sm">({selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""})</span>}
          </h3>
          <button
            onClick={handleSave}
            disabled={selectedIds.size === 0 || saving}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="cloture-annee-sauvegarder"
          >
            <Lock size={14} /> {saving ? "Enregistrement…" : "Sauvegarder"}
          </button>
        </div>

        {!cohorteChoisie ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Info size={18} />
            Choisissez le programme, l&apos;année et le niveau pour lister les classes.
          </div>
        ) : classesTrouvees.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucune classe ouverte pour cette sélection.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="w-10 px-4 py-3"></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Intitulé</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Nombre d&apos;étudiants</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Observations</th>
              </tr>
            </thead>
            <tbody>
              {classesTrouvees.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0" data-testid={`cloture-annee-ligne-${c.id}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggle(c.id)} className="rounded" data-testid={`cloture-annee-check-${c.id}`} />
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{c.nom}</td>
                  <td className="px-4 py-3 text-foreground">{c.nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.inscrits}</td>
                  <td className="px-4 py-3">
                    <textarea
                      value={observations[c.id] ?? ""}
                      onChange={(e) => setObservations((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      rows={1}
                      className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                      data-testid={`cloture-annee-observation-${c.id}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Pour clôturer et faire basculer toutes les classes d&apos;une année scolaire en une seule fois, utilisez plutôt <a href="/admin/annees" className="text-primary hover:underline">Gestion des années académiques</a>.
      </p>
    </div>
  );
}
