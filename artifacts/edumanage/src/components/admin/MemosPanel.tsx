import { useState } from "react";
import { Plus, Trash2, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { FormModal } from "@/components/admin/FormModal";
import { useMemos } from "@/hooks/useMemoStore";
import { addMemo, deleteMemo, type MemoEntiteType, type MemoType } from "@/data/memoStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";

const TYPES: MemoType[] = ["Administratif", "Pédagogique", "Discipline", "Autre"];

const EMPTY = { type: "Administratif" as MemoType, objet: "", contenu: "" };

interface Props {
  entiteType: MemoEntiteType;
  entiteId: string;
}

export function MemosPanel({ entiteType, entiteId }: Props) {
  const { currentUser } = useAuth();
  const memos = useMemos().filter((m) => m.entiteType === entiteType && m.entiteId === entiteId).sort((a, b) => b.date.localeCompare(a.date));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const handleSave = () => {
    if (!currentUser || !form.objet.trim()) return;
    addMemo({
      entiteType,
      entiteId,
      type: form.type,
      date: new Date().toISOString().slice(0, 10),
      objet: form.objet.trim(),
      contenu: form.contenu.trim(),
      auteur: currentUser.name,
    }, currentUser.id);
    toast.success("Mémo ajouté.");
    setForm(EMPTY);
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!currentUser) return;
    deleteMemo(id, currentUser.id);
    toast.success("Mémo supprimé.");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Mémos</h3>
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors" data-testid="memo-ajouter">
          <Plus size={13} /> Nouveau
        </button>
      </div>
      {memos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun mémo pour l'instant.</p>
      ) : (
        <div className="space-y-2">
          {memos.map((m) => (
            <div key={m.id} className="p-3.5 bg-muted/30 rounded-xl border border-border" data-testid={`memo-ligne-${m.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <StickyNote size={14} className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{m.objet}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{m.type}</span>
                    </div>
                    {m.contenu && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{m.contenu}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1.5">{formatDate(m.date)} · {m.auteur}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 flex-shrink-0" data-testid={`memo-supprimer-${m.id}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormModal open={open} onClose={() => setOpen(false)} title="Nouveau mémo" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as MemoType }))} className={inputClass}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Objet *</label>
            <input value={form.objet} onChange={(e) => setForm((f) => ({ ...f, objet: e.target.value }))} className={inputClass} data-testid="memo-objet" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Contenu</label>
            <textarea value={form.contenu} onChange={(e) => setForm((f) => ({ ...f, contenu: e.target.value }))} rows={4} className={`${inputClass} resize-none`} />
          </div>
          <button onClick={handleSave} disabled={!form.objet.trim()} className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors" data-testid="memo-sauvegarder">
            Enregistrer
          </button>
        </div>
      </FormModal>
    </div>
  );
}
