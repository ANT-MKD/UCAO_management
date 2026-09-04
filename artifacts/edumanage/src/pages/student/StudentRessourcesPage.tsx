import { useMemo, useState } from "react";
import {
  FileText, Download, Search, FileSpreadsheet, Presentation, FileImage, FileArchive,
  File as FileIcon, LayoutGrid, List, Library, BookOpen, HardDrive,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useRessourcesPourClasse } from "@/hooks/useRessourcePedagogiqueStore";
import { KPICard } from "@/components/admin/KPICard";
import { formatDate, cn } from "@/lib/utils";
import type { RessourcePedagogiqueRecord } from "@/data/ressourcePedagogiqueStore";

function formatTaille(octets: number): string {
  return octets > 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`;
}

const COURSE_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-emerald-100", text: "text-emerald-600" },
  { bg: "bg-violet-100", text: "text-violet-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-pink-100", text: "text-pink-600" },
  { bg: "bg-indigo-100", text: "text-indigo-600" },
];

const FILE_TYPE_STYLES: Record<string, { icon: typeof FileText; bg: string; text: string }> = {
  "PDF": { icon: FileText, bg: "bg-red-100", text: "text-red-600" },
  "Documents Word": { icon: FileText, bg: "bg-blue-100", text: "text-blue-600" },
  "Feuilles de calcul": { icon: FileSpreadsheet, bg: "bg-emerald-100", text: "text-emerald-600" },
  "Présentations": { icon: Presentation, bg: "bg-amber-100", text: "text-amber-600" },
  "Images": { icon: FileImage, bg: "bg-violet-100", text: "text-violet-600" },
  "Archives": { icon: FileArchive, bg: "bg-slate-200", text: "text-slate-600" },
  "Autres documents": { icon: FileIcon, bg: "bg-muted", text: "text-muted-foreground" },
};

function detecterTypeFichier(nom: string): string {
  const ext = nom.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (["doc", "docx"].includes(ext)) return "Documents Word";
  if (["xls", "xlsx", "csv"].includes(ext)) return "Feuilles de calcul";
  if (["ppt", "pptx"].includes(ext)) return "Présentations";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "Images";
  if (["zip", "rar", "7z"].includes(ext)) return "Archives";
  return "Autres documents";
}

const TOUTE_LA_CLASSE = "__classe__";

export default function StudentRessourcesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const ressources = useRessourcesPourClasse(student?.classeId ?? "");

  const [onglet, setOnglet] = useState<"toutes" | "recentes">("toutes");
  const [vue, setVue] = useState<"grille" | "liste">("grille");
  const [query, setQuery] = useState("");
  const [ecFiltre, setEcFiltre] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("");
  const [tri, setTri] = useState<"recent" | "nom" | "taille">("recent");

  const coursConcernes = useMemo(() => new Set(ressources.map((r) => r.ecId).filter(Boolean)).size, [ressources]);
  const poidsTotal = useMemo(() => ressources.reduce((s, r) => s + r.tailleOctets, 0), [ressources]);

  const parcoursCours = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    for (const r of ressources) {
      const id = r.ecId || TOUTE_LA_CLASSE;
      const label = r.ec || "Toute la classe";
      if (!map.has(id)) map.set(id, { id, label, count: 0 });
      map.get(id)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [ressources]);

  const typesDisponibles = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of ressources) {
      const t = detecterTypeFichier(r.nom);
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [ressources]);

  const ressourcesFiltrees = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = ressources.filter((r) => {
      if (ecFiltre === TOUTE_LA_CLASSE && r.ecId) return false;
      if (ecFiltre && ecFiltre !== TOUTE_LA_CLASSE && r.ecId !== ecFiltre) return false;
      if (typeFiltre && detecterTypeFichier(r.nom) !== typeFiltre) return false;
      if (q && !`${r.titre} ${r.description ?? ""} ${r.ec ?? ""} ${r.ajoutePar} ${r.nom}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (onglet === "recentes") {
      return [...list].sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe)).slice(0, 12);
    }
    if (tri === "nom") list = [...list].sort((a, b) => a.titre.localeCompare(b.titre));
    else if (tri === "taille") list = [...list].sort((a, b) => b.tailleOctets - a.tailleOctets);
    else list = [...list].sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe));
    return list;
  }, [ressources, query, ecFiltre, typeFiltre, tri, onglet]);

  function renderCarte(r: RessourcePedagogiqueRecord) {
    const type = detecterTypeFichier(r.nom);
    const style = FILE_TYPE_STYLES[type];
    const Icon = style.icon;
    return (
      <div key={r.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ boxShadow: "var(--shadow-sm)" }} data-testid={`etudiant-ressource-${r.id}`}>
        <div className="p-4 flex-1">
          <div className="flex items-start gap-3 mb-2">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", style.bg)}>
              <Icon size={16} className={style.text} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-foreground leading-tight truncate">{r.titre}</h3>
              <p className="text-[11px] text-muted-foreground truncate">{r.ec || "Toute la classe"}</p>
            </div>
          </div>
          {r.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{r.description}</p>}
          <p className="text-[11px] text-muted-foreground">{formatTaille(r.tailleOctets)} · {formatDate(r.ajouteLe.slice(0, 10))} · {r.ajoutePar}</p>
        </div>
        <a
          href={r.dataUrl}
          download={r.nom}
          className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-muted/60 transition-colors"
          data-testid={`etudiant-ressource-telecharger-${r.id}`}
        >
          <Download size={12} /> Télécharger
        </a>
      </div>
    );
  }

  function renderLigne(r: RessourcePedagogiqueRecord) {
    const type = detecterTypeFichier(r.nom);
    const style = FILE_TYPE_STYLES[type];
    const Icon = style.icon;
    return (
      <div key={r.id} className="flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors" data-testid={`etudiant-ressource-${r.id}`}>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", style.bg)}>
          <Icon size={14} className={style.text} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{r.titre}</div>
          <div className="text-[11px] text-muted-foreground truncate">{r.ec || "Toute la classe"} · {r.ajoutePar}</div>
        </div>
        <span className="text-[11px] text-muted-foreground flex-shrink-0 hidden sm:block">{formatDate(r.ajouteLe.slice(0, 10))}</span>
        <span className="text-[11px] text-muted-foreground flex-shrink-0 w-14 text-right hidden sm:block">{formatTaille(r.tailleOctets)}</span>
        <a href={r.dataUrl} download={r.nom} className="p-1.5 rounded-lg text-primary hover:bg-primary/10 flex-shrink-0" data-testid={`etudiant-ressource-telecharger-${r.id}`}>
          <Download size={14} />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Ressources pédagogiques</h2>
        <p className="text-sm text-muted-foreground mt-1">{student?.classe} — supports de cours mis à disposition par vos professeurs</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KPICard icon={Library} label="Ressources disponibles" value={ressources.length} accentColor="#2563eb" />
        <KPICard icon={BookOpen} label="Cours concernés" value={coursConcernes} accentColor="#10b981" />
        <KPICard icon={HardDrive} label="Poids total" value={formatTaille(poidsTotal)} accentColor="#8b5cf6" />
      </div>

      {parcoursCours.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">Parcours de cours</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {parcoursCours.map((c, i) => {
              const color = COURSE_COLORS[i % COURSE_COLORS.length];
              const actif = ecFiltre === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setEcFiltre(actif ? "" : c.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border flex-shrink-0 transition-colors",
                    actif ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
                  )}
                  data-testid={`ressources-parcours-${c.id}`}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", color.bg)}>
                    <BookOpen size={14} className={color.text} />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-foreground truncate max-w-[140px]">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">{c.count} ressource{c.count !== 1 ? "s" : ""}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
              {([["toutes", "Toutes les ressources"], ["recentes", "Récentes"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOnglet(key)}
                  className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", onglet === key ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                  data-testid={`ressources-onglet-${key}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher un document, un cours…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="ressources-recherche"
                />
              </div>
              {onglet === "toutes" && (
                <select
                  value={tri}
                  onChange={(e) => setTri(e.target.value as "recent" | "nom" | "taille")}
                  className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="ressources-tri"
                >
                  <option value="recent">Plus récents</option>
                  <option value="nom">Nom (A-Z)</option>
                  <option value="taille">Taille</option>
                </select>
              )}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-shrink-0">
                {([["grille", LayoutGrid], ["liste", List]] as const).map(([mode, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setVue(mode)}
                    className={cn("p-2 rounded-md transition-colors", vue === mode ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                    data-testid={`ressources-vue-${mode}`}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {ressourcesFiltrees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
              Aucune ressource ne correspond.
            </p>
          ) : vue === "grille" ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {ressourcesFiltrees.map(renderCarte)}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {ressourcesFiltrees.map(renderLigne)}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 h-fit">
          <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Types de fichiers</h3>
          {typesDisponibles.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune ressource pour l&apos;instant.</p>
          ) : (
            <div className="space-y-1">
              {typesDisponibles.map(([type, count]) => {
                const style = FILE_TYPE_STYLES[type];
                const Icon = style.icon;
                const actif = typeFiltre === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFiltre(actif ? "" : type)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors",
                      actif ? "bg-primary/10" : "hover:bg-muted/60",
                    )}
                    data-testid={`ressources-type-${type}`}
                  >
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", style.bg)}>
                      <Icon size={13} className={style.text} />
                    </div>
                    <span className="text-xs text-foreground flex-1 truncate">{type}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
