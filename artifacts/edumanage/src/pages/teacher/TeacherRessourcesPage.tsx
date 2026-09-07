import { useMemo, useRef, useState } from "react";
import {
  Upload, Trash2, Download, ExternalLink, Search, LayoutGrid, List, Library, BookOpen,
  HardDrive, Plus, Link2, FileUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTeachers } from "@/hooks/useTeacherStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useUes, useEcs } from "@/hooks/useCurriculumStore";
import { useRessourcesPedagogiques } from "@/hooks/useRessourcePedagogiqueStore";
import {
  addRessourcePedagogique, deleteRessourcePedagogique, TAILLE_MAX_RESSOURCE_OCTETS,
  type RessourcePedagogiqueRecord,
} from "@/data/ressourcePedagogiqueStore";
import { formatTailleRessource, RESSOURCE_TYPE_STYLES, detecterTypeRessource } from "@/lib/ressourceUtils";
import { matchesProf } from "@/lib/teacherUtils";
import { KPICard } from "@/components/admin/KPICard";
import { FormModal } from "@/components/admin/FormModal";
import { formatDate, cn } from "@/lib/utils";

const TOUTE_LA_CLASSE = "__classe__";
const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";

export default function TeacherRessourcesPage() {
  const { currentUser } = useAuth();
  const teachers = useTeachers();
  const classes = useClasses();
  const ues = useUes();
  const ecs = useEcs();
  const toutesLesRessources = useRessourcesPedagogiques();

  const myTeacher = useMemo(() => teachers.find((t) => t.id === currentUser?.linkedId) ?? null, [teachers, currentUser?.linkedId]);

  // Mes modules : les EC dont je suis responsable, et les classes de leur filière/niveau.
  const mesEcs = useMemo(() => (myTeacher ? ecs.filter((e) => matchesProf(myTeacher, e.responsable)) : []), [ecs, myTeacher]);
  const mesFiliereNiveau = useMemo(() => {
    const paires = new Set<string>();
    for (const e of mesEcs) {
      const ue = ues.find((u) => u.id === e.ueId);
      if (ue) paires.add(`${ue.filiereId}::${ue.niveau}`);
    }
    return paires;
  }, [mesEcs, ues]);
  const mesClasses = useMemo(
    () => classes.filter((c) => mesFiliereNiveau.has(`${c.filiereId}::${c.niveau}`)),
    [classes, mesFiliereNiveau],
  );
  const mesClasseIds = useMemo(() => new Set(mesClasses.map((c) => c.id)), [mesClasses]);
  const ressources = useMemo(() => toutesLesRessources.filter((r) => mesClasseIds.has(r.classeId)), [toutesLesRessources, mesClasseIds]);

  const [query, setQuery] = useState("");
  const [coursFiltre, setCoursFiltre] = useState("");
  const [typeFiltre, setTypeFiltre] = useState("");
  const [vue, setVue] = useState<"grille" | "liste">("grille");
  const [tri, setTri] = useState<"recent" | "nom" | "taille">("recent");
  const [modalOpen, setModalOpen] = useState(false);

  // Formulaire d'ajout
  const [formClasseId, setFormClasseId] = useState("");
  const [formEcId, setFormEcId] = useState("");
  const [formTitre, setFormTitre] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMode, setFormMode] = useState<"fichier" | "lien">("fichier");
  const [formUrl, setFormUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const ecsDeLaClasseFormulaire = useMemo(() => {
    const classe = classes.find((c) => c.id === formClasseId);
    if (!classe) return [];
    return mesEcs.filter((e) => {
      const ue = ues.find((u) => u.id === e.ueId);
      return ue?.filiereId === classe.filiereId && ue?.niveau === classe.niveau;
    });
  }, [classes, formClasseId, mesEcs, ues]);

  const coursConcernes = useMemo(() => new Set(ressources.map((r) => r.ecId).filter(Boolean)).size, [ressources]);
  const poidsTotal = useMemo(() => ressources.reduce((s, r) => s + (r.tailleOctets || 0), 0), [ressources]);

  const parcoursCours = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    for (const r of ressources) {
      const id = `${r.classeId}::${r.ecId || TOUTE_LA_CLASSE}`;
      const label = `${r.classe}${r.ec ? " — " + r.ec : " — Toute la classe"}`;
      if (!map.has(id)) map.set(id, { id, label, count: 0 });
      map.get(id)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [ressources]);

  const typesDisponibles = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of ressources) {
      const t = detecterTypeRessource(r);
      map.set(t, (map.get(t) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [ressources]);

  const ressourcesFiltrees = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = ressources.filter((r) => {
      if (coursFiltre && `${r.classeId}::${r.ecId || TOUTE_LA_CLASSE}` !== coursFiltre) return false;
      if (typeFiltre && detecterTypeRessource(r) !== typeFiltre) return false;
      if (q && !`${r.titre} ${r.description ?? ""} ${r.ec ?? ""} ${r.classe} ${r.nom ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (tri === "nom") list = [...list].sort((a, b) => a.titre.localeCompare(b.titre));
    else if (tri === "taille") list = [...list].sort((a, b) => (b.tailleOctets || 0) - (a.tailleOctets || 0));
    else list = [...list].sort((a, b) => b.ajouteLe.localeCompare(a.ajouteLe));
    return list;
  }, [ressources, query, coursFiltre, typeFiltre, tri]);

  function resetForm() {
    setFormClasseId("");
    setFormEcId("");
    setFormTitre("");
    setFormDescription("");
    setFormMode("fichier");
    setFormUrl("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleAddLien() {
    if (!currentUser) return;
    const classe = classes.find((c) => c.id === formClasseId);
    if (!classe) { toast.error("Sélectionnez une classe."); return; }
    if (!formTitre.trim()) { toast.error("Indiquez un titre."); return; }
    if (!formUrl.trim() || !/^https?:\/\//i.test(formUrl.trim())) {
      toast.error("Lien invalide (doit commencer par http:// ou https://).");
      return;
    }
    const ec = ecsDeLaClasseFormulaire.find((e) => e.id === formEcId);
    addRessourcePedagogique({
      classeId: classe.id,
      classe: classe.nom,
      ecId: ec?.id,
      ec: ec?.libelle,
      titre: formTitre.trim(),
      description: formDescription.trim() || undefined,
      url: formUrl.trim(),
      ajoutePar: currentUser.name,
    }, currentUser.id);
    toast.success("Lien ajouté.");
    resetForm();
    setModalOpen(false);
  }

  function handleAddFichier(file: File | undefined) {
    if (!file || !currentUser) return;
    const classe = classes.find((c) => c.id === formClasseId);
    if (!classe) { toast.error("Sélectionnez une classe."); return; }
    if (!formTitre.trim()) { toast.error("Indiquez un titre avant d'ajouter un fichier."); return; }
    if (file.size > TAILLE_MAX_RESSOURCE_OCTETS) {
      toast.error(`Fichier trop lourd (max ${Math.round(TAILLE_MAX_RESSOURCE_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const ec = ecsDeLaClasseFormulaire.find((e) => e.id === formEcId);
      addRessourcePedagogique({
        classeId: classe.id,
        classe: classe.nom,
        ecId: ec?.id,
        ec: ec?.libelle,
        titre: formTitre.trim(),
        description: formDescription.trim() || undefined,
        nom: file.name,
        dataUrl: String(reader.result),
        tailleOctets: file.size,
        ajoutePar: currentUser.name,
      }, currentUser.id);
      toast.success("Ressource ajoutée.");
      resetForm();
      setModalOpen(false);
    };
    reader.readAsDataURL(file);
  }

  function handleDelete(id: string) {
    if (!currentUser) return;
    deleteRessourcePedagogique(id, currentUser.id);
    toast.success("Ressource supprimée.");
  }

  function renderCarte(r: RessourcePedagogiqueRecord) {
    const type = detecterTypeRessource(r);
    const style = RESSOURCE_TYPE_STYLES[type];
    const Icon = style.icon;
    return (
      <div key={r.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ boxShadow: "var(--shadow-sm)" }} data-testid={`teacher-ressource-${r.id}`}>
        <div className="p-4 flex-1">
          <div className="flex items-start gap-3 mb-2">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", style.bg)}>
              <Icon size={16} className={style.text} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm text-foreground leading-tight truncate">{r.titre}</h3>
              <p className="text-[11px] text-muted-foreground truncate">{r.classe}{r.ec && ` — ${r.ec}`}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(r.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 flex-shrink-0"
              data-testid={`teacher-ressource-supprimer-${r.id}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
          {r.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{r.description}</p>}
          <p className="text-[11px] text-muted-foreground">
            {r.url ? "Lien externe" : formatTailleRessource(r.tailleOctets || 0)} · {formatDate(r.ajouteLe.slice(0, 10))}
          </p>
        </div>
        {r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-muted/60 transition-colors" data-testid={`teacher-ressource-ouvrir-${r.id}`}>
            <ExternalLink size={12} /> Ouvrir le lien
          </a>
        ) : (
          <a href={r.dataUrl} download={r.nom} className="flex items-center gap-1.5 px-4 py-2.5 border-t border-border text-xs font-medium text-primary hover:bg-muted/60 transition-colors" data-testid={`teacher-ressource-telecharger-${r.id}`}>
            <Download size={12} /> Télécharger
          </a>
        )}
      </div>
    );
  }

  function renderLigne(r: RessourcePedagogiqueRecord) {
    const type = detecterTypeRessource(r);
    const style = RESSOURCE_TYPE_STYLES[type];
    const Icon = style.icon;
    return (
      <div key={r.id} className="flex items-center gap-3 p-3.5 hover:bg-muted/40 transition-colors" data-testid={`teacher-ressource-${r.id}`}>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", style.bg)}>
          <Icon size={14} className={style.text} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{r.titre}</div>
          <div className="text-[11px] text-muted-foreground truncate">{r.classe}{r.ec && ` — ${r.ec}`}</div>
        </div>
        <span className="text-[11px] text-muted-foreground flex-shrink-0 hidden sm:block">{formatDate(r.ajouteLe.slice(0, 10))}</span>
        <span className="text-[11px] text-muted-foreground flex-shrink-0 w-16 text-right hidden sm:block">{r.url ? "Lien" : formatTailleRessource(r.tailleOctets || 0)}</span>
        {r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-primary hover:bg-primary/10 flex-shrink-0" data-testid={`teacher-ressource-ouvrir-${r.id}`}>
            <ExternalLink size={14} />
          </a>
        ) : (
          <a href={r.dataUrl} download={r.nom} className="p-1.5 rounded-lg text-primary hover:bg-primary/10 flex-shrink-0" data-testid={`teacher-ressource-telecharger-${r.id}`}>
            <Download size={14} />
          </a>
        )}
        <button type="button" onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 flex-shrink-0" data-testid={`teacher-ressource-supprimer-${r.id}`}>
          <Trash2 size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Ressources pédagogiques</h2>
          <p className="text-sm text-muted-foreground mt-1">Vos supports de cours pour les classes où vous enseignez</p>
        </div>
        {mesClasses.length > 0 && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shrink-0"
            data-testid="teacher-ressource-ouvrir-modal"
          >
            <Plus size={16} /> Ajouter une ressource
          </button>
        )}
      </div>

      {mesClasses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          Aucun module ne vous est encore attribué comme responsable — contactez l&apos;administration.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3 sm:gap-4">
            <KPICard icon={Library} label="Ressources disponibles" value={ressources.length} accentColor="#2563eb" />
            <KPICard icon={BookOpen} label="Cours concernés" value={coursConcernes} accentColor="#10b981" />
            <KPICard icon={HardDrive} label="Poids total" value={formatTailleRessource(poidsTotal)} accentColor="#8b5cf6" />
          </section>

          {parcoursCours.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Mes cours</p>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {parcoursCours.map((c) => {
                  const actif = coursFiltre === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCoursFiltre(actif ? "" : c.id)}
                      className={cn(
                        "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border flex-shrink-0 transition-colors",
                        actif ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60",
                      )}
                      data-testid={`teacher-ressources-parcours-${c.id}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={14} className="text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-semibold text-foreground truncate max-w-[160px]">{c.label}</div>
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
                <div className="flex flex-wrap gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher une ressource, un cours…"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="teacher-ressources-recherche"
                    />
                  </div>
                  <select
                    value={tri}
                    onChange={(e) => setTri(e.target.value as "recent" | "nom" | "taille")}
                    className="px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="teacher-ressources-tri"
                  >
                    <option value="recent">Plus récents</option>
                    <option value="nom">Nom (A-Z)</option>
                    <option value="taille">Taille</option>
                  </select>
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1 flex-shrink-0">
                    {([["grille", LayoutGrid], ["liste", List]] as const).map(([mode, Icon]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setVue(mode)}
                        className={cn("p-2 rounded-md transition-colors", vue === mode ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                        data-testid={`teacher-ressources-vue-${mode}`}
                      >
                        <Icon size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {ressourcesFiltrees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
                  {ressources.length === 0 ? "Aucune ressource pour l'instant." : "Aucune ressource ne correspond."}
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
              <h3 className="font-bold text-sm text-foreground mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Types de ressources</h3>
              {typesDisponibles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune ressource pour l&apos;instant.</p>
              ) : (
                <div className="space-y-1">
                  {typesDisponibles.map(([type, count]) => {
                    const style = RESSOURCE_TYPE_STYLES[type];
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
                        data-testid={`teacher-ressources-type-${type}`}
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
        </>
      )}

      <FormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title="Ajouter une ressource"
        subtitle="Visible immédiatement par les étudiants de la classe choisie"
      >
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Classe <span className="text-red-500">*</span></label>
            <select
              value={formClasseId}
              onChange={(e) => { setFormClasseId(e.target.value); setFormEcId(""); }}
              className={inputClass}
              data-testid="teacher-ressource-classe"
            >
              <option value="">— Sélectionner —</option>
              {mesClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.nom} — {c.filiere} {c.niveau}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Module (EC) — optionnel</label>
            <select
              value={formEcId}
              onChange={(e) => setFormEcId(e.target.value)}
              disabled={!formClasseId}
              className={inputClass}
              data-testid="teacher-ressource-ec"
            >
              <option value="">Toute la classe (aucun module précis)</option>
              {ecsDeLaClasseFormulaire.map((e) => (
                <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Titre <span className="text-red-500">*</span></label>
            <input
              value={formTitre}
              onChange={(e) => setFormTitre(e.target.value)}
              placeholder="ex: Polycopié Chapitre 3"
              className={inputClass}
              data-testid="teacher-ressource-titre"
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optionnel"
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            {([["fichier", "Fichier", FileUp], ["lien", "Lien externe", Link2]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFormMode(key)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors", formMode === key ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
                data-testid={`teacher-ressource-mode-${key}`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {formMode === "fichier" ? (
            <div>
              <label className={cn("flex items-center gap-1.5 px-3 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-semibold cursor-pointer w-fit", "hover:bg-primary/90 transition-colors")} data-testid="teacher-ressource-ajouter">
                <Upload size={13} /> Choisir un fichier
                <input ref={inputRef} type="file" className="hidden" onChange={(e) => handleAddFichier(e.target.files?.[0])} data-testid="teacher-ressource-input" />
              </label>
              <p className="text-xs text-muted-foreground mt-2">Fichiers max {Math.round(TAILLE_MAX_RESSOURCE_OCTETS / 1024)} Ko.</p>
            </div>
          ) : (
            <div>
              <label className={labelClass}>URL <span className="text-red-500">*</span></label>
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://…"
                className={inputClass}
                data-testid="teacher-ressource-url"
              />
              <button
                type="button"
                onClick={handleAddLien}
                className="mt-3 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
                data-testid="teacher-ressource-ajouter-lien"
              >
                <Plus size={14} /> Ajouter le lien
              </button>
            </div>
          )}
        </div>
      </FormModal>
    </div>
  );
}
