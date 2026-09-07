import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useStudentStore, useAllInscriptions } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { registerReinscription } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const STATUTS_EN_ATTENTE = new Set(["preinscrit", "en_attente"]);

export default function InscriptionDefinitivePage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const inscriptions = useAllInscriptions();
  const classes = useClasses();

  const [filiereId, setFiliereId] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [annee, setAnnee] = useState("");
  const [specialite, setSpecialite] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const niveauxFiliere = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);

  // Pas de useMemo ici : studentStore.ts mute son tableau `inscriptions` en place (push) sans
  // en recréer la référence, donc une dépendance [inscriptions] resterait périmée après un ajout.
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

  const cohorteChoisie = !!filiereId && !!niveauId && !!annee;

  const candidats = cohorteChoisie
    ? etudiants.filter((e) =>
        e.filiereId === filiereId &&
        e.niveau === niveau?.alias &&
        e.annee === annee &&
        STATUTS_EN_ATTENTE.has(e.statut),
      )
    : [];

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => (prev.size === candidats.length ? new Set() : new Set(candidats.map((c) => c.id))));
  };

  const peutSoumettre = cohorteChoisie && specialite.trim().length > 0 && selectedIds.size > 0;

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
          specialite: specialite.trim(),
          effectuePar: currentUser?.name ?? "Administration",
        });
        count += 1;
      }
      toast.success(`${count} étudiant(s) définitivement inscrit(s) dans ${classeResolue?.nom} (${annee})`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Inscription impossible");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Inscription" }, { label: "Inscription définitive" }]}
        title="Inscription définitive"
        subtitle="Confirmer en statut Actif les étudiants préinscrits ou en attente d'une filière"
        actions={
          <button onClick={() => setLocation("/admin/students")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
          <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); setSelectedIds(new Set()); }} className={inputClass} data-testid="inscription-definitive-filiere">
            <option value="">Sélectionner</option>
            {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
          </select>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année scolaire *</label>
            <select value={annee} onChange={(e) => { setAnnee(e.target.value); setSelectedIds(new Set()); }} className={inputClass} data-testid="inscription-definitive-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => { setNiveauId(e.target.value); setSelectedIds(new Set()); }} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="inscription-definitive-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Spécialité *</label>
          <input value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="Obligatoire pour la confirmation définitive" className={inputClass} data-testid="inscription-definitive-specialite" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
          <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Étudiants à confirmer {selectedIds.size > 0 && <span className="text-primary font-normal text-sm">({selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""})</span>}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!peutSoumettre || saving}
              className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="inscription-definitive-sauvegarder"
            >
              {saving ? "Enregistrement…" : "Sauvegarder"}
            </button>
            <button onClick={() => setLocation("/admin/students")} className="px-5 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </div>

        {!cohorteChoisie ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Info size={18} />
            Choisissez la filière, l&apos;année et le niveau pour lister les étudiants préinscrits ou en attente.
          </div>
        ) : candidats.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun étudiant préinscrit ou en attente dans cette cohorte.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={selectedIds.size === candidats.length && candidats.length > 0} onChange={toggleAll} className="rounded" data-testid="inscription-definitive-tout-selectionner" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Étudiant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Dernière inscription</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Date inscription</th>
              </tr>
            </thead>
            <tbody>
              {candidats.map((stu) => {
                const derniere = dernieresInscriptions.get(stu.id);
                return (
                  <tr
                    key={stu.id}
                    onClick={() => toggle(stu.id)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 transition-colors"
                    data-testid={`inscription-definitive-ligne-${stu.id}`}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(stu.id)} onChange={() => toggle(stu.id)} onClick={(e) => e.stopPropagation()} className="rounded" data-testid={`inscription-definitive-check-${stu.id}`} />
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
                    <td className="px-4 py-3 text-muted-foreground">
                      {derniere ? `${derniere.filiere} — ${derniere.niveau} (${derniere.annee})` : "Aucune"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {derniere ? formatDate(derniere.dateInscription) : "—"}
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
