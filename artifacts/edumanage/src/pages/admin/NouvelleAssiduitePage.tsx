import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Info, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useSeances, useCahiers } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import {
  getCahierPourSeanceEtDate,
  justifierPresenceCahier,
  creerCahierSecoursAdmin,
  type CahierPresenceEntry,
} from "@/data/studentStore";
import { usePortefeuilleCours } from "@/hooks/usePortefeuilleCoursStore";
import { getEtudiantsAjoutesPourCours, getEtudiantsRetiresPourCours } from "@/data/portefeuilleCoursStore";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function NouvelleAssiduitePage() {
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const ECS = useEcs();
  const UES = useUes();
  const CLASSES = useClasses();
  const seances = useSeances();
  useCahiers(); // souscription pour re-rendre quand un cahier (ou sa justification) change
  usePortefeuilleCours(); // souscription pour re-rendre quand une exception cours étudiant change

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [ecId, setEcId] = useState("");
  const [seanceId, setSeanceId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [edits, setEdits] = useState<Record<string, { justifie: boolean; justificatif: string }>>({});
  const [secoursPresences, setSecoursPresences] = useState<CahierPresenceEntry[]>([]);
  const [modeSecours, setModeSecours] = useState(false);

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const semestre = SEMESTRES.find((s) => s.id === semestreId);

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const classesDisponibles = CLASSES.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);
  const coursDisponibles = ECS.filter((ec) => {
    const ue = UES.find((u) => u.id === ec.ueId);
    return !!ue && ue.filiereId === filiereId && ue.niveau === niveau?.alias && ue.semestre === semestre?.alias;
  });
  const seancesDisponibles = useMemo(
    () => seances.filter((s) => s.classeId === classeId && s.ecId === ecId),
    [seances, classeId, ecId],
  );

  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId(""); setSeanceId("");
    setEdits({}); setModeSecours(false);
  };
  const handleAnneeChange = (value: string) => {
    setAnnee(value);
    setNiveauId(""); setClasseId(""); setSemestreId(""); setEcId(""); setSeanceId("");
    setEdits({}); setModeSecours(false);
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId(""); setEcId(""); setSeanceId("");
    setEdits({}); setModeSecours(false);
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId(""); setEcId(""); setSeanceId("");
    setEdits({}); setModeSecours(false);
  };
  const handleSemestreChange = (value: string) => {
    setSemestreId(value);
    setEcId(""); setSeanceId("");
    setEdits({}); setModeSecours(false);
  };
  const handleCoursChange = (value: string) => {
    setEcId(value);
    const matches = seances.filter((s) => s.classeId === classeId && s.ecId === value);
    setSeanceId(matches.length === 1 ? matches[0].id : "");
    setEdits({}); setModeSecours(false);
  };
  const handleDateChange = (value: string) => {
    setDate(value);
    setEdits({}); setModeSecours(false);
  };

  const cahier = seanceId && date ? getCahierPourSeanceEtDate(seanceId, date) : undefined;
  const absentsRetards = cahier ? cahier.presences.filter((p) => p.statut !== "present") : [];

  const getEdit = (etudiantId: string) => edits[etudiantId] ?? { justifie: false, justificatif: "" };

  const startSecours = () => {
    const etudiantsRetiresIds = new Set(getEtudiantsRetiresPourCours(classeId, ecId));
    const etudiantsAjoutesIds = new Set(getEtudiantsAjoutesPourCours(classeId, ecId));
    const classeStudents = etudiants.filter((e) => {
      if (e.statut === "abandon") return false;
      const estMembre = e.classeId === classeId;
      const estAjoute = etudiantsAjoutesIds.has(e.id);
      return (estMembre && !etudiantsRetiresIds.has(e.id)) || estAjoute;
    });
    setSecoursPresences(classeStudents.map((s) => ({ etudiantId: s.id, nom: `${s.prenom} ${s.nom}`, statut: "present" as const, justification: "" })));
    setModeSecours(true);
  };

  const setSecoursStatut = (id: string, statut: CahierPresenceEntry["statut"]) => {
    setSecoursPresences((prev) => prev.map((p) => (p.etudiantId === id ? { ...p, statut, justification: statut === "absent" ? p.justification : "", retardMinutes: statut === "retard" ? p.retardMinutes : undefined } : p)));
  };

  const handleSaveJustifications = () => {
    if (!cahier) return;
    let count = 0;
    for (const p of absentsRetards) {
      const e = edits[p.etudiantId];
      if (!e) continue;
      justifierPresenceCahier(cahier.id, p.etudiantId, e.justificatif, e.justifie);
      count++;
    }
    toast.success(count > 0 ? `${count} justification(s) enregistrée(s)` : "Aucune modification à enregistrer");
    setEdits({});
  };

  const handleSaveSecours = () => {
    if (!seanceId || !date) return;
    creerCahierSecoursAdmin(seanceId, date, secoursPresences, currentUser?.name ?? "Administration");
    toast.success("Assiduité de secours enregistrée — aucun cahier de textes n'existait pour cette séance");
    setModeSecours(false);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Assiduité" }, { label: "Nouvelle assiduité" }]}
        title="Nouvelle assiduité"
        subtitle="Justifier une absence ou un retard déjà constaté par le cahier de textes du professeur"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme *</label>
            <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="assiduite-filiere">
              <option value="">Sélectionner</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire *</label>
            <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="assiduite-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="assiduite-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
            <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="assiduite-classe">
              <option value="">Sélectionner</option>
              {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
            <select value={semestreId} onChange={(e) => handleSemestreChange(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="assiduite-semestre">
              <option value="">Sélectionner</option>
              {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cours *</label>
            <select value={ecId} onChange={(e) => handleCoursChange(e.target.value)} disabled={!semestreId} className={cn(inputClass, "disabled:opacity-50")} data-testid="assiduite-cours">
              <option value="">Sélectionner</option>
              {coursDisponibles.map((ec) => <option key={ec.id} value={ec.id}>{ec.code} — {ec.libelle}</option>)}
            </select>
          </div>
          {seancesDisponibles.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Séance *</label>
              <select value={seanceId} onChange={(e) => { setSeanceId(e.target.value); setEdits({}); setModeSecours(false); }} className={inputClass} data-testid="assiduite-seance">
                <option value="">Sélectionner</option>
                {seancesDisponibles.map((s) => <option key={s.id} value={s.id}>{["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][s.jour]} {s.heureDebut}–{s.heureFin} ({s.salle})</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date *</label>
            <input type="date" value={date} onChange={(e) => handleDateChange(e.target.value)} disabled={!ecId} className={cn(inputClass, "disabled:opacity-50")} data-testid="assiduite-date" />
          </div>
        </div>
      </div>

      {!seanceId || !date ? (
        <div className="py-12 text-center bg-card border border-border rounded-xl text-sm text-muted-foreground" style={{ boxShadow: "var(--shadow-sm)" }}>
          Choisissez le cours, la séance et la date pour retrouver le cahier de textes de cette séance.
        </div>
      ) : cahier ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-bold text-foreground">{cahier.ec} — {cahier.classe}</h3>
            <p className="text-xs text-muted-foreground">Séance du {date} · Professeur : {cahier.prof} · Taux de présence : {cahier.tauxPresence}%</p>
          </div>
          {absentsRetards.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">Aucun absent ni retardataire sur cette séance selon le cahier de textes.</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Étudiant</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Absence / Retard</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Durée (min)</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Justifié ?</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Justificatif</th>
                  </tr>
                </thead>
                <tbody>
                  {absentsRetards.map((p) => {
                    const edit = getEdit(p.etudiantId);
                    const isDejaJustifie = !!p.justification && !edits[p.etudiantId];
                    return (
                      <tr key={p.etudiantId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium text-foreground">{p.nom}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", p.statut === "absent" ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300")}>
                            {p.statut === "absent" ? "Absence" : "Retard"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center text-muted-foreground">{p.statut === "retard" ? (p.retardMinutes ?? "—") : "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={edits[p.etudiantId] ? edit.justifie : !!p.justification}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [p.etudiantId]: { justifie: e.target.checked, justificatif: prev[p.etudiantId]?.justificatif ?? p.justification ?? "" } }))}
                            className="w-4 h-4 accent-primary"
                            data-testid={`assiduite-justifie-${p.etudiantId}`}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            value={edits[p.etudiantId] ? edit.justificatif : (p.justification ?? "")}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [p.etudiantId]: { justifie: prev[p.etudiantId]?.justifie ?? !!p.justification, justificatif: e.target.value } }))}
                            placeholder="Ex. certificat médical remis le..."
                            className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            data-testid={`assiduite-justificatif-${p.etudiantId}`}
                          />
                          {isDejaJustifie && <span className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5"><CheckCircle2 size={10} /> Déjà justifié</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-5 py-4 border-t border-border">
                <button onClick={handleSaveJustifications} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="assiduite-enregistrer">
                  Enregistrer les justifications
                </button>
              </div>
            </>
          )}
        </div>
      ) : modeSecours ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 bg-amber-500/10 border-b border-border">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><Info size={14} /> Assiduité de secours — sera marquée « saisie par l'administration »</p>
          </div>
          <div className="p-5 space-y-2 max-h-96 overflow-y-auto">
            {secoursPresences.map((p) => (
              <div key={p.etudiantId} className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                <span className="text-sm font-medium min-w-[160px]">{p.nom}</span>
                {(["present", "absent", "retard"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSecoursStatut(p.etudiantId, st)}
                    className={cn(
                      "text-xs px-2 py-1 rounded-lg border",
                      p.statut === st
                        ? st === "present" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : st === "absent" ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"
                        : "border-border",
                    )}
                  >
                    {st === "present" ? "Présent" : st === "absent" ? "Absent" : "Retard"}
                  </button>
                ))}
              </div>
            ))}
            {secoursPresences.length === 0 && <p className="text-sm text-muted-foreground">Aucun étudiant dans cette classe.</p>}
          </div>
          <div className="flex gap-3 px-5 py-4 border-t border-border">
            <button onClick={handleSaveSecours} className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors" data-testid="assiduite-secours-enregistrer">
              Enregistrer l&apos;assiduité de secours
            </button>
            <button onClick={() => setModeSecours(false)} className="px-5 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center bg-card border border-border rounded-xl space-y-3" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-sm text-muted-foreground">Aucun cahier de textes soumis par le professeur pour cette séance à cette date.</p>
          <button onClick={startSecours} className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-50 transition-colors" data-testid="assiduite-secours-demarrer">
            Créer quand même (secours administratif)
          </button>
        </div>
      )}
    </div>
  );
}
