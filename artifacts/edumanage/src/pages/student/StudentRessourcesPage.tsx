import { FileText, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useRessourcesPourClasse } from "@/hooks/useRessourcePedagogiqueStore";
import { formatDate } from "@/lib/utils";

function formatTaille(octets: number): string {
  return octets > 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`;
}

export default function StudentRessourcesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const ressources = useRessourcesPourClasse(student?.classeId ?? "");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Ressources pédagogiques</h2>
        <p className="text-sm text-muted-foreground mt-1">{student?.classe} — supports de cours mis à disposition par vos professeurs</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {ressources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucune ressource disponible pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {ressources.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3.5 bg-muted/30 rounded-xl border border-border" data-testid={`etudiant-ressource-${r.id}`}>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText size={15} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {r.titre}{r.ec && <span className="text-muted-foreground font-normal"> — {r.ec}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{formatTaille(r.tailleOctets)} · {formatDate(r.ajouteLe.slice(0, 10))} · {r.ajoutePar}</div>
                  {r.description && <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>}
                </div>
                <a
                  href={r.dataUrl}
                  download={r.nom}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary flex-shrink-0"
                  data-testid={`etudiant-ressource-telecharger-${r.id}`}
                >
                  <Download size={14} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
