import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useCahiers } from "@/hooks/useStudentStore";
import { formatDate } from "@/lib/utils";

export default function StudentCahierPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const cahiers = useCahiers();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];

  const mesCahiers = useMemo(
    () =>
      cahiers
        .filter((c) => c.classeId === student?.classeId && c.statut !== "brouillon")
        .sort((a, b) => b.date.localeCompare(a.date) || b.heureDebut.localeCompare(a.heureDebut)),
    [cahiers, student?.classeId],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Cahier de texte</h2>
        <p className="text-sm text-muted-foreground mt-1">{student?.classe} — ce qui a été vu en cours, séance par séance</p>
      </div>

      {mesCahiers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
          Aucune séance soumise pour l'instant.
        </p>
      ) : (
        mesCahiers.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`cahier-${c.id}`}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="font-bold text-sm">{c.ec}</h3>
              <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(c.date)} · {c.heureDebut}–{c.heureFin}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">{c.prof} · {c.salle} · {c.typeSeance}</p>
            {c.sujet && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-foreground">Sujet</p>
                <p className="text-sm text-muted-foreground">{c.sujet}</p>
              </div>
            )}
            {(c.resume || c.activite) && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-foreground">Résumé</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.resume || c.activite}</p>
              </div>
            )}
            {c.travail?.devoirDonne && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-foreground">Travail donné</p>
                <p className="text-sm text-muted-foreground">{c.travail.devoirDonne}</p>
                {c.travail.dateLimite && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">À rendre pour le {formatDate(c.travail.dateLimite)}</p>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
