import { useLocation } from "wouter";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useCahiers } from "@/hooks/useStudentStore";
import { validateCahier, getCahierStatsForEc } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
  brouillon: "bg-slate-100 text-slate-600",
};

export default function CahierDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const cahiers = useCahiers();
  const c = cahiers.find((x) => x.id === id);

  if (!c) {
    return (
      <div>
        <button
          onClick={() => setLocation("/admin/cahiers")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        >
          <ArrowLeft size={15} /> Retour aux cahiers
        </button>
        <p className="text-sm text-muted-foreground">Cahier introuvable.</p>
      </div>
    );
  }

  const stats = c.ecId ? getCahierStatsForEc(c.ecId) : null;

  function act(approve: boolean) {
    if (!currentUser || !c) return;
    validateCahier(c.id, currentUser.id, approve);
    toast.success(approve ? "Cahier validé — prêt pour vacations" : "Cahier rejeté");
  }

  return (
    <div className="max-w-4xl">
      <button
        onClick={() => setLocation("/admin/cahiers")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
        data-testid="btn-back"
      >
        <ArrowLeft size={15} /> Retour aux cahiers
      </button>

      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Cahiers de séance" }, { label: c.sujet || c.ec }]}
        title={c.sujet || c.ec}
        subtitle={`${c.date} · ${c.classe} · ${c.prof}`}
        actions={
          <span className={cn("text-xs px-3 py-1.5 rounded-full font-medium h-fit", STATUT_CLS[c.statut] || "bg-muted")}>
            {c.statut} · {c.etatSeance}
          </span>
        }
      />

      {c.statut === "soumis" && (
        <div className="flex gap-2 mb-5">
          <button type="button" onClick={() => act(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl bg-emerald-600 text-white font-medium">
            <Check size={14} /> Valider
          </button>
          <button type="button" onClick={() => act(false)} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl border border-red-200 text-red-600 font-medium">
            <X size={14} /> Rejeter
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {[
            ["Année", c.annee],
            ["Semestre", c.semestre || "—"],
            ["Département", c.departement],
            ["Filière", c.filiere],
            ["Niveau", c.niveau],
            ["UE", c.ue || "—"],
            ["ECUE", c.ec],
            ["Enseignant", c.prof],
            ["Salle", c.salle || "—"],
            ["Classe", c.classe],
            ["Date", c.date],
            ["Horaire", `${c.heureDebut || "—"} – ${c.heureFin || "—"}`],
            ["Type", c.typeSeance],
            ["État séance", c.etatSeance],
            ["Taux présence", `${c.tauxPresence}%`],
          ].map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k} : </span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>

        {c.etatSeance === "annulee" && (
          <p className="text-sm text-red-600"><strong>Motif annulation :</strong> {c.motifAnnulation}</p>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Sujet</p>
          <p className="text-sm">{c.sujet || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Résumé</p>
          <p className="text-sm whitespace-pre-wrap">{c.resume || c.activite || "—"}</p>
        </div>
        {c.competences && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Compétences visées</p>
            <p className="text-sm whitespace-pre-wrap">{c.competences}</p>
          </div>
        )}

        {(c.piecesJointes?.length > 0 || c.liensExternes?.length > 0 || c.photosTableau?.length > 0) && (
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Documents</p>
              <ul className="space-y-0.5">
                {(c.piecesJointes || []).map((p) => (
                  <li key={p.id}>
                    {p.dataUrl ? (
                      <a href={p.dataUrl} download={p.nom} className="text-primary hover:underline">{p.nom}</a>
                    ) : (
                      p.nom
                    )}
                  </li>
                ))}
              </ul>
              {!c.piecesJointes?.length && <span className="text-muted-foreground">—</span>}
            </div>
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Liens</p>
              <ul className="space-y-0.5 break-all">{(c.liensExternes || []).map((l) => <li key={l}>{l}</li>)}</ul>
              {!c.liensExternes?.length && <span className="text-muted-foreground">—</span>}
            </div>
            <div>
              <p className="font-semibold text-muted-foreground mb-1">Photos tableau</p>
              {c.photosTableau?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.photosTableau.map((src, i) => (
                    <img key={i} src={src} alt={`Photo du tableau ${i + 1}`} className="w-14 h-14 object-cover rounded-lg border border-border" />
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
            Présences ({c.presences?.filter((p) => p.statut === "present").length || 0} P · {c.absents?.length || 0} A · {c.retards?.length || 0} R)
          </p>
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="px-3 py-2">Étudiant</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Justification</th>
                </tr>
              </thead>
              <tbody>
                {(c.presences || []).map((p) => (
                  <tr key={p.etudiantId} className="border-t border-border">
                    <td className="px-3 py-2">{p.nom}</td>
                    <td className="px-3 py-2">{p.statut}{p.statut === "retard" && p.retardMinutes ? ` (${p.retardMinutes} min)` : ""}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.justification || "—"}</td>
                  </tr>
                ))}
                {!(c.presences?.length) && (
                  <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">Pas de détail présence</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {c.travail?.devoirDonne && (
          <div className="text-sm space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Travaux</p>
            <p><strong>Devoir :</strong> {c.travail.devoirDonne}</p>
            <p><strong>Échéance :</strong> {c.travail.dateLimite || "—"} · <strong>Fichier :</strong> {c.travail.fichierARemettre || "—"}</p>
            <p><strong>Barème :</strong> {c.travail.bareme || "—"} · <strong>Remises :</strong> {c.travail.statutRemises}</p>
          </div>
        )}

        {c.evaluation?.types?.length ? (
          <div className="text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Évaluations</p>
            <p>{c.evaluation.types.join(", ")}</p>
            {c.evaluation.detail && <p className="mt-1 text-muted-foreground">{c.evaluation.detail}</p>}
          </div>
        ) : null}

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {[
              ["Heures faites", `${stats.heuresEffectuees}h`],
              ["Restantes", `${stats.heuresRestantes}h`],
              ["Programme", `${stats.pctProgramme}%`],
              ["Séances", stats.seancesRealisees],
              ["Prés. moy.", `${stats.tauxPresenceMoyen}%`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-muted/40 p-2 text-center">
                <p className="text-[10px] text-muted-foreground">{l}</p>
                <p className="font-bold text-sm">{v}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
