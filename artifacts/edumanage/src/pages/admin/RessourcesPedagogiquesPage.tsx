import { useMemo, useState } from "react";
import { FileText, Download, Library } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useClasses } from "@/hooks/useStructureStore";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useRessourcesPourClasse } from "@/hooks/useRessourcePedagogiqueStore";
import { formatDate } from "@/lib/utils";

function formatTaille(octets: number): string {
  return octets > 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`;
}

/** Lecture seule : le dépôt des ressources se fait côté professeur (portail enseignant), qui est
 * le seul à savoir quels supports appartiennent à ses propres modules. Cette page sert à
 * l'administration pour superviser ce qui a été mis à disposition des étudiants. */
export default function RessourcesPedagogiquesPage() {
  const classes = useClasses();
  const ecs = useEcs();
  const [classeId, setClasseId] = useState("");
  const [ecId, setEcId] = useState("");

  const ressources = useRessourcesPourClasse(classeId);
  const classe = classes.find((c) => c.id === classeId);
  const ecsDeLaClasse = useMemo(() => ecs.filter((e) => e.ueId), [ecs]);
  const ressourcesFiltrees = ecId ? ressources.filter((r) => r.ecId === ecId) : ressources;

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Ressources pédagogiques" }]}
        title="Ressources pédagogiques"
        subtitle="Supervision (lecture seule) — le dépôt des documents se fait par les professeurs depuis leur portail"
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe pédagogique <span className="text-red-500">*</span></label>
          <select
            value={classeId}
            onChange={(e) => { setClasseId(e.target.value); setEcId(""); }}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="ressource-classe"
          >
            <option value="">— Sélectionner —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom} — {c.filiere} {c.niveau}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Module (EC) — optionnel</label>
          <select
            value={ecId}
            onChange={(e) => setEcId(e.target.value)}
            disabled={!classeId}
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="ressource-ec"
          >
            <option value="">Tous les modules</option>
            {ecsDeLaClasse.map((e) => (
              <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>
            ))}
          </select>
        </div>
      </div>

      {!classeId ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Sélectionnez une classe pour consulter ses ressources
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-bold text-foreground flex items-center gap-2 mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
            <Library size={16} /> Ressources — {classe?.nom}
          </h3>
          {ressourcesFiltrees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune ressource déposée pour l&apos;instant.</p>
          ) : (
            <div className="space-y-2">
              {ressourcesFiltrees.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3.5 bg-muted/30 rounded-xl border border-border" data-testid={`ressource-ligne-${r.id}`}>
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={15} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.titre}{r.ec && <span className="text-muted-foreground font-normal"> — {r.ec}</span>}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{r.nom} · {formatTaille(r.tailleOctets)} · {formatDate(r.ajouteLe.slice(0, 10))} · déposé par {r.ajoutePar}</div>
                    {r.description && <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>}
                  </div>
                  <a href={r.dataUrl} download={r.nom} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary flex-shrink-0" data-testid={`ressource-telecharger-${r.id}`}>
                    <Download size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
