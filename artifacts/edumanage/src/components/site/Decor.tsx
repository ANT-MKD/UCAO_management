import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/** Éléments visuels communs à la page d'accueil et aux écrans de connexion. */
export const DISPLAY = { fontFamily: "Outfit, Inter, sans-serif" };
export const MONO = { fontFamily: "var(--app-font-mono)" };

/** Fond pastel (version sombre en mode sombre). */
export function FondPastel({ className }: { className?: string }) {
  return (
    <>
      <div
        aria-hidden
        className={cn("absolute inset-0 dark:hidden", className)}
        style={{
          background:
            "radial-gradient(45% 55% at 12% 35%, #f6c7e3 0%, transparent 70%), radial-gradient(45% 50% at 88% 18%, #c7c2ff 0%, transparent 70%), radial-gradient(50% 55% at 70% 85%, #a9c3ff 0%, transparent 70%), radial-gradient(40% 40% at 30% 90%, #d9ccff 0%, transparent 70%), #eef0fb",
        }}
      />
      <div
        aria-hidden
        className={cn("absolute inset-0 hidden dark:block", className)}
        style={{
          background:
            "radial-gradient(45% 55% at 12% 35%, #4a1f45 0%, transparent 70%), radial-gradient(45% 50% at 88% 18%, #2e2a6b 0%, transparent 70%), radial-gradient(50% 55% at 70% 85%, #1f3266 0%, transparent 70%), #0d1117",
        }}
      />
    </>
  );
}

/** Logo rond + « EduManage » + pastille UCAO. */
export function LogoEduManage({ pastille = true }: { pastille?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="w-8 h-8 rounded-full bg-[#17133a] dark:bg-white flex items-center justify-center"><GraduationCap size={16} className="text-white dark:text-[#17133a]" /></span>
      <span className="font-bold text-[15px]" style={DISPLAY}>EduManage</span>
      {pastille && <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-[#e3ddff] dark:bg-[#4f46e5]/30 text-[#3730a3] dark:text-[#c7d2fe] font-semibold" style={MONO}>UCAO</span>}
    </span>
  );
}
