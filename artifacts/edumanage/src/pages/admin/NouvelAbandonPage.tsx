import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { SEMESTRES } from "@/data/mockData";
import { useStudentStore } from "@/hooks/useStudentStore";
import { getPaiementsByEtudiant, type EtudiantRecord } from "@/data/studentStore";
import { useAbandons } from "@/hooks/useAbandonStore";
import { getAbandonActifPourEtudiant, creerAbandon } from "@/data/abandonStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function NouvelAbandonPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  useAbandons(); // souscription pour re-rendre si un abandon change ailleurs pendant la saisie

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [etudiantId, setEtudiantId] = useState("");
  const [sessionsSelectionnees, setSessionsSelectionnees] = useState<Set<string>>(new Set());
  const [dateAbandon, setDateAbandon] = useState(new Date().toISOString().slice(0, 10));
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);

  const etudiant = etudiants.find((e) => e.id === etudiantId);

  const suggestions = searchQuery.trim().length > 0 && !etudiantId
    ? etudiants.filter((e) => {
        if (e.statut === "abandon") return false;
        const q = searchQuery.trim().toLowerCase();
        return (
          e.matricule.toLowerCase().includes(q) ||
          e.prenom.toLowerCase().includes(q) ||
          e.nom.toLowerCase().includes(q) ||
          e.telephone.includes(q)
        );
      })
    : [];

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    setEtudiantId("");
    setSessionsSelectionnees(new Set());
  };

  const handleSelectEtudiant = (e: EtudiantRecord) => {
    setEtudiantId(e.id);
    setSearchQuery(`${e.matricule} - ${e.prenom} ${e.nom} (${e.telephone})`);
    setShowSuggestions(false);
    setSessionsSelectionnees(new Set());
  };

  const sessionsDisponibles = useMemo(() => {
    if (!etudiant) return [];
    return SEMESTRES.filter((s) => s.filiere === etudiant.filiere && s.niveau === etudiant.niveau);
  }, [etudiant]);

  const cumulPaye = useMemo(() => {
    if (!etudiant) return 0;
    return getPaiementsByEtudiant(etudiant.id).reduce((sum, p) => sum + p.montant, 0);
  }, [etudiant]);

  const dejaEnAbandon = etudiant ? getAbandonActifPourEtudiant(etudiant.id) : undefined;

  const toggleSession = (label: string) => {
    setSessionsSelectionnees((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  const peutSoumettre = !!etudiant && !dejaEnAbandon && sessionsSelectionnees.size > 0 && motif.trim().length > 0 && !!dateAbandon;

  const handleSubmit = () => {
    if (!peutSoumettre || !etudiant) return;
    setSaving(true);
    try {
      const record = creerAbandon({
        etudiantId: etudiant.id,
        sessionsAbandonnees: Array.from(sessionsSelectionnees),
        dateAbandon,
        motif: motif.trim(),
        valideParId: currentUser?.id ?? "",
        valideParLabel: currentUser?.name ?? "Administration",
      });
      if (!record) {
        toast.error("Impossible d'enregistrer l'abandon.");
        return;
      }
      toast.success(`Abandon enregistré pour ${etudiant.prenom} ${etudiant.nom}`);
      setLocation("/admin/abandons");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Les abandons" }, { label: "Nouvel abandon" }]}
        title="Nouvel abandon"
        subtitle="Enregistrer l'abandon d'un étudiant — fige sa situation réelle actuelle dans le dossier"
        actions={
          <button onClick={() => setLocation("/admin/abandons")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-5 max-w-2xl" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Étudiant *</label>
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Veuillez saisir le code, le prénom, le nom ou le numéro de téléphone de l'étudiant…"
              className={inputClass}
              data-testid="abandon-recherche"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {suggestions.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleSelectEtudiant(e)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                    data-testid={`abandon-suggestion-${e.id}`}
                  >
                    {e.matricule} - {e.prenom} {e.nom} ({e.telephone})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {etudiant && dejaEnAbandon && (
          <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
            Cet étudiant a déjà un dossier d&apos;abandon actif (depuis le {dejaEnAbandon.dateAbandon}). Réintégrez-le d&apos;abord depuis Les abandons pour en créer un nouveau.
          </p>
        )}

        {etudiant && !dejaEnAbandon && (
          <>
            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <UserAvatar name={`${etudiant.prenom} ${etudiant.nom}`} size="md" />
              <div>
                <p className="font-bold text-foreground">{etudiant.matricule} - {etudiant.prenom} {etudiant.nom}</p>
                <p className="text-xs text-muted-foreground">{etudiant.filiere} · {etudiant.niveau} · {etudiant.classe} · {etudiant.annee}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-xl">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Cumul payé (réel)</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCFA(cumulPaye)}</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-xl">
                <p className="text-[11px] text-red-700 dark:text-red-300">Cumul impayé (solde dû réel)</p>
                <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCFA(etudiant.soldeDu)}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session(s) abandonnée(s) *</label>
              {sessionsDisponibles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune session trouvée pour sa filière et son niveau.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sessionsDisponibles.map((s) => {
                    const label = `${s.nom} (${s.alias})`;
                    const checked = sessionsSelectionnees.has(label);
                    return (
                      <label
                        key={s.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 border rounded-xl text-sm cursor-pointer transition-colors",
                          checked ? "border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "border-border hover:bg-muted",
                        )}
                        data-testid={`abandon-session-${s.id}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleSession(label)} className="w-4 h-4 accent-red-500" />
                        {label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date abandon *</label>
                <input type="date" value={dateAbandon} onChange={(e) => setDateAbandon(e.target.value)} className={inputClass} data-testid="abandon-date" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Validé par</label>
                <input value={currentUser?.name ?? "Administration"} disabled className={cn(inputClass, "disabled:opacity-70")} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motif abandon *</label>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                placeholder="Ex. problème de paiements, déménagement, raisons personnelles…"
                className={inputClass}
                data-testid="abandon-motif"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSubmit}
                disabled={!peutSoumettre || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="abandon-enregistrer"
              >
                <RotateCcw size={14} /> {saving ? "Enregistrement…" : "Enregistrer l'abandon"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
