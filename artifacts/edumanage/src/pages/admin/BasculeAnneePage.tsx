import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { upsertClasse } from "@/data/structureStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { registerBasculeAnnee } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const NIVEAU_SUIVANT: Record<string, string> = { L1: "L2", L2: "L3", L3: "M1", M1: "M2", M2: "D1" };

function anneeSuivante(annee: string): string {
  const [d, f] = annee.split("-").map(Number);
  if (!d || !f) return "";
  return `${d + 1}-${f + 1}`;
}

export default function BasculeAnneePage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const classes = useClasses();
  const etudiants = useStudentStore();

  const [filiereId, setFiliereId] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [annee, setAnnee] = useState("");

  const niveauxFiliere = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);

  const [niveauCibleId, setNiveauCibleId] = useState("");
  const [anneeCible, setAnneeCible] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const cohorteChoisie = !!filiereId && !!niveauId && !!annee;

  // Pas de useMemo ici : structureStore.ts mute les classes en place sans recréer la référence.
  const classesCloturees = cohorteChoisie
    ? classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && c.cloturee)
    : [];

  const appliquerSuggestions = () => {
    if (!niveau) return;
    const suggestion = NIVEAU_SUIVANT[niveau.alias];
    const niveauCibleTrouve = suggestion ? NIVEAUX.find((n) => n.filiereId === filiereId && n.alias === suggestion) : undefined;
    setNiveauCibleId(niveauCibleTrouve?.id ?? "");
    setAnneeCible(anneeSuivante(annee));
  };

  const niveauCible = NIVEAUX.find((n) => n.id === niveauCibleId);
  const peutSoumettre = selectedIds.size > 0 && !!niveauCible && !!anneeCible;

  const resolveClasseCibleId = (): string | undefined => {
    const dispo = classes.filter((c) => c.filiereId === filiereId && c.niveau === niveauCible?.alias && c.annee === anneeCible && !c.cloturee);
    if (dispo.length === 0) return undefined;
    return [...dispo].sort((a, b) => (b.max - b.inscrits) - (a.max - a.inscrits))[0].id;
  };

  const classeCibleManquante = !!niveauCible && !!anneeCible && !resolveClasseCibleId();

  const handleCreerClasseCible = () => {
    if (!niveauCible) return;
    const filiere = FILIERES.find((f) => f.id === filiereId);
    const nom = `${niveauCible.alias}-${filiere?.code ?? ""}-A`;
    const created = upsertClasse({ nom, filiereId, niveauId: niveauCible.id, max: 40, annee: anneeCible });
    toast.success(`Classe ${created.nom} créée pour ${anneeCible}`);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!peutSoumettre || !niveauCible) return;
    const classeCibleId = resolveClasseCibleId();
    if (!classeCibleId) {
      toast.error(`Aucune classe pédagogique disponible pour ${niveauCible.alias} en ${anneeCible} dans cette filière.`);
      return;
    }
    const classeCible = classes.find((c) => c.id === classeCibleId);
    setSaving(true);
    try {
      let count = 0;
      for (const classeId of selectedIds) {
        const roster = etudiants.filter((e) => e.classeId === classeId);
        for (const etu of roster) {
          registerBasculeAnnee({
            etudiantId: etu.id,
            annee: anneeCible,
            filiereId,
            classeId: classeCibleId,
            niveau: niveauCible.alias,
            statut: "actif",
            soldeDu: etu.soldeDu,
            effectuePar: currentUser?.name ?? "Administration",
          });
          count += 1;
        }
      }
      toast.success(`${count} étudiant(s) basculé(s) vers ${classeCible?.nom} (${anneeCible})`);
      setSelectedIds(new Set());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Classe" }, { label: "Bascule année" }]}
        title="Bascule année"
        subtitle="Faire basculer vers l'année suivante les étudiants des classes déjà clôturées"
        actions={
          <button onClick={() => setLocation("/admin/classes")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme *</label>
          <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); setSelectedIds(new Set()); }} className={inputClass} data-testid="bascule-annee-programme">
            <option value="">Sélectionner</option>
            {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire *</label>
            <select value={annee} onChange={(e) => { setAnnee(e.target.value); setSelectedIds(new Set()); }} className={inputClass} data-testid="bascule-annee-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => { setNiveauId(e.target.value); setSelectedIds(new Set()); }} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="bascule-annee-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
          <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            {classesCloturees.length} Classe{classesCloturees.length > 1 ? "s" : ""} clôturée{classesCloturees.length > 1 ? "s" : ""}
          </h3>
        </div>

        {!cohorteChoisie ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Info size={18} />
            Choisissez le programme, l&apos;année et le niveau.
          </div>
        ) : classesCloturees.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucune classe clôturée à ce jour !</div>
        ) : (
          <>
            <div className="p-5 border-b border-border grid sm:grid-cols-3 gap-4 items-end bg-muted/20">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau cible *</label>
                <select value={niveauCibleId} onChange={(e) => setNiveauCibleId(e.target.value)} className={inputClass} data-testid="bascule-annee-niveau-cible">
                  <option value="">Sélectionner</option>
                  {NIVEAUX.filter((n) => n.filiereId === filiereId).map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année cible *</label>
                <select value={anneeCible} onChange={(e) => setAnneeCible(e.target.value)} className={inputClass} data-testid="bascule-annee-annee-cible">
                  <option value="">Sélectionner</option>
                  {[...ANNEES_ACADEMIQUES.map((a) => a.libelle), anneeSuivante(annee)]
                    .filter((v, i, arr) => v && arr.indexOf(v) === i)
                    .map((lib) => <option key={lib} value={lib}>{lib}</option>)}
                </select>
              </div>
              <button onClick={appliquerSuggestions} className="px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors" data-testid="bascule-annee-suggerer">
                Suggérer (niveau/année suivants)
              </button>
            </div>

            {classeCibleManquante && niveauCible && (
              <div className="mx-5 mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Aucune classe {niveauCible.alias} n&apos;existe encore pour {anneeCible} dans cette filière.
                </p>
                <button
                  onClick={handleCreerClasseCible}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors whitespace-nowrap"
                  data-testid="bascule-annee-creer-classe-cible"
                >
                  Créer la classe {niveauCible.alias} {anneeCible}
                </button>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="w-10 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Classe</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Étudiants</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Clôturée le</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Observation</th>
                </tr>
              </thead>
              <tbody>
                {classesCloturees.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0" data-testid={`bascule-annee-ligne-${c.id}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggle(c.id)} className="rounded" data-testid={`bascule-annee-check-${c.id}`} />
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{c.nom}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.inscrits}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.dateCloture ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.observationCloture ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="p-5 border-t border-border flex justify-end">
              <button
                onClick={handleSave}
                disabled={!peutSoumettre || saving}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="bascule-annee-sauvegarder"
              >
                <ArrowRight size={14} /> {saving ? "Enregistrement…" : "Sauvegarder"}
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        Pour clôturer et faire basculer toutes les classes d&apos;une année scolaire en une seule fois, utilisez plutôt <a href="/admin/annees" className="text-primary hover:underline">Gestion des années académiques</a>.
      </p>
    </div>
  );
}
