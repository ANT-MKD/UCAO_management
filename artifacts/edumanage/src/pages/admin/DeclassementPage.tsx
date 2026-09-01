import { useMemo, useState } from "react";
import { AlertOctagon, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, SEMESTRES } from "@/data/mockData";
import { useStudentStore, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import { useDeclassementParametres } from "@/hooks/useDeclassementParametreStore";
import { detecterDeclassementEtudiant, type EtudiantDeclasse } from "@/data/declassementEngine";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function DeclassementPage() {
  const etudiants = useStudentStore();
  const classes = useClasses();
  const annees = useAnneesAcademiques();
  useEvaluations(); // souscription pour re-rendre quand des évaluations/notes changent
  useDeclassementParametres(); // souscription pour re-rendre quand les paramètres changent

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [charge, setCharge] = useState(false);

  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const niveauxDisponibles = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const semestresDisponibles = useMemo(() => SEMESTRES.filter((s) => s.niveauId === niveauId), [niveauId]);
  const semestre = semestresDisponibles.find((s) => s.id === semestreId);
  const classesDisponibles = useMemo(
    () => classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee),
    [classes, filiereId, niveau, annee],
  );

  const etudiantsDeclasses: EtudiantDeclasse[] = useMemo(() => {
    if (!charge || !classeId || !niveau || !semestre) return [];
    const roster = etudiants.filter((e) => e.classeId === classeId);
    return roster
      .map((e) => detecterDeclassementEtudiant(e.id, classeId, filiereId, niveau.alias, annee, semestre.alias))
      .filter((d): d is EtudiantDeclasse => !!d);
  }, [charge, classeId, niveau, semestre, filiereId, annee, etudiants]);

  const etudiantById = useMemo(() => new Map(etudiants.map((e) => [e.id, e])), [etudiants]);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Bulletins" }, { label: "Déclassement élèves" }]}
        title="Déclassement élèves"
        subtitle="Étudiants n'ayant pas assez de notes du type requis (Paramétrage bulletins) pour être normalement évalués"
      />

      <div className="bg-card border border-border rounded-2xl p-5 mb-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-4">Sélection</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
            <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); setSemestreId(""); setClasseId(""); setCharge(false); }} className={inputClass} data-testid="declassement-eleves-filiere">
              <option value="">Sélectionner</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.nom} — {f.code}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année</label>
            <select value={annee} onChange={(e) => { setAnnee(e.target.value); setClasseId(""); setCharge(false); }} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="declassement-eleves-annee">
              <option value="">Sélectionner</option>
              {annees.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau</label>
            <select value={niveauId} onChange={(e) => { setNiveauId(e.target.value); setSemestreId(""); setClasseId(""); setCharge(false); }} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="declassement-eleves-niveau">
              <option value="">Sélectionner</option>
              {niveauxDisponibles.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Semestre</label>
            <select value={semestreId} onChange={(e) => { setSemestreId(e.target.value); setCharge(false); }} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="declassement-eleves-semestre">
              <option value="">Sélectionner</option>
              {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe</label>
            <select value={classeId} onChange={(e) => { setClasseId(e.target.value); setCharge(false); }} disabled={!semestreId} className={cn(inputClass, "disabled:opacity-50")} data-testid="declassement-eleves-classe">
              <option value="">Sélectionner</option>
              {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <button
            onClick={() => setCharge(true)}
            disabled={!classeId}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="declassement-eleves-charger"
          >
            Charger
          </button>
        </div>
      </div>

      {!charge ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertOctagon size={32} className="text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Sélectionnez une classe</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">Choisissez une filière, un niveau et une classe, puis cliquez sur « Charger » pour détecter les étudiants à déclasser.</p>
        </div>
      ) : etudiantsDeclasses.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center" style={{ boxShadow: "var(--shadow-sm)" }}>
          <Users size={32} className="text-emerald-600 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Aucun étudiant à déclasser pour cette classe — tous ont le nombre de notes requis.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <AlertOctagon size={16} className="text-purple-600" />
            <h3 className="text-sm font-bold text-foreground">{etudiantsDeclasses.length} étudiant(s) à déclasser</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Étudiant</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Matricule</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Raisons</th>
              </tr>
            </thead>
            <tbody>
              {etudiantsDeclasses.map((d, i) => {
                const etu = etudiantById.get(d.etudiantId);
                return (
                  <tr key={d.etudiantId} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")} data-testid={`declassement-eleve-${d.etudiantId}`}>
                    <td className="px-5 py-3 font-semibold text-foreground">{etu ? `${etu.prenom} ${etu.nom}` : d.etudiantId}</td>
                    <td className="px-3 py-3"><span className="text-xs font-mono text-muted-foreground">{etu?.matricule ?? "—"}</span></td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        {d.raisons.map((r, j) => (
                          <span key={j} className="text-xs text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-2 py-1 rounded-lg w-fit">
                            {r.ecLibelle} — {r.typeEvaluationLabel} : {r.nbNotesReelles}/{r.nbNotesRequis} note(s)
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
