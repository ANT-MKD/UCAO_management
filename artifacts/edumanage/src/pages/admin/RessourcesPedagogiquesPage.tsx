import { useMemo, useRef, useState } from "react";
import { Upload, Trash2, FileText, Download, Library } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useClasses } from "@/hooks/useStructureStore";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useRessourcesPourClasse } from "@/hooks/useRessourcePedagogiqueStore";
import { addRessourcePedagogique, deleteRessourcePedagogique, TAILLE_MAX_RESSOURCE_OCTETS } from "@/data/ressourcePedagogiqueStore";
import { formatDate } from "@/lib/utils";

function formatTaille(octets: number): string {
  return octets > 1024 * 1024 ? `${(octets / (1024 * 1024)).toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`;
}

export default function RessourcesPedagogiquesPage() {
  const { currentUser } = useAuth();
  const classes = useClasses();
  const ecs = useEcs();
  const [classeId, setClasseId] = useState("");
  const [ecId, setEcId] = useState("");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const ressources = useRessourcesPourClasse(classeId);
  const classe = classes.find((c) => c.id === classeId);
  const ecsDeLaClasse = useMemo(() => ecs.filter((e) => e.ueId), [ecs]);

  const handleFile = (file: File | undefined) => {
    if (!file || !currentUser || !classe) return;
    if (!titre.trim()) {
      toast.error("Indiquez un titre avant d'ajouter un fichier.");
      return;
    }
    if (file.size > TAILLE_MAX_RESSOURCE_OCTETS) {
      toast.error(`Fichier trop lourd (max ${Math.round(TAILLE_MAX_RESSOURCE_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const ec = ecsDeLaClasse.find((e) => e.id === ecId);
      addRessourcePedagogique({
        classeId: classe.id,
        classe: classe.nom,
        ecId: ec?.id,
        ec: ec?.libelle,
        titre: titre.trim(),
        description: description.trim() || undefined,
        nom: file.name,
        dataUrl: String(reader.result),
        tailleOctets: file.size,
        ajoutePar: currentUser.name,
      }, currentUser.id);
      toast.success("Ressource ajoutée.");
      setTitre("");
      setDescription("");
      setEcId("");
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDelete = (id: string) => {
    if (!currentUser) return;
    deleteRessourcePedagogique(id, currentUser.id);
    toast.success("Ressource supprimée.");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Ressources pédagogiques" }]}
        title="Ressources pédagogiques"
        subtitle="Documents de cours mis à disposition des étudiants d'une classe (support, corrigés, polycopiés...)"
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
            <option value="">Toute la classe (aucun module précis)</option>
            {ecsDeLaClasse.map((e) => (
              <option key={e.id} value={e.id}>{e.code} — {e.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Titre <span className="text-red-500">*</span></label>
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="ex: Polycopié Chapitre 3"
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            data-testid="ressource-titre"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionnel"
            className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {!classeId ? (
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Sélectionnez une classe pour consulter et ajouter ses ressources
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground flex items-center gap-2" style={{ fontFamily: "Outfit, sans-serif" }}>
              <Library size={16} /> Ressources — {classe?.nom}
            </h3>
            <label className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer" data-testid="ressource-ajouter">
              <Upload size={13} /> Ajouter un fichier
              <input ref={inputRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="ressource-input" />
            </label>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Fichiers max {Math.round(TAILLE_MAX_RESSOURCE_OCTETS / 1024)} Ko. Visibles immédiatement par les étudiants de cette classe.</p>
          {ressources.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune ressource pour l&apos;instant.</p>
          ) : (
            <div className="space-y-2">
              {ressources.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3.5 bg-muted/30 rounded-xl border border-border" data-testid={`ressource-ligne-${r.id}`}>
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={15} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.titre}{r.ec && <span className="text-muted-foreground font-normal"> — {r.ec}</span>}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{r.nom} · {formatTaille(r.tailleOctets)} · {formatDate(r.ajouteLe.slice(0, 10))} · {r.ajoutePar}</div>
                    {r.description && <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>}
                  </div>
                  <a href={r.dataUrl} download={r.nom} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary flex-shrink-0" data-testid={`ressource-telecharger-${r.id}`}>
                    <Download size={14} />
                  </a>
                  <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 flex-shrink-0" data-testid={`ressource-supprimer-${r.id}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
