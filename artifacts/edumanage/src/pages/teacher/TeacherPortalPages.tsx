import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances, useNotes, useCahiers, useStudentStore } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { saveNotesGrid, submitNotesForValidation } from "@/data/studentStore";
import { ENSEIGNANTS, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { buildTeacherCourses } from "@/lib/teacherCourseUtils";
import { addRallonge, type RallongeStatut } from "@/data/rallongeStore";
import { useRallonges } from "@/hooks/useRallongeStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function matchProf(label: string, userName?: string) {
  if (!userName) return false;
  const last = userName.split(" ").pop() ?? "";
  return label === userName || label.includes(last) || userName.includes(label.split(" ").pop() ?? "");
}

export function TeacherDashboardPage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const notes = useNotes();
  const cahiers = useCahiers();
  const ecs = useEcs();

  const mineSeances = seances.filter((s) => matchProf(s.prof, currentUser?.name));
  const mineCahiers = cahiers.filter((c) => matchProf(c.prof, currentUser?.name));
  const mineEcs = ecs.filter((e) => matchProf(e.responsable, currentUser?.name));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
          Bonjour, {currentUser?.name}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Modules, sÃ©ances et cahiers de texte</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          ["SÃ©ances EDT", mineSeances.length],
          ["Modules (EC)", mineEcs.length],
          ["Cahiers", mineCahiers.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold text-sm mb-3">Prochaines sÃ©ances</h3>
        {mineSeances.slice(0, 5).map((s) => (
          <div key={s.id} className="flex justify-between text-sm border-b border-border py-2 last:border-0">
            <span>{JOURS[s.jour]} {s.heureDebut} â€” {s.ec}</span>
            <span className="text-xs text-muted-foreground">{s.classe} Â· {s.salle}</span>
          </div>
        ))}
        {mineSeances.length === 0 && <p className="text-sm text-muted-foreground">Aucune sÃ©ance.</p>}
        <p className="text-xs text-muted-foreground mt-3">{notes.filter((n) => n.statut === "brouillon_prof").length} notes en brouillon (toutes classes)</p>
      </div>
    </div>
  );
}

export function TeacherSchedulePage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const mine = seances
    .filter((s) => matchProf(s.prof, currentUser?.name))
    .sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut));

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-5 border-b border-border">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon emploi du temps</h2>
      </div>
      {mine.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Aucune sÃ©ance planifiÃ©e.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3">Jour</th>
              <th className="px-4 py-3">Horaire</th>
              <th className="px-4 py-3">EC</th>
              <th className="px-4 py-3">Classe</th>
              <th className="px-4 py-3">Salle</th>
            </tr>
          </thead>
          <tbody>
            {mine.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-3">{JOURS[s.jour]}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.heureDebut}â€“{s.heureFin}</td>
                <td className="px-4 py-3">{s.ec}</td>
                <td className="px-4 py-3">{s.classe}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.salle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function TeacherModulesPage() {
  const { currentUser } = useAuth();
  const ecs = useEcs();
  const ues = useUes();
  const mine = ecs.filter((e) => matchProf(e.responsable, currentUser?.name));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes modules</h2>
      {mine.map((e) => {
        const ue = ues.find((u) => u.id === e.ueId);
        return (
          <div key={e.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-bold text-sm">{e.code} â€” {e.libelle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              UE : {ue?.code ?? e.ue} Â· CM {e.volCm}h / TD {e.volTd}h / TP {e.volTp}h Â· VHT {e.vht}h
            </p>
          </div>
        );
      })}
      {mine.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun EC avec vous comme responsable. Les sÃ©ances EDT restent visibles dans Â« Mon EDT Â».
        </p>
      )}
    </div>
  );
}

export function TeacherGradesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const classes = useClasses();
  const ecs = useEcs();
  const [classeId, setClasseId] = useState("");
  const [ecId, setEcId] = useState("");
  const [cc, setCc] = useState("12");
  const [examen, setExamen] = useState("10");
  const [etudiantId, setEtudiantId] = useState("");

  const mineEcs = useMemo(() => {
    const byResp = ecs.filter((e) => matchProf(e.responsable, currentUser?.name));
    return byResp.length ? byResp : ecs;
  }, [ecs, currentUser?.name]);

  const classeStudents = students.filter((s) => s.classeId === classeId);

  function handleSave(submit: boolean) {
    const ec = ecs.find((x) => x.id === ecId);
    const s = students.find((x) => x.id === etudiantId);
    if (!ec || !s || !classeId) {
      toast.error("Classe, EC et Ã©tudiant requis");
      return;
    }
    saveNotesGrid(
      classeId,
      ec.id,
      `${ec.code} â€” ${ec.libelle}`,
      [{ etudiantId: s.id, cc: Number(cc), examen: Number(examen) }],
      false,
    );
    if (submit) {
      submitNotesForValidation(classeId, ec.id);
      toast.success("Notes soumises Ã  validation admin");
    } else {
      toast.success("Brouillon enregistrÃ© (CC 30% / Examen 70%)");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Saisie des notes</h2>
        <p className="text-xs text-muted-foreground">Workflow : brouillon â†’ soumission admin â†’ validation â†’ publication</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={classeId} onChange={(e) => setClasseId(e.target.value)}>
            <option value="">Classe pÃ©dagogique</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
          <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={ecId} onChange={(e) => setEcId(e.target.value)}>
            <option value="">Ã‰lÃ©ment constitutif</option>
            {mineEcs.map((e) => (
              <option key={e.id} value={e.id}>{e.code} â€” {e.libelle}</option>
            ))}
          </select>
          <select className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={etudiantId} onChange={(e) => setEtudiantId(e.target.value)}>
            <option value="">Ã‰tudiant</option>
            {classeStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.matricule} â€” {s.prenom} {s.nom}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} max={20} step={0.25} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="CC" title="CC (30%)" />
            <input type="number" min={0} max={20} step={0.25} className="rounded-xl border border-border bg-background px-3 py-2 text-sm" value={examen} onChange={(e) => setExamen(e.target.value)} placeholder="Examen" title="Examen (70%)" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => handleSave(false)} className="px-4 py-2 rounded-xl border border-border text-sm">Brouillon</button>
          <button type="button" onClick={() => handleSave(true)} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Soumettre Ã  l&apos;admin</button>
        </div>
      </div>
    </div>
  );
}

