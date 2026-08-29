import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, LayoutGrid, ChevronDown, ChevronRight, CheckCircle2, Award } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES } from "@/data/mockData";
import { useClasses } from "@/hooks/useStructureStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useStudentStore, useNotes } from "@/hooks/useStudentStore";
import { getPoidsForClasseEc } from "@/data/evaluationStore";
import { getEffectiveNote, type EtudiantRecord } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const POIDS_CC_DEFAUT = 30;
const POIDS_EXAMEN_DEFAUT = 70;

interface EcLigne {
  id: string;
  code: string;
  libelle: string;
  credits: number;
  cc?: number;
  ef?: number;
  moyenne?: number;
  creditsObtenus: number;
  validee: boolean;
}

interface UeLigne {
  id: string;
  code: string;
  libelle: string;
  credits: number;
  ecs: EcLigne[];
  moyenne?: number;
  creditsObtenus: number;
  validee: boolean;
}

export default function BulletinEtudiantPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  useNotes(); // souscription pour re-rendre quand les notes (dont le rattrapage) changent
  const classes = useClasses();
  const ecs = useEcs();
  const ues = useUes();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [etudiantId, setEtudiantId] = useState("");
  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [expandedUe, setExpandedUe] = useState<Set<string>>(new Set());

  const etudiant = etudiants.find((e) => e.id === etudiantId);
  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const semestre = SEMESTRES.find((s) => s.id === semestreId);

  const suggestions = searchQuery.trim().length > 0 && !etudiantId
    ? etudiants.filter((e) => {
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
    setFiliereId(""); setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId("");
  };

  const handleSelectEtudiant = (e: EtudiantRecord) => {
    setEtudiantId(e.id);
    setSearchQuery(`${e.matricule} - ${e.prenom} ${e.nom} (${e.telephone})`);
    setShowSuggestions(false);
    // Préremplit Filière/Année/Niveau/Classe à partir de l'inscription réelle et actuelle de
    // l'étudiant ; la cascade normale reste active ensuite pour consulter un autre bulletin
    // (une session antérieure, par ex.) sans perdre l'étudiant sélectionné.
    setFiliereId(e.filiereId);
    setAnnee(e.annee);
    const niveauMatch = NIVEAUX.find((n) => n.filiereId === e.filiereId && n.alias === e.niveau);
    setNiveauId(niveauMatch?.id ?? "");
    setClasseId(e.classeId);
    setSemestreId("");
    setExpandedUe(new Set());
  };

  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId(""); setExpandedUe(new Set());
  };
  const handleAnneeChange = (value: string) => {
    setAnnee(value);
    setNiveauId(""); setClasseId(""); setSemestreId(""); setExpandedUe(new Set());
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId(""); setExpandedUe(new Set());
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId(""); setExpandedUe(new Set());
  };
  const handleSemestreChange = (value: string) => {
    setSemestreId(value);
    setExpandedUe(new Set());
  };

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const classesDisponibles = classes.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);

  const uesSession = ues.filter((u) => u.filiereId === filiereId && u.niveau === niveau?.alias && u.semestre === semestre?.alias);

  const bulletin: UeLigne[] = uesSession.map((ue): UeLigne => {
    const ecsUe = ecs.filter((ec) => ec.ueId === ue.id);
    const ecLignes: EcLigne[] = ecsUe.map((ec): EcLigne => {
      const cc = getEffectiveNote(etudiantId, classeId, ec.id, "CC")?.note;
      const ef = getEffectiveNote(etudiantId, classeId, ec.id, "EF")?.note;
      const { devoir, examen } = getPoidsForClasseEc(classeId, ec.id);
      const poidsCc = (devoir ?? POIDS_CC_DEFAUT) / 100;
      const poidsExamen = (examen ?? POIDS_EXAMEN_DEFAUT) / 100;
      const moyenne = cc !== undefined && ef !== undefined ? cc * poidsCc + ef * poidsExamen : undefined;
      const validee = moyenne !== undefined && moyenne >= 10;
      return { id: ec.id, code: ec.code, libelle: ec.libelle, credits: ec.credits, cc, ef, moyenne, creditsObtenus: validee ? ec.credits : 0, validee };
    });
    const ecsAvecMoyenne = ecLignes.filter((l) => l.moyenne !== undefined);
    const totalCreditsAvecMoyenne = ecsAvecMoyenne.reduce((s, l) => s + l.credits, 0);
    const moyenneUe = totalCreditsAvecMoyenne > 0
      ? ecsAvecMoyenne.reduce((s, l) => s + l.moyenne! * l.credits, 0) / totalCreditsAvecMoyenne
      : undefined;
    const valideeUe = moyenneUe !== undefined && moyenneUe >= 10;
    return {
      id: ue.id, code: ue.code, libelle: ue.libelle, credits: ue.credits, ecs: ecLignes,
      moyenne: moyenneUe, creditsObtenus: valideeUe ? ue.credits : 0, validee: valideeUe,
    };
  });

  const uesAvecMoyenne = bulletin.filter((u) => u.moyenne !== undefined);
  const totalCreditsUeAvecMoyenne = uesAvecMoyenne.reduce((s, u) => s + u.credits, 0);
  const moyenneSession = totalCreditsUeAvecMoyenne > 0
    ? uesAvecMoyenne.reduce((s, u) => s + u.moyenne! * u.credits, 0) / totalCreditsUeAvecMoyenne
    : undefined;
  const creditsObtenusTotal = bulletin.reduce((s, u) => s + u.creditsObtenus, 0);
  const creditsTotal = bulletin.reduce((s, u) => s + u.credits, 0);

  const toggleUe = (id: string) => {
    setExpandedUe((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const canShowBulletin = !!etudiantId && !!semestreId;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Bulletin étudiants" }]}
        title="Consultation bulletin"
        subtitle="Bulletin réel d'un étudiant pour une classe et une session, calculé à partir des vraies notes"
        actions={
          <button onClick={() => setLocation("/admin/notes")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Étudiant</label>
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Veuillez saisir le code, le prénom, le nom ou le numéro de téléphone de l'étudiant…"
            className={inputClass}
            data-testid="bulletin-etudiant-recherche"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {suggestions.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleSelectEtudiant(e)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                  data-testid={`bulletin-etudiant-suggestion-${e.id}`}
                >
                  {e.matricule} - {e.prenom} {e.nom} ({e.telephone})
                </button>
              ))}
            </div>
          )}
        </div>

        {etudiant && (
          <>
            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border">
              <UserAvatar name={`${etudiant.prenom} ${etudiant.nom}`} size="md" />
              <div>
                <p className="font-bold text-foreground">{etudiant.matricule} - {etudiant.prenom} {etudiant.nom}</p>
                <p className="text-xs text-muted-foreground">{etudiant.filiere} · {etudiant.classe}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
                <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="bulletin-filiere">
                  <option value="">Sélectionner</option>
                  {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année *</label>
                <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="bulletin-annee">
                  <option value="">Sélectionner</option>
                  {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
                <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="bulletin-niveau">
                  <option value="">Sélectionner</option>
                  {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
                <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="bulletin-classe">
                  <option value="">Sélectionner</option>
                  {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
                <select value={semestreId} onChange={(e) => handleSemestreChange(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="bulletin-session">
                  <option value="">Sélectionner</option>
                  {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {canShowBulletin && (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-6 px-5 py-4 border-b border-border bg-primary/5 flex-wrap">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-primary" />
              <span className="text-sm text-muted-foreground">Moyenne session :</span>
              <span className={cn("text-lg font-bold", moyenneSession !== undefined ? (moyenneSession >= 10 ? "text-emerald-600" : "text-red-500") : "text-muted-foreground")}>
                {moyenneSession !== undefined ? moyenneSession.toFixed(2) : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <LayoutGrid size={16} className="text-primary" />
              <span className="text-sm text-muted-foreground">Nombre de crédits obtenus :</span>
              <span className="text-lg font-bold text-foreground">{creditsObtenusTotal} / {creditsTotal}</span>
            </div>
          </div>

          {bulletin.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Aucune UE programmée pour cette filière, ce niveau et cette session.</div>
          ) : (
            <div className="divide-y divide-border">
              {bulletin.map((ue) => {
                const expanded = expandedUe.has(ue.id);
                return (
                  <div key={ue.id}>
                    <button onClick={() => toggleUe(ue.id)} className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/30 transition-colors text-left" data-testid={`bulletin-ue-${ue.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {expanded ? <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />}
                        <span className="font-semibold text-foreground truncate">{ue.code} - {ue.libelle}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                        <span>Nombre crédit UE : <strong className="text-foreground">{ue.credits.toFixed(1)}</strong></span>
                        <span>Nombre de crédits obtenus : <strong className="text-foreground">{ue.creditsObtenus.toFixed(1)}</strong></span>
                        <span>Moyenne UE : <strong className={ue.moyenne !== undefined ? (ue.validee ? "text-emerald-600" : "text-red-500") : "text-muted-foreground"}>{ue.moyenne !== undefined ? ue.moyenne.toFixed(1) : "En attente"}</strong></span>
                        {ue.moyenne !== undefined && (ue.validee ? <CheckCircle2 size={14} className="text-emerald-600" /> : <span className="text-red-500 font-bold">✕</span>)}
                      </div>
                    </button>
                    {expanded && (
                      <div className="pb-2">
                        {ue.ecs.map((ec) => (
                          <div key={ec.id} className="flex items-center justify-between gap-3 px-5 py-2 pl-11 text-xs" data-testid={`bulletin-ec-${ec.id}`}>
                            <span className="text-foreground">{ec.libelle}</span>
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>Nombre crédits : <strong className="text-foreground">{ec.credits.toFixed(1)}</strong></span>
                              <span>Nombre crédits obtenus : <strong className="text-foreground">{ec.creditsObtenus.toFixed(1)}</strong></span>
                              <span>Moyenne : <strong className={ec.moyenne !== undefined ? (ec.validee ? "text-emerald-600" : "text-red-500") : "text-amber-600"}>{ec.moyenne !== undefined ? ec.moyenne.toFixed(1) : "En attente"}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
