import { useMemo, useState } from "react";
import { Check, X, NotebookPen, ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useCahiers } from "@/hooks/useStudentStore";
import { validateCahier, getCahierStatsForEc, type CahierSeanceRecord } from "@/data/studentStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  soumis: "bg-amber-50 text-amber-700",
  valide: "bg-emerald-50 text-emerald-700",
  rejete: "bg-red-50 text-red-700",
  brouillon: "bg-slate-100 text-slate-600",
};

function DetailBlock({ c }: { c: CahierSeanceRecord }) {
  const stats = c.ecId ? getCahierStatsForEc(c.ecId) : null;
  return (
    <div className="mt-3 space-y-3 text-sm border-t border-border pt-3">
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
        <p className="text-xs text-red-600"><strong>Motif annulation :</strong> {c.motifAnnulation}</p>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Sujet</p>
        <p>{c.sujet || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Résumé</p>
        <p className="whitespace-pre-wrap">{c.resume || c.activite || "—"}</p>
      </div>
      {c.competences && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Compétences visées</p>
          <p className="whitespace-pre-wrap">{c.competences}</p>
        </div>
      )}

      {(c.piecesJointes?.length > 0 || c.liensExternes?.length > 0 || c.photosTableau?.length > 0) && (
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="font-semibold text-muted-foreground mb-1">Documents</p>
            <ul className="space-y-0.5">{(c.piecesJointes || []).map((p) => <li key={p.id}>{p.nom}</li>)}</ul>
            {!c.piecesJointes?.length && <span className="text-muted-foreground">—</span>}
          </div>
          <div>
            <p className="font-semibold text-muted-foreground mb-1">Liens</p>
            <ul className="space-y-0.5 break-all">{(c.liensExternes || []).map((l) => <li key={l}>{l}</li>)}</ul>
            {!c.liensExternes?.length && <span className="text-muted-foreground">—</span>}
          </div>
          <div>
            <p className="font-semibold text-muted-foreground mb-1">Photos tableau</p>
            <ul className="space-y-0.5">{(c.photosTableau || []).map((l) => <li key={l}>{l}</li>)}</ul>
            {!c.photosTableau?.length && <span className="text-muted-foreground">—</span>}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
          Présences ({c.presences?.filter((p) => p.statut === "present").length || 0} P · {c.absents?.length || 0} A · {c.retards?.length || 0} R)
        </p>
        <div className="max-h-40 overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 text-left">
                <th className="px-2 py-1.5">Étudiant</th>
                <th className="px-2 py-1.5">Statut</th>
                <th className="px-2 py-1.5">Justification</th>
              </tr>
            </thead>
            <tbody>
              {(c.presences || []).map((p) => (
                <tr key={p.etudiantId} className="border-t border-border">
                  <td className="px-2 py-1.5">{p.nom}</td>
                  <td className="px-2 py-1.5">{p.statut}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.justification || "—"}</td>
                </tr>
              ))}
              {!(c.presences?.length) && (
                <tr><td colSpan={3} className="px-2 py-2 text-muted-foreground">Pas de détail présence</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {c.travail?.devoirDonne && (
        <div className="text-xs space-y-1">
          <p className="font-semibold text-muted-foreground uppercase">Travaux</p>
          <p><strong>Devoir :</strong> {c.travail.devoirDonne}</p>
          <p><strong>Échéance :</strong> {c.travail.dateLimite || "—"} · <strong>Fichier :</strong> {c.travail.fichierARemettre || "—"}</p>
          <p><strong>Barème :</strong> {c.travail.bareme || "—"} · <strong>Remises :</strong> {c.travail.statutRemises}</p>
        </div>
      )}

      {c.evaluation?.types?.length ? (
        <div className="text-xs">
          <p className="font-semibold text-muted-foreground uppercase mb-1">Évaluations</p>
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
              <p className="font-bold text-xs">{v}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CahiersAdminPage() {
  const { currentUser } = useAuth();
  const cahiers = useCahiers();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"soumis" | "tous" | "valide" | "rejete">("soumis");

  const list = useMemo(() => {
    if (filtre === "tous") return cahiers;
    return cahiers.filter((c) => c.statut === filtre);
  }, [cahiers, filtre]);

  const pending = cahiers.filter((c) => c.statut === "soumis");

  function act(id: string, approve: boolean) {
    if (!currentUser) return;
    validateCahier(id, currentUser.id, approve);
    toast.success(approve ? "Cahier validé — prêt pour vacations" : "Cahier rejeté");
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Cahiers de séance" }]}
        title="Cahiers de texte"
        subtitle="Détail complet des séances — validation avant transmission comptabilité / vacations"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
          <NotebookPen className="w-5 h-5 text-primary" />
          <p className="text-sm"><span className="font-bold">{pending.length}</span> en attente</p>
        </div>
        <div className="flex gap-1">
          {([
            ["soumis", "À valider"],
            ["valide", "Validés"],
            ["rejete", "Rejetés"],
            ["tous", "Tous"],
          ] as const).map(([k, lab]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFiltre(k)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                filtre === k ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
              )}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {list.map((c) => {
          const open = expanded === c.id;
          return (
            <div key={c.id} className={cn("rounded-xl border bg-card p-4", c.statut === "soumis" ? "border-amber-200" : "border-border")}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-bold text-sm">{c.sujet || c.ec}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.date} · {c.classe} · {c.prof} · {c.typeSeance} · {c.heureDebut}–{c.heureFin}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[c.statut] || "bg-muted")}>
                    {c.statut} · {c.etatSeance}
                  </span>
                  <button type="button" onClick={() => setExpanded(open ? null : c.id)} className="p-1.5 rounded-lg hover:bg-muted">
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>
              <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">{c.resume || c.activite}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Présence {c.tauxPresence}% · {(c.absents || []).length} absent(s) · {(c.retards || []).length} retard(s)
              </p>

              {open && <DetailBlock c={c} />}

              {c.statut === "soumis" && (
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => act(c.id, true)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white">
                    <Check size={12} /> Valider
                  </button>
                  <button type="button" onClick={() => act(c.id, false)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600">
                    <X size={12} /> Rejeter
                  </button>
                  {!open && (
                    <button type="button" onClick={() => setExpanded(c.id)} className="text-xs px-3 py-1.5 rounded-lg border border-border">
                      Voir le détail
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun cahier dans ce filtre.</p>
        )}
      </div>
    </div>
  );
}
