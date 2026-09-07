import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Paperclip, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances, useCahiers, useStudentStore } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useTeachers } from "@/hooks/useTeacherStore";
import { usePortefeuilleCours } from "@/hooks/usePortefeuilleCoursStore";
import { useAbsencesPeriode } from "@/hooks/useAbsencePeriodeStore";
import { getEtudiantsAjoutesPourCours, getEtudiantsRetiresPourCours } from "@/data/portefeuilleCoursStore";
import { getAbsencePeriodeCouvrant } from "@/data/absencePeriodeStore";
import { getJourFerieCouvrant } from "@/data/scheduleSettingsStore";
import { useJoursFeries } from "@/hooks/useScheduleSettingsStore";
import { mondayOf, matchesProf } from "@/lib/teacherUtils";
import { TAILLE_MAX_RESSOURCE_OCTETS } from "@/data/ressourcePedagogiqueStore";
import { cn } from "@/lib/utils";
import {
  submitCahierSeance,
  getCahierStatsForEc,
  getCahierPourSeanceEtDate,
  type CahierPresenceEntry,
  type CahierAttachment,
} from "@/data/studentStore";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const labelClass = "block text-[11px] font-medium text-muted-foreground mb-1";

/** Saisie d'un cahier de texte — création (/teacher/cahier/nouveau, avec éventuellement
 * ?seanceId=&date= préremplis depuis un chip "Reste à faire" de la liste) ou modification
 * (/teacher/cahier/:id/edit). Redirige vers la liste (/teacher/cahier) après une soumission
 * définitive ; un brouillon reste sur la page pour continuer la saisie. */