const RALLONGE_STATUT_LABEL: Record<RallongeStatut, string> = {
  soumis: "En attente",
  valide: "Validée",
  rejete: "Rejetée",
};

const RALLONGE_STATUT_CLS: Record<RallongeStatut, string> = {
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
};

export function TeacherRallongePage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const ecs = useEcs();
  const ues = useUes();
  const classes = useClasses();
  const rallonges = useRallonges();

  const myTeacher = useMemo(
    () => ENSEIGNANTS.find((t) => t.id === currentUser?.linkedId) ?? null,
    [currentUser?.linkedId],
  );
  const annee = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEES_ACADEMIQUES[0]?.libelle ?? "";

  const courses = useMemo(
    () => (myTeacher ? buildTeacherCourses(myTeacher, seances, ecs, ues, classes, annee) : []),
    [myTeacher, seances, ecs, ues, classes, annee],
  );

  const [courseId, setCourseId] = useState("");
  const [heures, setHeures] = useState("2");
  const [motif, setMotif] = useState("");

  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;

  const mine = useMemo(
    () =>
      rallonges
        .filter((r) => r.teacherId === myTeacher?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [rallonges, myTeacher?.id],
  );

  function handleSubmit() {
    if (!myTeacher || !selectedCourse) {
      toast.error("Sélectionnez un cours");
      return;
    }
    const heuresNum = Number(heures);
    if (!heuresNum || heuresNum <= 0) {
      toast.error("Indiquez un nombre d'heures valide");
      return;
    }
    if (!motif.trim()) {
      toast.error("Indiquez un motif");
      return;
    }
    addRallonge({
      teacherId: myTeacher.id,
      ecId: selectedCourse.ecId,
      classeId: selectedCourse.classeId,
      annee,
      vhActuel: selectedCourse.volumeHoraire,
      vhSupplementaire: heuresNum,
      motif: motif.trim(),
      origine: "prof",
    });
    toast.success("Demande de rallonge envoyée à l'administration");
    setCourseId("");
    setHeures("2");
    setMotif("");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
          Demande de rallonge de volume horaire
        </h2>
        <p className="text-xs text-muted-foreground">
          Demandez des heures supplémentaires sur un cours dont le volume prévu est dépassé.
          L&apos;administration valide ou rejette votre demande.
        </p>
        {!myTeacher ? (
          <p className="text-sm text-muted-foreground">Compte non rattaché à une fiche professeur.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <select
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">Sélectionner un cours</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.coursLabel} — {c.detailsLabel}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0.5}
                step={0.5}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={heures}
                onChange={(e) => setHeures(e.target.value)}
                placeholder="Heures supplémentaires demandées"
              />
              {selectedCourse && (
                <p className="text-xs text-muted-foreground self-center">
                  Volume horaire prévu actuellement : <span className="font-semibold text-foreground">{selectedCourse.volumeHoraire} h</span>
                </p>
              )}
            </div>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Motif de la demande…"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                Envoyer la demande
              </button>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-bold text-sm">Mes demandes</h3>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucune demande de rallonge envoyée.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Cours</th>
                <th className="px-4 py-3">Rallonge</th>
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((r) => {
                const ec = ecs.find((e) => e.id === r.ecId);
                const classe = classes.find((c) => c.id === r.classeId);
                return (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{ec ? `${ec.code} — ${ec.libelle}` : r.ecId}</p>
                      <p className="text-xs text-muted-foreground">{classe?.nom}</p>
                    </td>
                    <td className="px-4 py-3">
                      +{r.vhSupplementaire} h
                      <span className="text-xs text-muted-foreground block">
                        {r.vhActuel}h → {r.vhActuel + r.vhSupplementaire}h
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.motif}
                      {r.statut === "rejete" && r.motifRejet && (
                        <span className="block text-red-600 text-xs mt-1">{r.motifRejet}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", RALLONGE_STATUT_CLS[r.statut])}>
                        {RALLONGE_STATUT_LABEL[r.statut]}
                      </span>
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

export { TeacherCahierPage } from "./TeacherCahierPage";


