import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSeances, useCahiers, useStudentStore } from "@/hooks/useStudentStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import {
  submitCahierSeance,
  getCahierStatsForEc,
  type CahierPresenceEntry,
  type CahierAttachment,
} from "@/data/studentStore";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function matchProf(label: string, userName?: string) {
  if (!userName) return false;
  const last = userName.split(" ").pop() ?? "";
  return label === userName || label.includes(last) || userName.includes(label.split(" ").pop() ?? "");
}

const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const labelClass = "block text-[11px] font-medium text-muted-foreground mb-1";

export function TeacherCahierPage() {
  const { currentUser } = useAuth();
  const seances = useSeances();
  const cahiers = useCahiers();
  const students = useStudentStore();
  const ecs = useEcs();
  const ues = useUes();

  const [seanceId, setSeanceId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sujet, setSujet] = useState("");
  const [resume, setResume] = useState("");
  const [competences, setCompetences] = useState("");
  const [liens, setLiens] = useState("");
  const [photos, setPhotos] = useState("");
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

  const mine = seances.filter((s) => matchProf(s.prof, currentUser?.name));
  const seance = seances.find((s) => s.id === seanceId);
  const ec = ecs.find((e) => e.id === seance?.ecId);
  const ue = ues.find((u) => u.id === ec?.ueId);
  const classeStudents = students.filter((s) => s.classeId === seance?.classeId);
  const stats = seance ? getCahierStatsForEc(seance.ecId) : null;

  useEffect(() => {
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

  function setPresence(id: string, statut: CahierPresenceEntry["statut"]) {
    setPresences((prev) => prev.map((p) => (p.etudiantId === id ? { ...p, statut, justification: statut === "absent" ? p.justification : "", retardMinutes: statut === "retard" ? p.retardMinutes : undefined } : p)));
  }

  function setJustif(id: string, justification: string) {
    setPresences((prev) => prev.map((p) => (p.etudiantId === id ? { ...p, justification } : p)));
  }

  function setRetardMinutes(id: string, retardMinutes: number) {
    setPresences((prev) => prev.map((p) => (p.etudiantId === id ? { ...p, retardMinutes } : p)));
  }

  function addPiece(file: File | null) {
    if (!file) return;
    setPieces((prev) => [
      ...prev,
      {
        id: `pj-${Date.now()}`,
        nom: file.name,
        type: file.type || "application/octet-stream",
        tailleKo: Math.round(file.size / 1024),
        ref: file.name,
      },
    ]);
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
      photosTableau: photos.split("\n").map((l) => l.trim()).filter(Boolean),
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
    });
    toast.success(asDraft ? "Brouillon enregistré" : "Cahier soumis — en attente de validation admin");
    if (!asDraft) {
      setSujet("");
      setResume("");
      setCompetences("");
      setLiens("");
      setPhotos("");
      setPieces([]);
      setDevoirDonne("");
      setEvalTypes([]);
      setEvalDetail("");
      setMotifAnnulation("");
    }
  }

  const mineCahiers = cahiers.filter((c) => matchProf(c.prof, currentUser?.name));
  const presentCount = presences.filter((p) => p.statut === "present").length;
  const taux = presences.length ? Math.round((presentCount / presences.length) * 1000) / 10 : 0;

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

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Cahier de texte électronique</h2>
        <p className="text-sm text-muted-foreground mt-1">Corrélé à l&apos;EDT, la maquette UE/EC et la classe pédagogique</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <label className={labelClass}>Séance (depuis l&apos;emploi du temps)</label>
          <select
            className={inputClass}
            value={seanceId}
            onChange={(e) => setSeanceId(e.target.value)}
          >
            <option value="">Choisir une séance…</option>
            {mine.map((s) => (
              <option key={s.id} value={s.id}>
                {JOURS[s.jour]} {s.heureDebut}–{s.heureFin} — {s.ec} ({s.classe}) · {s.salle}
              </option>
            ))}
          </select>
        </div>

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
                <label className={labelClass}>Date</label>
                <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
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
                  <label className={labelClass}>Joindre un fichier (PDF, PPT, vidéo…)</label>
                  <input type="file" className="text-sm" onChange={(e) => addPiece(e.target.files?.[0] ?? null)} />
                  {pieces.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {pieces.map((p) => (
                        <li key={p.id} className="text-xs flex justify-between border-b border-border py-1">
                          <span>{p.nom} ({p.tailleKo} Ko)</span>
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
                  <label className={labelClass}>Photos du tableau (références / noms, un par ligne)</label>
                  <textarea className={`${inputClass} min-h-[50px]`} value={photos} onChange={(e) => setPhotos(e.target.value)} />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm">Présences</h3>
                  <span className="text-xs text-muted-foreground">Taux auto : <strong>{taux}%</strong> ({presentCount}/{presences.length})</span>
                </div>
                <div className="max-h-64 overflow-auto space-y-2">
                  {presences.map((p) => (
                    <div key={p.etudiantId} className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
                      <span className="text-sm font-medium min-w-[140px]">{p.nom}</span>
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
                  ))}
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

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold text-sm mb-3">Mes cahiers soumis</h3>
        {mineCahiers.map((c) => (
          <div key={c.id} className="border-b border-border py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{c.sujet || c.ec} · {c.classe}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{c.statut} · {c.etatSeance}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{c.date} · {c.typeSeance} · présence {c.tauxPresence}%</p>
            <p className="text-xs mt-1 line-clamp-2">{c.resume || c.activite}</p>
          </div>
        ))}
        {mineCahiers.length === 0 && <p className="text-sm text-muted-foreground">Aucun cahier.</p>}
      </div>
    </div>
  );
}

export default TeacherCahierPage;
