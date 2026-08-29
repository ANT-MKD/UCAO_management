import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PlusCircle, MinusCircle, Trash2, Info } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { usePortefeuilleCours } from "@/hooks/usePortefeuilleCoursStore";
import {
  enregistrerActionsPortefeuille,
  supprimerActionPortefeuille,
  getEtudiantsAjoutesPourCours,
  getEtudiantsRetiresPourCours,
  type ActionPortefeuille,
  type NouvelleActionPortefeuilleInput,
} from "@/data/portefeuilleCoursStore";
import { cn, formatShortDate } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function MiseAJourCoursEtudiantPage() {
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const ECS = useEcs();
  const UES = useUes();
  const CLASSES = useClasses();
  const portefeuille = usePortefeuilleCours();

  const [action, setAction] = useState<ActionPortefeuille>("ajout");
  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [motif, setMotif] = useState("");
  const [searchStudent, setSearchStudent] = useState("");
  const [selectedEcIds, setSelectedEcIds] = useState<Set<string>>(new Set());
  const [selectedEtudiantIds, setSelectedEtudiantIds] = useState<Set<string>>(new Set());

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const semestre = SEMESTRES.find((s) => s.id === semestreId);
  const classeObj = CLASSES.find((c) => c.id === classeId);

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const classesDisponibles = CLASSES.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);

  const coursDisponibles = useMemo(() => {
    return ECS.filter((ec) => {
      const ue = UES.find((u) => u.id === ec.ueId);
      return !!ue && ue.filiereId === filiereId && ue.niveau === niveau?.alias && ue.semestre === semestre?.alias;
    }).map((ec) => ({ ec, ue: UES.find((u) => u.id === ec.ueId)! }));
  }, [ECS, UES, filiereId, niveau, semestre]);

  // Ajouter cours : recherche libre parmi tous les étudiants (un redoublant qui reprend un
  // seul EC d'un niveau déjà quitté n'est pas membre de cette classe). Supprimer cours : par
  // défaut les membres de la classe (le cas courant), la recherche élargit si besoin.
  const studentsList = useMemo(() => {
    const q = searchStudent.trim().toLowerCase();
    if (q) {
      return etudiants.filter((e) => `${e.prenom} ${e.nom}`.toLowerCase().includes(q) || e.matricule.toLowerCase().includes(q)).slice(0, 60);
    }
    return etudiants.filter((e) => e.classeId === classeId);
  }, [etudiants, searchStudent, classeId]);

  const historique = classeId ? portefeuille.filter((r) => r.classeId === classeId) : [];

  const resetCascade = () => {
    setFiliereId(""); setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId("");
    setSelectedEcIds(new Set()); setSelectedEtudiantIds(new Set()); setMotif(""); setSearchStudent("");
  };
  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId("");
    setSelectedEcIds(new Set()); setSelectedEtudiantIds(new Set());
  };
  const handleAnneeChange = (value: string) => {
    setAnnee(value);
    setNiveauId(""); setClasseId(""); setSemestreId("");
    setSelectedEcIds(new Set()); setSelectedEtudiantIds(new Set());
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId("");
    setSelectedEcIds(new Set()); setSelectedEtudiantIds(new Set());
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId("");
    setSelectedEcIds(new Set()); setSelectedEtudiantIds(new Set());
  };
  const handleSemestreChange = (value: string) => {
    setSemestreId(value);
    setSelectedEcIds(new Set());
  };

  const toggleEc = (id: string) => {
    setSelectedEcIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllEcs = () => {
    setSelectedEcIds((prev) => (prev.size === coursDisponibles.length ? new Set() : new Set(coursDisponibles.map((c) => c.ec.id))));
  };
  const toggleEtudiant = (id: string) => {
    setSelectedEtudiantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAllEtudiants = () => {
    setSelectedEtudiantIds((prev) => (prev.size === studentsList.length ? new Set() : new Set(studentsList.map((e) => e.id))));
  };

  const peutSoumettre = !!classeId && !!semestreId && selectedEcIds.size > 0 && selectedEtudiantIds.size > 0;

  const handleSubmit = () => {
    if (!peutSoumettre || !classeObj) return;
    const ecsChoisis = coursDisponibles.filter((c) => selectedEcIds.has(c.ec.id)).map((c) => c.ec);
    const entries: NouvelleActionPortefeuilleInput[] = [];
    for (const etuId of selectedEtudiantIds) {
      const etu = etudiants.find((e) => e.id === etuId);
      if (!etu) continue;
      for (const ec of ecsChoisis) {
        entries.push({ etudiantId: etu.id, etudiant: `${etu.prenom} ${etu.nom}`, matricule: etu.matricule, ecId: ec.id, ec: ec.libelle });
      }
    }
    enregistrerActionsPortefeuille(entries, classeId, classeObj.nom, action, currentUser?.name ?? "Administration", motif);
    toast.success(
      action === "ajout"
        ? `${entries.length} cours ajouté(s) au portefeuille des étudiants sélectionnés`
        : `${entries.length} cours retiré(s) du portefeuille des étudiants sélectionnés`,
    );
    setSelectedEcIds(new Set()); setSelectedEtudiantIds(new Set()); setMotif("");
  };

  const handleSupprimerHistorique = (id: string) => {
    if (!confirm("Supprimer cette exception ? L'étudiant revient au cursus par défaut de la classe pour ce cours.")) return;
    supprimerActionPortefeuille(id);
    toast.success("Exception supprimée");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Mise à jour cours étudiants" }]}
        title="Mise à jour portefeuille cours étudiant"
        subtitle="Ajouter ou retirer un cours précis pour un ou plusieurs étudiants, en exception du cursus par défaut de leur classe"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-6 mb-5 pb-5 border-b border-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={action === "ajout"} onChange={() => setAction("ajout")} className="w-4 h-4 accent-primary" data-testid="portefeuille-action-ajout" />
            <span className="text-sm font-medium text-foreground flex items-center gap-1"><PlusCircle size={14} className="text-emerald-600" /> Ajouter cours</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={action === "retrait"} onChange={() => setAction("retrait")} className="w-4 h-4 accent-primary" data-testid="portefeuille-action-retrait" />
            <span className="text-sm font-medium text-foreground flex items-center gap-1"><MinusCircle size={14} className="text-red-500" /> Supprimer cours</span>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme *</label>
            <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="portefeuille-filiere">
              <option value="">Sélectionner</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire *</label>
            <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="portefeuille-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="portefeuille-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
            <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="portefeuille-classe">
              <option value="">Sélectionner</option>
              {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
            <select value={semestreId} onChange={(e) => handleSemestreChange(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="portefeuille-semestre">
              <option value="">Sélectionner</option>
              {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motif</label>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. équivalence, redoublement partiel…" className={inputClass} data-testid="portefeuille-motif" />
          </div>
        </div>

        {!semestreId ? (
          <div className="py-10 text-center text-sm text-muted-foreground border-t border-border">
            Choisissez le programme, l&apos;année, le niveau, la classe et la session pour afficher les cours et les étudiants.
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5 pt-4 border-t border-border">
            {/* Cours */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase cursor-pointer">
                  <input type="checkbox" checked={coursDisponibles.length > 0 && selectedEcIds.size === coursDisponibles.length} onChange={toggleAllEcs} className="w-4 h-4 accent-primary" />
                  Les cours ({coursDisponibles.length})
                </label>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {coursDisponibles.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun cours programmé pour cette filière, ce niveau et cette session.</p>
                ) : coursDisponibles.map(({ ec, ue }) => {
                  const nbAjoutes = getEtudiantsAjoutesPourCours(classeId, ec.id).length;
                  const nbRetires = getEtudiantsRetiresPourCours(classeId, ec.id).length;
                  return (
                    <label key={ec.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer" data-testid={`portefeuille-ec-${ec.id}`}>
                      <input type="checkbox" checked={selectedEcIds.has(ec.id)} onChange={() => toggleEc(ec.id)} className="w-4 h-4 accent-primary mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{ec.code} - {ec.libelle}</p>
                        <p className="text-[11px] text-muted-foreground">
                          UE : {ue.libelle} ({ue.obligatoire ? "Obligatoire" : "Optionnelle"}) | Crédit : {ec.credits.toFixed(1)} | VH : {ec.vht.toFixed(1)} | Coef : {ec.coeff.toFixed(1)}
                        </p>
                        {(nbAjoutes > 0 || nbRetires > 0) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {nbAjoutes > 0 && <span className="text-emerald-600">{nbAjoutes} ajout(s)</span>}
                            {nbAjoutes > 0 && nbRetires > 0 && " · "}
                            {nbRetires > 0 && <span className="text-red-500">{nbRetires} retrait(s)</span>}
                            {" "}déjà enregistré(s)
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Étudiants */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/50 border-b border-border space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase cursor-pointer">
                  <input type="checkbox" checked={studentsList.length > 0 && selectedEtudiantIds.size === studentsList.length} onChange={toggleAllEtudiants} className="w-4 h-4 accent-primary" />
                  Les étudiants ({studentsList.length})
                </label>
                <input
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  placeholder="Rechercher n'importe quel étudiant (ex. redoublant d'une autre classe)…"
                  className="w-full px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="portefeuille-recherche-etudiant"
                />
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {studentsList.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun étudiant trouvé.</p>
                ) : studentsList.map((e) => (
                  <label key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer" data-testid={`portefeuille-etudiant-${e.id}`}>
                    <input type="checkbox" checked={selectedEtudiantIds.has(e.id)} onChange={() => toggleEtudiant(e.id)} className="w-4 h-4 accent-primary mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{e.matricule} - {e.prenom} {e.nom}</p>
                      <p className="text-[11px] text-muted-foreground">
                        né(e) le {formatShortDate(e.dateNaissance)}{e.lieuNaissance ? ` à ${e.lieuNaissance}` : ""} | {e.classe} - {e.niveau} - {e.annee} - {e.filiere}
                        {e.classeId !== classeId && <span className="ml-1 font-semibold text-amber-600">(hors classe)</span>}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {semestreId && (
          <div className="flex items-center gap-3 pt-4 mt-4 border-t border-border">
            <button
              onClick={handleSubmit}
              disabled={!peutSoumettre}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                action === "ajout" ? "bg-primary hover:bg-primary/90" : "bg-red-500 hover:bg-red-600",
              )}
              data-testid="portefeuille-soumettre"
            >
              {action === "ajout" ? "Ajouter" : "Supprimer"}
              {selectedEcIds.size > 0 && selectedEtudiantIds.size > 0 ? ` (${selectedEcIds.size} cours × ${selectedEtudiantIds.size} étudiant(s))` : ""}
            </button>
            <button onClick={resetCascade} className="px-5 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
              Annuler
            </button>
          </div>
        )}
      </div>

      {classeId && (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold text-foreground text-sm">Exceptions enregistrées pour {classeObj?.nom}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Info size={11} /> Historique des ajouts/retraits — la ligne la plus récente pour un (étudiant, cours) fait foi.
            </p>
          </div>
          {historique.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">Aucune exception enregistrée pour cette classe.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Étudiant</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Cours</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Action</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Motif</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Par</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {historique.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground">{r.etudiant}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{r.matricule}</p>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{r.ec}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        "text-xs font-semibold px-2.5 py-1 rounded-full",
                        r.action === "ajout" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
                      )}>
                        {r.action === "ajout" ? "Ajouté" : "Retiré"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.motif || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.dateAction}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.effectuePar}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => handleSupprimerHistorique(r.id)} className="w-7 h-7 rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300 flex items-center justify-center hover:bg-red-100 transition-colors" data-testid={`portefeuille-supprimer-${r.id}`}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