export function TeacherCahierFormPage({ id }: { id?: string }) {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const initialParams = useMemo(() => new URLSearchParams(searchStr), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { currentUser } = useAuth();
  const seances = useSeances();
  const cahiers = useCahiers();
  const students = useStudentStore();
  const ecs = useEcs();
  const ues = useUes();
  const teachers = useTeachers();
  usePortefeuilleCours(); // souscription pour re-rendre quand une exception cours étudiant change
  useAbsencesPeriode(); // souscription pour re-rendre quand une déclaration de période change
  useJoursFeries(); // souscription pour re-rendre quand la liste des jours fériés change

  const myTeacher = useMemo(() => teachers.find((t) => t.id === currentUser?.linkedId) ?? null, [teachers, currentUser?.linkedId]);

  const existing = id ? cahiers.find((c) => c.id === id) : undefined;
  const notFound = Boolean(id) && !existing;
  const readOnly = Boolean(existing) && existing?.statut === "valide";

  const [activeCahierId, setActiveCahierId] = useState<string | undefined>(undefined);
  const [seanceId, setSeanceId] = useState(initialParams.get("seanceId") || "");
  const [date, setDate] = useState(initialParams.get("date") || new Date().toISOString().slice(0, 10));
  const skipResetRef = useRef(false);
  const [sujet, setSujet] = useState("");
  const [resume, setResume] = useState("");
  const [competences, setCompetences] = useState("");
  const [liens, setLiens] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [pieces, setPieces] = useState<CahierAttachment[]>([]);
  const [presences, setPresences] = useState<CahierPresenceEntry[]>([]);
  const [devoirDonne, setDevoirDonne] = useState("");
  const [dateLimite, setDateLimite] = useState("");
  const [fichierRemise, setFichierRemise] = useState("");
  const [bareme, setBareme] = useState("");
  const [statutRemises, setStatutRemises] = useState<"non_ouvert" | "ouvert" | "partiel" | "clos">("non_ouvert");
  const [evalTypes, setEvalTypes] = useState<string[]>([]);
  const [evalDetail, setEvalDetail] = useState("");
  const [etatSeance, setEtatSeance] = useState<"preparee" | "realisee" | "annulee">("realisee");
  const [motifAnnulation, setMotifAnnulation] = useState("");

  /** Préremplit le formulaire à partir du cahier existant quand on arrive via
   * /teacher/cahier/:id/edit — skipResetRef évite que l'effet de remise à zéro des présences
   * (déclenché par le changement de seanceId ci-dessous) écrase les présences réellement
   * saisies du cahier chargé. */
  useEffect(() => {
    if (!existing) return;
    skipResetRef.current = true;
    setActiveCahierId(existing.id);
    setSeanceId(existing.seanceId);
    setDate(existing.date);
    setSujet(existing.sujet);
    setResume(existing.resume);
    setCompetences(existing.competences);
    setLiens((existing.liensExternes || []).join("\n"));
    setPhotos(existing.photosTableau || []);
    setPieces(existing.piecesJointes || []);
    setPresences(existing.presences);
    setDevoirDonne(existing.travail?.devoirDonne ?? "");
    setDateLimite(existing.travail?.dateLimite ?? "");
    setFichierRemise(existing.travail?.fichierARemettre ?? "");
    setBareme(existing.travail?.bareme ?? "");
    setStatutRemises(existing.travail?.statutRemises ?? "non_ouvert");
    setEvalTypes(existing.evaluation?.types ?? []);
    setEvalDetail(existing.evaluation?.detail ?? "");
    setEtatSeance(existing.etatSeance);
    setMotifAnnulation(existing.motifAnnulation ?? "");
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = seances.filter((s) => myTeacher && matchesProf(myTeacher, s.prof) && s.semaineDu === mondayOf(date));
  const seance = seances.find((s) => s.id === seanceId);
  const ec = ecs.find((e) => e.id === seance?.ecId);
  const ue = ues.find((u) => u.id === ec?.ueId);
  // Le roster respecte les mêmes règles que Saisie des Notes/Rattrapage : un étudiant en
  // abandon n'a plus de cours à suivre, un étudiant retiré de cet EC (Mise à jour cours
  // étudiants) en sort, un étudiant ajouté à cet EC y entre même hors de sa classe réelle.
  const etudiantsRetiresIds = seance ? new Set(getEtudiantsRetiresPourCours(seance.classeId, seance.ecId)) : new Set<string>();
  const etudiantsAjoutesIds = seance ? new Set(getEtudiantsAjoutesPourCours(seance.classeId, seance.ecId)) : new Set<string>();
  const classeStudents = students.filter((s) => {
    if (s.statut === "abandon") return false;
    const estMembre = s.classeId === seance?.classeId;
    const estAjoute = etudiantsAjoutesIds.has(s.id);
    return (estMembre && !etudiantsRetiresIds.has(s.id)) || estAjoute;
  });
  const stats = seance ? getCahierStatsForEc(seance.ecId) : null;

  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    if (!seance) {
      setPresences([]);
      return;
    }
    setPresences(
      classeStudents.map((s) => ({
        etudiantId: s.id,
        nom: `${s.prenom} ${s.nom}`,
        statut: "present" as const,
        justification: "",
      })),
    );
  }, [seanceId]); // eslint-disable-line react-hooks/exhaustive-deps

  function setPresence(etudiantId: string, statut: CahierPresenceEntry["statut"]) {
    setPresences((prev) => prev.map((p) => (p.etudiantId === etudiantId ? { ...p, statut, justification: statut === "absent" ? p.justification : "", retardMinutes: statut === "retard" ? p.retardMinutes : undefined } : p)));
  }

  function setJustif(etudiantId: string, justification: string) {
    setPresences((prev) => prev.map((p) => (p.etudiantId === etudiantId ? { ...p, justification } : p)));
  }

  function setRetardMinutes(etudiantId: string, retardMinutes: number) {
    setPresences((prev) => prev.map((p) => (p.etudiantId === etudiantId ? { ...p, retardMinutes } : p)));
  }

  function addPiece(file: File | null) {
    if (!file) return;
    if (file.size > TAILLE_MAX_RESSOURCE_OCTETS) {
      toast.error(`Fichier trop lourd (max ${Math.round(TAILLE_MAX_RESSOURCE_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPieces((prev) => [
        ...prev,
        {
          id: `pj-${Date.now()}`,
          nom: file.name,
          type: file.type || "application/octet-stream",
          tailleKo: Math.round(file.size / 1024),
          ref: file.name,
          dataUrl: String(reader.result),
        },
      ]);
    };
    reader.readAsDataURL(file);
  }

  function addPhoto(file: File | null) {
    if (!file) return;
    if (file.size > TAILLE_MAX_RESSOURCE_OCTETS) {
      toast.error(`Photo trop lourde (max ${Math.round(TAILLE_MAX_RESSOURCE_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotos((prev) => [...prev, String(reader.result)]);
    reader.readAsDataURL(file);
  }

  function toggleEval(t: string) {
    setEvalTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function save(asDraft: boolean) {
    if (!seanceId) {
      toast.error("Sélectionnez une séance EDT");
      return;
    }
    if (etatSeance !== "annulee" && (!sujet.trim() || !resume.trim())) {
      toast.error("Sujet et résumé obligatoires");
      return;
    }
    if (etatSeance === "annulee" && !motifAnnulation.trim()) {
      toast.error("Motif d'annulation requis");
      return;
    }
    submitCahierSeance({
      seanceId,
      prof: currentUser?.name ?? "Enseignant",
      date,
      sujet: sujet || (etatSeance === "annulee" ? "Séance annulée" : ""),
      resume: resume || motifAnnulation,
      competences,
      liensExternes: liens.split("\n").map((l) => l.trim()).filter(Boolean),
      photosTableau: photos,
      piecesJointes: pieces,
      presences,
      travail: devoirDonne
        ? { devoirDonne, dateLimite, fichierARemettre: fichierRemise, bareme, statutRemises }
        : undefined,
      evaluation: evalTypes.length
        ? { types: evalTypes as ("quiz" | "controle" | "tp" | "projet" | "examen")[], detail: evalDetail }
        : undefined,
      etatSeance,
      motifAnnulation: etatSeance === "annulee" ? motifAnnulation : undefined,
      asDraft,
      cahierId: activeCahierId,
    });
    toast.success(asDraft ? "Brouillon enregistré" : activeCahierId ? "Cahier mis à jour et soumis à nouveau" : "Cahier soumis — en attente de validation admin");
    if (!asDraft) {
      setLocation("/teacher/cahier");
    }
  }

  const presentCount = presences.filter((p) => p.statut === "present").length;
  const taux = presences.length ? Math.round((presentCount / presences.length) * 1000) / 10 : 0;
  const jourFerie = date ? getJourFerieCouvrant(date) : undefined;

  const infoGeneral = useMemo(() => {
    if (!seance) return null;
    return [
      ["Année", seance.annee],
      ["Semestre", ue?.semestre || "—"],
      ["Département", "Direction des études"],
      ["Filière", ue?.filiere || "—"],
      ["Niveau", ue?.niveau || "—"],
      ["UE", ue ? `${ue.code} — ${ue.libelle}` : "—"],
      ["ECUE", ec ? `${ec.code} — ${ec.libelle}` : seance.ec],
      ["Enseignant", seance.prof],
      ["Salle", seance.salle],
      ["Type", seance.type],
      ["Horaire", `${JOURS[seance.jour]} ${seance.heureDebut}–${seance.heureFin}`],
      ["Classe", seance.classe],
    ];
  }, [seance, ue, ec]);

  if (notFound) {
    return (
      <div className="max-w-4xl">
        <button
          type="button"
          onClick={() => setLocation("/teacher/cahier")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5"
        >
          <ArrowLeft size={15} /> Retour au cahier de texte
        </button>
        <p className="text-sm text-muted-foreground">Cahier introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <button
        type="button"
        onClick={() => setLocation("/teacher/cahier")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Retour au cahier de texte
      </button>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>
          {id ? "Modifier le cahier de texte" : "Nouveau cahier de texte"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Corrélé à l&apos;EDT, la maquette UE/EC et la classe pédagogique</p>
        {readOnly && (
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            Ce cahier est validé et n&apos;est plus modifiable.
          </div>
        )}
        {activeCahierId && !readOnly && (
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            La soumission mettra à jour ce cahier existant au lieu d&apos;en créer un nouveau.
          </div>
        )}
      </div>

      {!readOnly && (
        <>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <label className={labelClass}>Date de la séance (l&apos;emploi du temps est propre à chaque semaine)</label>
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setActiveCahierId(undefined);
                  setSeanceId("");
                }}
              />
            </div>

            <div>
              <label className={labelClass}>Séance de la semaine du {mondayOf(date)}</label>
              <select
                className={inputClass}
                value={seanceId}
                onChange={(e) => {
                  setActiveCahierId(undefined);
                  setSeanceId(e.target.value);
                }}
              >
                <option value="">Choisir une séance…</option>
                {mine.map((s) => {
                  const cahierDuJour = getCahierPourSeanceEtDate(s.id, date);
                  return (
                    <option key={s.id} value={s.id}>
                      {cahierDuJour ? "✓ " : ""}{JOURS[s.jour]} {s.heureDebut}–{s.heureFin} — {s.ec} ({s.classe}) · {s.salle}
                      {cahierDuJour ? ` — déjà ${cahierDuJour.statut === "rejete" ? "rejeté" : "soumis"} le ${date}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            {jourFerie && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Le {date} est déclaré jour férié — {jourFerie.intitule}.
              </div>
            )}

            {infoGeneral && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 rounded-xl bg-muted/40 p-3">
                {infoGeneral.map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-muted-foreground">{k} : </span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {stats && seance && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  ["Heures faites", `${stats.heuresEffectuees}h`],
                  ["Restantes", `${stats.heuresRestantes}h / ${stats.vht}h`],
                  ["Programme", `${stats.pctProgramme}%`],
                  ["Séances", stats.seancesRealisees],
                  ["Présence moy.", `${stats.tauxPresenceMoyen}%`],
                ].map(([l, v]) => (
                  <div key={String(l)} className="rounded-xl border border-border p-3 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">{l}</p>
                    <p className="font-bold text-sm mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {seance && (
            <>
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h3 className="font-bold text-sm">Contenu de la séance</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>État de la séance</label>
                    <select className={inputClass} value={etatSeance} onChange={(e) => setEtatSeance(e.target.value as typeof etatSeance)}>
                      <option value="preparee">Séance préparée</option>
                      <option value="realisee">Séance réalisée</option>
                      <option value="annulee">Séance annulée</option>
                    </select>
                  </div>
                </div>
                {etatSeance === "annulee" ? (
                  <div>
                    <label className={labelClass}>Motif de l&apos;annulation</label>
                    <textarea className={`${inputClass} min-h-[80px]`} value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelClass}>Sujet *</label>
                      <input className={inputClass} value={sujet} onChange={(e) => setSujet(e.target.value)} placeholder="Titre / thème du cours" />
                    </div>
                    <div>
                      <label className={labelClass}>Résumé du cours *</label>
                      <textarea className={`${inputClass} min-h-[100px]`} value={resume} onChange={(e) => setResume(e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Compétences visées</label>
                      <textarea className={`${inputClass} min-h-[60px]`} value={competences} onChange={(e) => setCompetences(e.target.value)} />
                    </div>
                  </>
                )}
              </div>

              {etatSeance !== "annulee" && (
                <>
                  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <h3 className="font-bold text-sm">Documents & médias</h3>
                    <div>
                      <label className={labelClass}>Joindre un fichier (max {Math.round(TAILLE_MAX_RESSOURCE_OCTETS / 1024)} Ko)</label>
                      <input type="file" className="text-sm" onChange={(e) => { addPiece(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                      {pieces.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {pieces.map((p) => (
                            <li key={p.id} className="text-xs flex items-center justify-between border-b border-border py-1">
                              <a
                                href={p.dataUrl}
                                download={p.nom}
                                className={cn("flex items-center gap-1.5", p.dataUrl ? "text-primary hover:underline" : "text-muted-foreground")}
                              >
                                <Paperclip size={11} /> {p.nom} {p.tailleKo ? `(${p.tailleKo} Ko)` : ""}
                              </a>
                              <button type="button" className="text-red-500" onClick={() => setPieces((prev) => prev.filter((x) => x.id !== p.id))}>Retirer</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Liens externes (un par ligne)</label>
                      <textarea className={`${inputClass} min-h-[60px]`} value={liens} onChange={(e) => setLiens(e.target.value)} placeholder="https://…" />
                    </div>
                    <div>
                      <label className={labelClass}>Photos du tableau (max {Math.round(TAILLE_MAX_RESSOURCE_OCTETS / 1024)} Ko chacune)</label>
                      <input type="file" accept="image/*" className="text-sm" onChange={(e) => { addPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                      {photos.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {photos.map((src, i) => (
                            <div key={i} className="relative">
                              <img src={src} alt={`Photo du tableau ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-border" />
                              <button
                                type="button"
                                onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm">Présences</h3>
                      <span className="text-xs text-muted-foreground">Taux auto : <strong>{taux}%</strong> ({presentCount}/{presences.length})</span>
                    </div>
                    <div className="max-h-64 overflow-auto space-y-2">
                      {presences.map((p) => {
                        const periode = getAbsencePeriodeCouvrant(p.etudiantId, date);
                        return (
                        <div key={p.etudiantId} className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                          <span className="text-sm font-medium min-w-[140px]">{p.nom}</span>
                          {periode && p.statut !== "absent" && (
                            <button
                              type="button"
                              onClick={() => { setPresence(p.etudiantId, "absent"); setJustif(p.etudiantId, periode.motif); }}
                              className="text-[11px] px-2 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700"
                              title={`Absence déclarée du ${periode.dateDebut} au ${periode.dateFin} — ${periode.motif}`}
                            >
                              Absence prévue (période) — appliquer
                            </button>
                          )}
                          {(["present", "absent", "retard"] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setPresence(p.etudiantId, st)}
                              className={`text-xs px-2 py-1 rounded-lg border ${
                                p.statut === st
                                  ? st === "present"
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : st === "absent"
                                      ? "bg-red-50 border-red-200 text-red-700"
                                      : "bg-amber-50 border-amber-200 text-amber-700"
                                  : "border-border"
                              }`}
                            >
                              {st === "present" ? "Présent" : st === "absent" ? "Absent" : "Retard"}
                            </button>
                          ))}
                          {p.statut === "absent" && (
                            <input
                              className="flex-1 min-w-[160px] text-xs rounded-lg border border-border px-2 py-1 bg-background"
                              placeholder="Justification d'absence"
                              value={p.justification || ""}
                              onChange={(e) => setJustif(p.etudiantId, e.target.value)}
                            />
                          )}
                          {p.statut === "retard" && (
                            <input
                              type="number"
                              min={1}
                              className="w-28 text-xs rounded-lg border border-border px-2 py-1 bg-background"
                              placeholder="Durée (min)"
                              value={p.retardMinutes ?? ""}
                              onChange={(e) => setRetardMinutes(p.etudiantId, Number(e.target.value))}
                            />
                          )}
                        </div>
                      );})}
                      {presences.length === 0 && <p className="text-sm text-muted-foreground">Aucun étudiant dans cette classe.</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <h3 className="font-bold text-sm">Travaux</h3>
                    <input className={inputClass} placeholder="Devoir donné" value={devoirDonne} onChange={(e) => setDevoirDonne(e.target.value)} />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Date limite</label>
                        <input type="date" className={inputClass} value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} />
                      </div>
                      <div>
                        <label className={labelClass}>Statut des remises</label>
                        <select className={inputClass} value={statutRemises} onChange={(e) => setStatutRemises(e.target.value as typeof statutRemises)}>
                          <option value="non_ouvert">Non ouvert</option>
                          <option value="ouvert">Ouvert</option>
                          <option value="partiel">Partiel</option>
                          <option value="clos">Clos</option>
                        </select>
                      </div>
                    </div>
                    <input className={inputClass} placeholder="Fichier à remettre (ex. devoir.pdf)" value={fichierRemise} onChange={(e) => setFichierRemise(e.target.value)} />
                    <input className={inputClass} placeholder="Barème" value={bareme} onChange={(e) => setBareme(e.target.value)} />
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <h3 className="font-bold text-sm">Évaluations</h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        ["quiz", "Quiz"],
                        ["controle", "Contrôle"],
                        ["tp", "TP noté"],
                        ["projet", "Projet"],
                        ["examen", "Examen"],
                      ].map(([k, lab]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => toggleEval(k)}
                          className={`text-xs px-3 py-1.5 rounded-lg border ${evalTypes.includes(k) ? "bg-primary/10 border-primary text-primary" : "border-border"}`}
                        >
                          {lab}
                        </button>
                      ))}
                    </div>
                    <textarea className={`${inputClass} min-h-[60px]`} placeholder="Détail de l'évaluation…" value={evalDetail} onChange={(e) => setEvalDetail(e.target.value)} />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => save(true)} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium">
                  Enregistrer brouillon
                </button>
                <button type="button" onClick={() => save(false)} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                  Soumettre à l&apos;admin
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default TeacherCahierFormPage;
