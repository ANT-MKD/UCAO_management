import { useState } from "react";
import { Plus, Archive, DoorOpen, Calendar, CheckCircle, X, Lock, CalendarRange, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  ouvrirAnneeSuivante,
  setAnneeActuelle,
  addAnneeAcademique,
  archiveAnnee,
  desarchiverAnnee,
  cloturerAnnee,
  setDatesAnnee,
  type AnneeAcademiqueRecord,
  type EtudiantRecord,
  type DecisionPassageAnnee,
} from "@/data/studentStore";
import { getDeliberationAnnuelleForClasse } from "@/data/deliberationAnnuelleStore";
import { useAnneesAcademiques, useStudentStore } from "@/hooks/useStudentStore";
import { cn } from "@/lib/utils";
import { decalerDUnAn, formatDateCourte, premiereAnneeCivile, validerDatesAnnee } from "@/lib/anneeAcademique";
import { toast } from "sonner";

/** Décide le sort d'un étudiant lors de l'ouverture d'année à partir de la délibération annuelle
 * de sa classe : "admis"/"admis_avec_dette" (AJAC) montent au niveau suivant, "redouble" reste au
 * même niveau, "exclu" ne reçoit aucune préinscription. Tant que la délibération de sa classe
 * n'est pas clôturée (ou n'existe pas encore), on n'invente rien : l'étudiant attend. */
function resoudreDecisionAnnuelle(etudiant: EtudiantRecord): DecisionPassageAnnee {
  if (!etudiant.classeId) return "attendre";
  const deliberation = getDeliberationAnnuelleForClasse(etudiant.classeId);
  if (!deliberation || deliberation.statut !== "cloturee") return "attendre";
  const ligne = deliberation.lignes.find((l) => l.etudiantId === etudiant.id);
  if (!ligne) return "attendre";
  if (ligne.decisionFinale === "exclu") return "exclure";
  if (ligne.decisionFinale === "redouble") return "meme_niveau";
  return "monter";
}

/** Dates proposées pour une nouvelle année : celles de l'année datée la plus récente, décalées du
 * nombre d'années qui les sépare (même jour de rentrée). Vide s'il n'existe aucune année datée —
 * on ne devine pas un calendrier. Toujours modifiable avant validation. */
function suggererDates(libelle: string, annees: AnneeAcademiqueRecord[]): { dateDebut: string; dateFin: string } {
  const cible = premiereAnneeCivile(libelle);
  const reference = [...annees]
    .filter((a) => a.dateDebut && a.dateFin && Number.isFinite(premiereAnneeCivile(a.libelle)))
    .sort((a, b) => b.libelle.localeCompare(a.libelle))[0];
  if (!Number.isFinite(cible) || !reference?.dateDebut || !reference.dateFin) return { dateDebut: "", dateFin: "" };
  const ecart = cible - premiereAnneeCivile(reference.libelle);
  if (ecart <= 0) return { dateDebut: "", dateFin: "" };
  let { dateDebut, dateFin } = reference as { dateDebut: string; dateFin: string };
  for (let i = 0; i < ecart; i++) {
    dateDebut = decalerDUnAn(dateDebut);
    dateFin = decalerDUnAn(dateFin);
  }
  return { dateDebut, dateFin };
}

