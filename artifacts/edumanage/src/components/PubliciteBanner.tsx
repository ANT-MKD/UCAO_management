import { useMemo, useState } from "react";
import { Megaphone, ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePublicites } from "@/hooks/usePubliciteStore";
import { getPublicitesActives, TYPE_CONTENU_LABELS } from "@/data/publiciteStore";
import type { UserRole } from "@/data/studentStore";
import { cn } from "@/lib/utils";

/** Bannière réellement alimentée par publiciteStore — une publicité n'apparaît ici que si elle est
 * ciblée sur ce profil (ou "tous") ET dans sa fenêtre de dates aujourd'hui. Rien de statique. */
export function PubliciteBanner({ profil }: { profil: UserRole }) {
  const publicites = usePublicites();
  const actives = useMemo(() => getPublicitesActives(profil), [profil, publicites]);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visibles = actives.filter((p) => !dismissed.includes(p.id));
  const current = visibles[index % Math.max(visibles.length, 1)];

  if (visibles.length === 0 || !current) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3" data-testid="publicite-banner">
      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
        <Megaphone size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">{TYPE_CONTENU_LABELS[current.typeContenu]}</span>
          {visibles.length > 1 && <span className="text-[10px] text-muted-foreground">{(index % visibles.length) + 1}/{visibles.length}</span>}
        </div>
        <p className="text-sm font-semibold text-foreground mt-0.5">{current.titre}</p>
        {current.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{current.description}</p>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {visibles.length > 1 && (
          <>
            <button onClick={() => setIndex((i) => (i - 1 + visibles.length) % visibles.length)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground" data-testid="publicite-precedent">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setIndex((i) => (i + 1) % visibles.length)} className="p-1 rounded-lg hover:bg-muted text-muted-foreground" data-testid="publicite-suivant">
              <ChevronRight size={14} />
            </button>
          </>
        )}
        <button
          onClick={() => setDismissed((d) => [...d, current.id])}
          className={cn("p-1 rounded-lg hover:bg-muted text-muted-foreground")}
          title="Masquer"
          data-testid="publicite-fermer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
