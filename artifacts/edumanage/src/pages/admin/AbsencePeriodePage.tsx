import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES, SEMESTRES } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { declarerAbsencesPeriode } from "@/data/absencePeriodeStore";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function AbsencePeriodePage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const CLASSES = useClasses();

  const [filiereId, setFiliereId] = useState("");
  const [annee, setAnnee] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [semestreId, setSemestreId] = useState("");
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().slice(0, 10));
  const [dateFin, setDateFin] = useState(new Date().toISOString().slice(0, 10));
  const [motif, setMotif] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [justifications, setJustifications] = useState<Record<string, { justifie: boolean; justificatif: string }>>({});

  const filiere = FILIERES.find((f) => f.id === filiereId);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);
  const classeObj = CLASSES.find((c) => c.id === classeId);

  const niveauxFiliere = NIVEAUX.filter((n) => n.filiereId === filiereId);
  const classesDisponibles = CLASSES.filter(
    (c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee,
  );
  const semestresDisponibles = SEMESTRES.filter((s) => s.filiere === filiere?.code && s.niveau === niveau?.alias);
  const classeStudents = etudiants.filter((e) => e.classeId === classeId);

  const handleFiliereChange = (value: string) => {
    setFiliereId(value);
    setAnnee(""); setNiveauId(""); setClasseId(""); setSemestreId(""); setSelectedIds(new Set()); setJustifications({});
  };
  const handleAnneeChange = (value: string) => {
    setAnnee(value);
    setNiveauId(""); setClasseId(""); setSemestreId(""); setSelectedIds(new Set()); setJustifications({});
  };
  const handleNiveauChange = (value: string) => {
    setNiveauId(value);
    setClasseId(""); setSemestreId(""); setSelectedIds(new Set()); setJustifications({});
  };
  const handleClasseChange = (value: string) => {
    setClasseId(value);
    setSemestreId(""); setSelectedIds(new Set()); setJustifications({});
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelectedIds((prev) => (prev.size === classeStudents.length ? new Set() : new Set(classeStudents.map((e) => e.id))));
  };
  const getJustif = (id: string) => justifications[id] ?? { justifie: false, justificatif: "" };

  const peutSoumettre = !!classeId && !!semestreId && !!dateDebut && !!dateFin && dateFin >= dateDebut && motif.trim().length > 0 && selectedIds.size > 0;

  const handleSubmit = () => {
    if (!peutSoumettre || !classeObj) return;
    declarerAbsencesPeriode({
      etudiants: Array.from(selectedIds).map((id) => {
        const e = etudiants.find((et) => et.id === id)!;
        const j = getJustif(id);
        return { etudiantId: e.id, etudiant: `${e.prenom} ${e.nom}`, matricule: e.matricule, justifie: j.justifie, justificatif: j.justificatif || undefined };
      }),
      classeId,
      classe: classeObj.nom,
      filiereId,
      filiere: filiere?.code ?? "",
      niveau: niveau?.alias ?? "",
      annee,
      dateDebut,
      dateFin,
      motif: motif.trim(),
      declarePar: currentUser?.name ?? "Administration",
    });
    toast.success(`Absence sur période déclarée pour ${selectedIds.size} étudiant(s)`);
    setLocation("/admin/assiduites/periode");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Assiduité" }, { label: "Absence par période" }]}
        title="Absence sur une période"
        subtitle="Déclarer une absence prolongée (maladie, sortie scolaire, congé autorisé) pour un ou plusieurs étudiants"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Programme *</label>
            <select value={filiereId} onChange={(e) => handleFiliereChange(e.target.value)} className={inputClass} data-testid="periode-filiere">
              <option value="">Sélectionner</option>
              {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire *</label>
            <select value={annee} onChange={(e) => handleAnneeChange(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="periode-annee">
              <option value="">Sélectionner</option>
              {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
            <select value={niveauId} onChange={(e) => handleNiveauChange(e.target.value)} disabled={!annee} className={cn(inputClass, "disabled:opacity-50")} data-testid="periode-niveau">
              <option value="">Sélectionner</option>
              {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe *</label>
            <select value={classeId} onChange={(e) => handleClasseChange(e.target.value)} disabled={!niveauId} className={cn(inputClass, "disabled:opacity-50")} data-testid="periode-classe">
              <option value="">Sélectionner</option>
              {classesDisponibles.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
            <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} disabled={!classeId} className={cn(inputClass, "disabled:opacity-50")} data-testid="periode-semestre">
              <option value="">Sélectionner</option>
              {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date début *</label>
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} data-testid="periode-date-debut" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date fin *</label>
            <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} data-testid="periode-date-fin" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motif *</label>
          <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} placeholder="Veuillez saisir le motif de l'absence svp!!!" className={inputClass} data-testid="periode-motif" />
        </div>
      </div>

      {classeId && semestreId && (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase cursor-pointer">
              <input type="checkbox" checked={classeStudents.length > 0 && selectedIds.size === classeStudents.length} onChange={toggleAll} className="w-4 h-4 accent-primary" />
              Les absents sur une période ({classeStudents.length})
            </label>
          </div>
          {classeStudents.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun étudiant dans cette classe.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="w-10" />
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Étudiant</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Programme en cours</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Justifié ?</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Justificatif</th>
                </tr>
              </thead>
              <tbody>
                {classeStudents.map((e) => {
                  const selected = selectedIds.has(e.id);
                  const j = getJustif(e.id);
                  return (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5"><input type="checkbox" checked={selected} onChange={() => toggleStudent(e.id)} className="w-4 h-4 accent-primary" data-testid={`periode-etudiant-${e.id}`} /></td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{e.matricule} - {e.prenom} {e.nom}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{e.filiere} - {e.niveau}</td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          disabled={!selected}
                          checked={j.justifie}
                          onChange={(ev) => setJustifications((prev) => ({ ...prev, [e.id]: { justifie: ev.target.checked, justificatif: prev[e.id]?.justificatif ?? "" } }))}
                          className="w-4 h-4 accent-emerald-500 disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          disabled={!selected}
                          value={j.justificatif}
                          onChange={(ev) => setJustifications((prev) => ({ ...prev, [e.id]: { justifie: prev[e.id]?.justifie ?? false, justificatif: ev.target.value } }))}
                          placeholder="Ex. certificat médical"
                          className="w-full px-2 py-1.5 text-xs border border-border rounded-lg bg-background disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="flex gap-3 px-5 py-4 border-t border-border">
            <button onClick={handleSubmit} disabled={!peutSoumettre} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed" data-testid="periode-soumettre">
              Sauvegarder
            </button>
            <button onClick={() => setLocation("/admin/assiduites/periode")} className="px-5 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