export default function AnneesAcademiquesPage() {
  const annees = useAnneesAcademiques();
  const etudiants = useStudentStore();
  const [showModal, setShowModal] = useState(false);
  const [newAnnee, setNewAnnee] = useState("");
  const [newDebut, setNewDebut] = useState("");
  const [newFin, setNewFin] = useState("");
  const [createError, setCreateError] = useState("");
  const [editing, setEditing] = useState<AnneeAcademiqueRecord | null>(null);
  const [editDebut, setEditDebut] = useState("");
  const [editFin, setEditFin] = useState("");
  const [editError, setEditError] = useState("");
  const [promoting, setPromoting] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState("");

  const handleLibelleChange = (libelle: string) => {
    setNewAnnee(libelle);
    setCreateError("");
    // Pré-remplit les dates dès que le libellé est complet, sans écraser une saisie déjà faite.
    if (/^\d{4}-\d{4}$/.test(libelle) && !newDebut && !newFin) {
      const s = suggererDates(libelle, annees);
      setNewDebut(s.dateDebut);
      setNewFin(s.dateFin);
    }
  };

  const fermerCreation = () => {
    setShowModal(false);
    setNewAnnee("");
    setNewDebut("");
    setNewFin("");
    setCreateError("");
  };

  const handleCreate = () => {
    const [a, b] = newAnnee.split("-").map(Number);
    if (!/^\d{4}-\d{4}$/.test(newAnnee) || b !== a + 1) {
      setCreateError("Le libellé doit suivre le format 2026-2027 (deux années consécutives).");
      return;
    }
    if (annees.some((x) => x.libelle === newAnnee)) {
      setCreateError(`L'année ${newAnnee} existe déjà.`);
      return;
    }
    const erreur = validerDatesAnnee(newAnnee, newDebut, newFin);
    if (erreur) {
      setCreateError(erreur);
      return;
    }
    addAnneeAcademique(newAnnee, { dateDebut: newDebut, dateFin: newFin });
    toast.success(`Année ${newAnnee} créée — rentrée le ${formatDateCourte(newDebut)}`);
    fermerCreation();
  };

  const ouvrirDates = (a: AnneeAcademiqueRecord) => {
    setEditing(a);
    const s = a.dateDebut && a.dateFin ? { dateDebut: a.dateDebut, dateFin: a.dateFin } : suggererDates(a.libelle, annees);
    setEditDebut(s.dateDebut);
    setEditFin(s.dateFin);
    setEditError("");
  };

  const handleSaveDates = () => {
    if (!editing) return;
    const res = setDatesAnnee(editing.id, editDebut, editFin);
    if (!res.ok) {
      setEditError(res.reason ?? "Dates refusées.");
      return;
    }
    toast.success(`Dates de l'année ${editing.libelle} enregistrées`);
    setEditing(null);
  };

  const handleOuvrirAnnee = (id: string) => {
    setPromoting(id);
    setTimeout(() => {
      const { count, nextLabel, classesCreated, enAttente, exclus } = ouvrirAnneeSuivante(id, resoudreDecisionAnnuelle);
      setPromoting(null);
      const details: string[] = [];
      if (classesCreated > 0) details.push(`${classesCreated} classe${classesCreated > 1 ? "s" : ""} créée${classesCreated > 1 ? "s" : ""}`);
      if (enAttente > 0) details.push(`${enAttente} en attente de délibération (à traiter via Réinscription une fois le jury statué)`);
      if (exclus > 0) details.push(`${exclus} exclu${exclus > 1 ? "s" : ""} (aucune préinscription créée)`);
      const suffixe = details.length > 0 ? ` — ${details.join(", ")}` : "";
      setDoneMsg(`Année ${nextLabel} ouverte : ${count} préinscription${count > 1 ? "s" : ""} créée${count > 1 ? "s" : ""}${suffixe}`);
      setTimeout(() => setDoneMsg(""), 8000);
    }, 800);
  };

  const handleCloture = (id: string, libelle: string) => {
    if (!confirm(`Clôturer définitivement l'année ${libelle} ? Les modifications académiques seront figées.`)) return;
    cloturerAnnee(id);
    toast.success(`Année ${libelle} clôturée`);
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Années Académiques" }]}
        title="Gestion des Années Académiques"
        subtitle="Créer, clôturer, archiver et ouvrir l'année N+1"
        actions={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Nouvelle année
          </button>
        }
      />

      {doneMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle size={16} /> {doneMsg}
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-4">
        Ces actions s&apos;appliquent à toute l&apos;année scolaire d&apos;un coup. « Ouvrir l&apos;année suivante » consulte la délibération annuelle clôturée de chaque classe : admis et admis avec dette (AJAC) montent au niveau suivant, les redoublants restent au même niveau, les exclus ne sont pas préinscrits, et les étudiants sans délibération clôturée attendent (à traiter ensuite via Réinscription, ou en relançant l&apos;action plus tard). Elle crée aussi automatiquement la classe d&apos;entrée (L1/BTS1/M1...) de chaque filière active pour les nouveaux inscrits. Pour clôturer ou faire basculer une classe en particulier, utilisez plutôt Classe &gt; Clôture année / Bascule année.
      </p>

      <div className="space-y-4">
        {annees.map((a) => (
          <div key={a.id} className={cn("bg-card border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4", a.actuelle ? "border-primary ring-1 ring-primary/20" : "border-border", a.archivee && "opacity-60")} style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-3 flex-1">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", a.actuelle ? "bg-primary/10" : "bg-muted")}>
                <Calendar size={22} className={a.actuelle ? "text-primary" : "text-muted-foreground"} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{a.libelle}</h3>
                  {a.actuelle && <StatusBadge status="actif" />}
                  {a.cloturee && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">Clôturée</span>}
                  {a.archivee && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">Archivée</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {etudiants.filter((e) => e.annee === a.libelle).length} étudiants inscrits
                </p>
                {a.dateDebut && a.dateFin ? (
                  <p className="text-xs text-foreground mt-1 flex items-center gap-1.5" data-testid={`annee-dates-${a.libelle}`}>
                    <CalendarRange size={12} className="text-muted-foreground" />
                    Rentrée le {formatDateCourte(a.dateDebut)} · fin le {formatDateCourte(a.dateFin)}
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1.5" data-testid={`annee-dates-${a.libelle}`}>
                    <AlertTriangle size={12} />
                    Dates non renseignées — les mois de vacation suivent septembre → août par défaut
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {a.archivee ? (
                <button onClick={() => desarchiverAnnee(a.id)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-muted transition-colors">
                  <Archive size={12} /> Désarchiver
                </button>
              ) : (
                <>
                  {!a.cloturee && (
                    <button
                      onClick={() => ouvrirDates(a)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-muted transition-colors"
                      data-testid={`annee-modifier-dates-${a.libelle}`}
                    >
                      <CalendarRange size={12} /> {a.dateDebut ? "Modifier les dates" : "Renseigner les dates"}
                    </button>
                  )}
                  {!a.actuelle && !a.cloturee && (
                    <button onClick={() => setAnneeActuelle(a.id)} className="px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-muted transition-colors">
                      Définir comme courante
                    </button>
                  )}
                  {!a.cloturee && (
                    <button
                      onClick={() => handleOuvrirAnnee(a.id)}
                      disabled={promoting === a.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      title="Fait monter les cohortes existantes d'un niveau et crée la classe d'entrée de chaque filière pour les nouveaux inscrits"
                    >
                      <DoorOpen size={12} /> {promoting === a.id ? "Ouverture..." : "Ouvrir l'année suivante"}
                    </button>
                  )}
                  {!a.cloturee && (
                    <button
                      onClick={() => handleCloture(a.id, a.libelle)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-muted transition-colors"
                    >
                      <Lock size={12} /> Clôturer
                    </button>
                  )}
                  {!a.actuelle && (
                    <button onClick={() => archiveAnnee(a.id)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
                      <Archive size={12} /> Archiver
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={fermerCreation}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Créer une année académique</h3>
              <button onClick={fermerCreation}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="annee-libelle" className="block text-xs font-medium text-muted-foreground mb-1.5">Libellé (ex: 2026-2027)</label>
                <input id="annee-libelle" value={newAnnee} onChange={(e) => handleLibelleChange(e.target.value)} placeholder="2026-2027" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="annee-debut" className="block text-xs font-medium text-muted-foreground mb-1.5">Date de rentrée *</label>
                  <input id="annee-debut" type="date" value={newDebut} onChange={(e) => { setNewDebut(e.target.value); setCreateError(""); }} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="annee-fin" className="block text-xs font-medium text-muted-foreground mb-1.5">Date de fin *</label>
                  <input id="annee-fin" type="date" value={newFin} onChange={(e) => { setNewFin(e.target.value); setCreateError(""); }} className={inputClass} />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Mêmes dates pour toute l&apos;université. Elles déterminent les mois proposés pour les vacations des enseignants.
              </p>
              {createError && <p className="text-xs text-red-600" role="alert">{createError}</p>}
            </div>
            <button onClick={handleCreate} className="w-full mt-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90" data-testid="annee-creer">
              Créer l&apos;année
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Dates de l&apos;année {editing.libelle}</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="annee-edit-debut" className="block text-xs font-medium text-muted-foreground mb-1.5">Date de rentrée</label>
                <input id="annee-edit-debut" type="date" value={editDebut} onChange={(e) => { setEditDebut(e.target.value); setEditError(""); }} className={inputClass} />
              </div>
              <div>
                <label htmlFor="annee-edit-fin" className="block text-xs font-medium text-muted-foreground mb-1.5">Date de fin</label>
                <input id="annee-edit-fin" type="date" value={editFin} onChange={(e) => { setEditFin(e.target.value); setEditError(""); }} className={inputClass} />
              </div>
            </div>
            {editError && <p className="text-xs text-red-600 mt-3" role="alert">{editError}</p>}
            <button onClick={handleSaveDates} className="w-full mt-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90" data-testid="annee-enregistrer-dates">
              Enregistrer les dates
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
