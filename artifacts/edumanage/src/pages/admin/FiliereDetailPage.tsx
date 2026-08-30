import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Edit, GraduationCap, Layers, BookOpen, Wallet } from "lucide-react";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatCFA } from "@/lib/utils";
import { useFilieres } from "@/hooks/useFiliereStore";
import { useUes, useEcs } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useGrillesFrais } from "@/hooks/useGrilleFraisStore";
import { useModelesFrais } from "@/hooks/useFinanceSettingsStore";
import { cn } from "@/lib/utils";

interface FiliereDetailPageProps {
  id: string;
}

export default function FiliereDetailPage({ id }: FiliereDetailPageProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("informations");

  const filieres = useFilieres();
  const filiere = filieres.find((f) => f.id === id);
  const ues = useUes();
  const ecs = useEcs();
  const classes = useClasses();
  const etudiants = useStudentStore();
  const grillesFrais = useGrillesFrais();
  const modelesFrais = useModelesFrais();

  const filiereUes = useMemo(() => ues.filter((u) => u.filiereId === id), [ues, id]);
  const filiereEcs = useMemo(() => {
    const ueIds = new Set(filiereUes.map((u) => u.id));
    return ecs.filter((e) => ueIds.has(e.ueId));
  }, [ecs, filiereUes]);
  const filiereGrilles = useMemo(() => grillesFrais.filter((g) => g.filiereId === id), [grillesFrais, id]);
  const nbClasses = classes.filter((c) => c.filiereId === id).length;
  const nbEtudiants = etudiants.filter((e) => e.filiereId === id).length;

  if (!filiere) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-bold text-foreground mb-2">Filière introuvable</h2>
        <button onClick={() => setLocation("/admin/filieres")} className="text-primary hover:underline text-sm">
          Retour à la liste
        </button>
      </div>
    );
  }

  const TABS = [
    { key: "informations", label: "Informations", icon: GraduationCap },
    { key: "ues", label: "Unités d'enseignement", icon: Layers },
    { key: "cours", label: "Cours dispensés", icon: BookOpen },
    { key: "frais", label: "Frais à payer", icon: Wallet },
  ];

  return (
    <div>
      <button
        onClick={() => setLocation("/admin/filieres")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        data-testid="btn-back"
      >
        <ArrowLeft size={15} /> Retour aux filières
      </button>

      <div className="bg-card border border-border rounded-2xl p-6 mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <UserAvatar name={filiere.nom} size="lg" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-extrabold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
              {filiere.nom}
            </h1>
            <StatusBadge status={filiere.statut} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono font-bold text-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>{filiere.code}</span>
            {filiere.cycle && <><span>·</span><span>{filiere.typeProgramme === "annuel" ? "Programme annuel" : "Programme semestriel"} en cycle {filiere.cycle}</span></>}
            {filiere.entite && <><span>·</span><span>Rattaché à l&apos;entité {filiere.entite}</span></>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>Sous la responsabilité de {filiere.responsable || "—"}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
          <button onClick={() => setLocation(`/admin/filieres/${filiere.id}/edit`)} className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-xl text-xs font-medium hover:bg-muted transition-colors">
            <Edit size={13} /> Modifier
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap",
              activeTab === tab.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`tab-${tab.key}`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        {activeTab === "informations" && (
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3 text-sm">
              <h3 className="font-bold text-foreground mb-2">Programme</h3>
              {[
                ["Code", filiere.code],
                ["Cycle", filiere.cycle || "—"],
                ["Type de programme", filiere.typeProgramme === "annuel" ? "Annuel" : "Semestriel"],
                ["Entité de rattachement", filiere.entite || "—"],
                ["Responsable", filiere.responsable || "—"],
                ["Statut", filiere.statut === "actif" ? "Actif" : "Inactif"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground">{v}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-bold text-foreground mb-2">Années scolaires</h3>
                {filiere.anneesActives?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {filiere.anneesActives.map((a) => <span key={a} className="text-xs px-2 py-1 rounded-lg bg-muted font-medium">{a}</span>)}
                  </div>
                ) : <p className="text-muted-foreground">Aucune année active définie</p>}
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-2">Effectifs</h3>
                <div className="flex gap-4">
                  <span><strong>{nbClasses}</strong> classe(s)</span>
                  <span><strong>{nbEtudiants}</strong> étudiant(s)</span>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-2">Spécialité</h3>
                <p className="text-muted-foreground">{filiere.specialite || "Aucune spécialité définie pour ce programme"}</p>
              </div>
              {filiere.informationsComplementaires && (
                <div>
                  <h3 className="font-bold text-foreground mb-2">Informations complémentaires</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{filiere.informationsComplementaires}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "ues" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">{filiereUes.length} unité(s) d&apos;enseignement</p>
            {filiereUes.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 text-sm">
                <div>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-lg mr-2">{u.code}</span>
                  <span className="font-medium text-foreground">{u.libelle}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{u.niveau}</span>
                  <span>{u.semestre}</span>
                  <span>{u.credits} crédits</span>
                  <span>{u.nbEc} EC</span>
                </div>
              </div>
            ))}
            {filiereUes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucune UE rattachée à cette filière.</p>}
          </div>
        )}

        {activeTab === "cours" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-3">{filiereEcs.length} cours (EC) dispensé(s)</p>
            {filiereEcs.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 text-sm">
                <div>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-lg mr-2">{e.code}</span>
                  <span className="font-medium text-foreground">{e.libelle}</span>
                  {e.abrege && <span className="ml-2 text-xs text-muted-foreground">({e.abrege})</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>UE {e.ue}</span>
                  <span>{e.vht}h VHT</span>
                  <span>{e.responsable || "Non assigné"}</span>
                </div>
              </div>
            ))}
            {filiereEcs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun cours dispensé pour cette filière.</p>}
          </div>
        )}

        {activeTab === "frais" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">{filiereGrilles.length} grille(s) de frais configurée(s)</p>
            {filiereGrilles.map((g) => {
              const total = g.lignes.reduce((sum, l) => sum + l.montant, 0);
              const modele = modelesFrais.find((m) => m.id === g.modeleFraisId);
              return (
                <div key={g.id} className="border border-border rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-foreground text-sm">{g.niveau} — {g.annee}{modele ? ` — ${modele.intitule}` : ""}</span>
                    <span className="font-bold text-foreground">{formatCFA(total)}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                    {g.lignes.map((l) => (
                      <div key={l.id} className="flex justify-between">
                        <span>{l.intitule}</span>
                        <span>{formatCFA(l.montant)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {filiereGrilles.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucune grille de frais configurée pour cette filière.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
