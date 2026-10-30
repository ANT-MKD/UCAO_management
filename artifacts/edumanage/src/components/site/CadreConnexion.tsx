import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY, MONO, FondPastel, LogoEduManage } from "./Decor";

/** Cadre des écrans de connexion (connexion, mot de passe oublié, installation, changement de mot
 * de passe) : même univers que la page d'accueil. Sur ordinateur, le titre et l'aide sont à
 * gauche et la carte à droite ; sur téléphone : titre, carte, puis aide. */
export function CadreConnexion({ etiquette, titre, intro, aide, children, retourAccueil = true }: {
  etiquette: string;
  titre: ReactNode;
  intro?: ReactNode;
  aide?: ReactNode;
  children: ReactNode;
  retourAccueil?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden text-[#17133a] dark:text-[#f1f5f9]">
      <FondPastel />
      <header className="relative z-10 px-3 sm:px-6 pt-3 sm:pt-5">
        <nav className="mx-auto max-w-5xl flex items-center gap-3 rounded-full border border-white/70 dark:border-white/10 bg-white/75 dark:bg-[#161b2e]/70 backdrop-blur pl-4 pr-2 py-2" style={{ boxShadow: "0 12px 30px -18px rgba(23, 19, 58, 0.35)" }}>
          <Link href="/" className="flex-shrink-0" aria-label="Accueil EduManage"><LogoEduManage /></Link>
          {retourAccueil && (
            <Link href="/" className="ml-auto flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10" data-testid="connexion-retour-accueil">
              <ArrowLeft size={15} /> <span className="hidden sm:inline">Retour à l&apos;accueil</span><span className="sm:hidden">Accueil</span>
            </Link>
          )}
        </nav>
      </header>

      <main className="relative z-10 px-4 sm:px-6 pt-10 sm:pt-16 pb-16">
        <div className="mx-auto max-w-5xl grid lg:grid-cols-[1fr_460px] lg:grid-rows-[auto_1fr] gap-x-14 gap-y-8 items-start">
          <div className="lg:col-start-1 lg:row-start-1 lg:pt-6">
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.18em] font-medium text-[#4f46e5] dark:text-[#a5b4fc] mb-4" style={MONO}>{etiquette}</p>
            <h1 className="text-[40px] sm:text-6xl font-extrabold tracking-[-0.045em] leading-[0.98]" style={DISPLAY}>{titre}</h1>
            {intro && <p className="mt-5 text-[16px] sm:text-lg leading-relaxed text-[#3d3a5c] dark:text-[#c3c6dd] max-w-md">{intro}</p>}
          </div>

          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 rounded-[28px] bg-white/95 dark:bg-[#161b2e]/95 backdrop-blur border border-white dark:border-white/10 p-6 sm:p-8" style={{ boxShadow: "0 40px 80px -30px rgba(23, 19, 58, 0.35)" }}>
            {children}
          </div>

          {aide && <div className="lg:col-start-1 lg:row-start-2">{aide}</div>}
        </div>
      </main>
    </div>
  );
}

/** Champ de saisie aux couleurs des écrans de connexion. */
export const champConnexion =
  "w-full h-12 px-4 text-[15px] rounded-2xl border border-[#dcd9ea] dark:border-white/15 bg-white dark:bg-[#0d1117] text-[#17133a] dark:text-white placeholder:text-[#9a97b5] focus:outline-none focus:ring-4 focus:ring-[#4f46e5]/15 focus:border-[#4f46e5] transition-all";

export const etiquetteChamp = "block text-[13px] font-semibold text-[#3d3a5c] dark:text-[#c3c6dd] mb-1.5";

/** Bouton principal (pilule sombre, pleine largeur). */
export const boutonPrincipal =
  "w-full h-12 rounded-full bg-[#17133a] hover:bg-[#2b2563] dark:bg-white dark:text-[#17133a] dark:hover:bg-indigo-50 text-white text-[15px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300";

/** Étapes numérotées de l'aide ; l'étape en cours est mise en avant. */
export function EtapesAide({ etapes, active }: { etapes: { titre: string; texte: string }[]; active?: number }) {
  return (
    <ol className="space-y-2.5 max-w-md" data-testid="connexion-etapes">
      {etapes.map((e, i) => (
        <li
          key={e.titre}
          className={cn(
            "flex gap-4 rounded-[20px] px-5 py-4 border transition-colors",
            active === i ? "bg-[#17133a] text-white border-[#17133a] dark:bg-white dark:text-[#17133a]" : "bg-white/70 dark:bg-white/5 border-white dark:border-white/10",
          )}
          aria-current={active === i ? "step" : undefined}
        >
          <span className={cn("text-xs pt-0.5", active === i ? "text-[#a5b4fc] dark:text-[#4f46e5]" : "text-[#4f46e5] dark:text-[#a5b4fc]")} style={MONO}>{String(i + 1).padStart(2, "0")}</span>
          <span>
            <span className="block font-semibold text-[15px]">{e.titre}</span>
            <span className={cn("block text-sm mt-0.5", active === i ? "text-white/75 dark:text-[#3d3a5c]" : "text-[#5d5a7a] dark:text-[#a3a6c2]")}>{e.texte}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
