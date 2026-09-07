import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Search, ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useStudentStore, useAllInscriptions, useAnneeActuelle } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useModelesFrais } from "@/hooks/useFinanceSettingsStore";
import { registerReinscription } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";
const DEFAULT_FILIERE_KEY = "edumanage-fiche-inscription-filiere-defaut";

export default function FicheInscriptionPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const inscriptions = useAllInscriptions();
  const classes = useClasses();
  const modelesFrais = useModelesFrais();
  const anneeActuelle = useAnneeActuelle();

  const [filiereId, setFiliereId] = useState(() => localStorage.getItem(DEFAULT_FILIERE_KEY) ?? "");
  const [niveauId, setNiveauId] = useState("");
  const [annee, setAnnee] = useState(anneeActuelle);
  const [specialite, setSpecialite] = useState("");
  const [modeleFraisId, setModeleFraisId] = useState("");
  const [definirParDefaut, setDefinirParDefaut] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (definirParDefaut && filiereId) localStorage.setItem(DEFAULT_FILIERE_KEY, filiereId);
  }, [definirParDefaut, filiereId]);

  const niveauxFiliere = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);

  // Pas de useMemo ici : le store historique studentStore.ts mute son tableau `inscriptions`
  // en place (push) sans en recréer la référence, donc une dépendance [inscriptions] resterait
  // "égale" pour React après un ajout et servirait une carte périmée.
  const dernieresInscriptions = (() => {
    const map = new Map<string, (typeof inscriptions)[number]>();
    for (const ins of inscriptions) {
      const prev = map.get(ins.etudiantId);
      if (!prev || ins.annee > prev.annee || (ins.annee === prev.annee && ins.dateInscription > prev.dateInscription)) {
        map.set(ins.etudiantId, ins);
      }
    }
    return map;
  })();

  const candidats = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 30)
    : [];

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const peutSoumettre = !!filiereId && !!niveauId && !!annee && selectedIds.size > 0;

  const resolveClasseId = (): string | undefined => {
    const dispo = classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee);
    if (dispo.length === 0) return undefined;
    return [...dispo].sort((a, b) => (b.max - b.inscrits) - (a.max - a.inscrits))[0].id;
  };

  const handleSave = () => {
    if (!peutSoumettre || !niveau) return;
    const classeId = resolveClasseId();
    if (!classeId) {
      toast.error(`Aucune classe pédagogique disponible pour ${niveau.alias} en ${annee} dans cette filière.`);
      return;
    }
    const classeResolue = classes.find((c) => c.id === classeId);
    const modele = modelesFrais.find((m) => m.id === modeleFraisId);
    setSaving(true);
    try {
      let count = 0;
      for (const id of selectedIds) {
        const etudiant = etudiants.find((e) => e.id === id);
        if (!etudiant) continue;
        registerReinscription({
          etudiantId: id,
          annee,
          filiereId,
          classeId,
          niveau: niveau.alias,
          statut: "actif",
          soldeDu: etudiant.soldeDu,
          specialite: specialite.trim() || undefined,
          modeleFraisId: modele?.id,
          modeleFrais: modele?.intitule,
          effectuePar: currentUser?.name ?? "Administration",
        });
        count += 1;
      }
      toast.success(`${count} étudiant(s) inscrit(s) dans ${classeResolue?.nom} (${annee})`);
      setSelectedIds(new Set());
      setSearchQuery("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inscription impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Inscription" }, { label: "Fiche d'inscription" }]}
        title="Nouvelle fiche d'inscription"
        subtitle="Inscrire un ou plusieurs étudiants déjà existants dans une filière, un niveau et une année"
        actions={
          <button onClick={() => setLocation("/admin/students")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
          <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); }} className={inputClass} data-testid="fiche-inscription-filiere">
            <option value="">Sélectionner</option>
            {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année scolaire *</label>
            <select value={annee} onChange={(e) => setAnnee(e.target.value)} className={inputClass} data-testid="fiche-inscription-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="fiche-inscription-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Spécialité</label>
            <input value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="Optionnel" className={inputClass} data-testid="fiche-inscription-specialite" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Modèle de frais</label>
            <select value={modeleFraisId} onChange={(e) => setModeleFraisId(e.target.value)} className={inputClass} data-testid="fiche-inscription-modele-frais">
              <option value="">Sélectionner</option>
              {modelesFrais.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.intitule}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={definirParDefaut} onChange={(e) => setDefinirParDefaut(e.target.checked)} className="rounded" data-testid="fiche-inscription-defaut" />
          Définir comme filière par défaut
        </label>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
          <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Les étudiants à inscrire {selectedIds.size > 0 && <span className="text-primary font-normal text-sm">({selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""})</span>}
          </h3>
          <div className="relative w-72 max-w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un étudiant..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="fiche-inscription-recherche"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!peutSoumettre || saving}
              className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="fiche-inscription-sauvegarder"
            >
              {saving ? "Enregistrement…" : "Sauvegarder"}
            </button>
            <button onClick={() => setLocation("/admin/students")} className="px-5 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </div>

        {!filiereId || !niveauId || !annee ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Info size={18} />
            Choisissez la filière, l&apos;année et le niveau avant de rechercher des étudiants.
          </div>
        ) : searchQuery.length <= 1 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Recherchez un étudiant par nom ou matricule.</div>
        ) : candidats.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun étudiant trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="w-10 px-4 py-3"></th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Étudiant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Dernière inscription</th>
              </tr>
            </thead>
            <tbody>
              {candidats.map((stu) => {
                const derniere = dernieresInscriptions.get(stu.id);
                const dejaInscrit = derniere && derniere.filiereId === filiereId && derniere.niveau === niveau?.alias && derniere.annee === annee;
                return (
                  <tr
                    key={stu.id}
                    onClick={() => toggle(stu.id)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                    data-testid={`fiche-inscription-ligne-${stu.id}`}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(stu.id)} onChange={() => toggle(stu.id)} onClick={(e) => e.stopPropagation()} className="rounded" data-testid={`fiche-inscription-check-${stu.id}`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={`${stu.prenom} ${stu.nom}`} size="sm" />
                        <div>
                          <div className="font-medium text-foreground">{stu.prenom} {stu.nom}</div>
                          <div className="text-xs text-muted-foreground font-mono">{stu.matricule}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {derniere ? (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{derniere.filiere} — {derniere.niveau} ({derniere.annee})</span>
                          {dejaInscrit && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">Déjà inscrit</span>}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Aucune</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
