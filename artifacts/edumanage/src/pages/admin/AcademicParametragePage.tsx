import { useState } from "react";
import { Link } from "wouter";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import {
  cycleStore,
  entiteStore,
  categorieCoursStore,
  type CycleRecord,
  type EntiteRecord,
  type CategorieCoursRecord,
} from "@/data/academicSettingsStore";
import { useCycles, useEntites, useCategoriesCours } from "@/hooks/useAcademicSettingsStore";

const SECTIONS = [
  { id: "cycle", label: "Cycle" },
  { id: "categorie-cours", label: "Catégorie cours" },
  { id: "entites", label: "Les entités" },
];

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function DeleteConfirm({
  open,
  label,
  onClose,
  onConfirm,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
        <h2 className="text-base font-semibold mb-1">Supprimer « {label} » ?</h2>
        <p className="text-xs text-muted-foreground mb-4">Cette action est irréversible.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
            Annuler
          </button>
          <button type="button" onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionShell({ title, onAdd, children }: { title: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="px-5 py-3.5 border-b border-border bg-muted/40 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-2 px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>
      {children}
    </div>
  );
}

function CycleSection() {
  const items = useCycles();
  const [editing, setEditing] = useState<CycleRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [ordre, setOrdre] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<CycleRecord | null>(null);

  const open = creating || !!editing;
  const startCreate = () => { setCode(""); setIntitule(""); setOrdre(items.length); setCreating(true); };
  const startEdit = (r: CycleRecord) => { setCode(r.code); setIntitule(r.intitule); setOrdre(r.ordre); setEditing(r); };
  const close = () => { setCreating(false); setEditing(null); };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim()) {
      toast.error("Code et intitulé sont obligatoires");
      return;
    }
    if (editing) {
      cycleStore.update(editing.id, { code: code.trim().toUpperCase(), intitule: intitule.trim(), ordre });
      toast.success("Cycle modifié");
    } else {
      cycleStore.add({ code: code.trim().toUpperCase(), intitule: intitule.trim(), ordre });
      toast.success("Cycle ajouté");
    }
    close();
  };

  const sorted = [...items].sort((a, b) => a.ordre - b.ordre);

  return (
    <>
      <SectionShell title="Les cycles" onAdd={startCreate}>
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun cycle.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-24">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-left px-4 py-3 w-24">Séq.</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3">{r.ordre}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier le cycle" : "Nouveau cycle"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code <span className="text-red-500">*</span></label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé <span className="text-red-500">*</span></label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Séquence</label>
            <input type="number" value={ordre} onChange={(e) => setOrdre(Number(e.target.value))} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">Sauvegarder</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) cycleStore.remove(deleteTarget.id); toast.success("Cycle supprimé"); setDeleteTarget(null); }}
      />
    </>
  );
}

function CategorieCoursSection() {
  const items = useCategoriesCours();
  const [editing, setEditing] = useState<CategorieCoursRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CategorieCoursRecord | null>(null);

  const open = creating || !!editing;
  const startCreate = () => { setCode(""); setIntitule(""); setCreating(true); };
  const startEdit = (r: CategorieCoursRecord) => { setCode(r.code); setIntitule(r.intitule); setEditing(r); };
  const close = () => { setCreating(false); setEditing(null); };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim()) {
      toast.error("Code et intitulé sont obligatoires");
      return;
    }
    if (editing) {
      categorieCoursStore.update(editing.id, { code: code.trim().toUpperCase(), intitule: intitule.trim() });
      toast.success("Catégorie modifiée");
    } else {
      categorieCoursStore.add({ code: code.trim().toUpperCase(), intitule: intitule.trim() });
      toast.success("Catégorie ajoutée");
    }
    close();
  };

  return (
    <>
      <SectionShell title="Les catégories de cours" onAdd={startCreate}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucune catégorie.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier la catégorie" : "Nouvelle catégorie de cours"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code <span className="text-red-500">*</span></label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé <span className="text-red-500">*</span></label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">Sauvegarder</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) categorieCoursStore.remove(deleteTarget.id); toast.success("Catégorie supprimée"); setDeleteTarget(null); }}
      />
    </>
  );
}

function EntitesSection() {
  const items = useEntites();
  const [editing, setEditing] = useState<EntiteRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EntiteRecord | null>(null);

  const open = creating || !!editing;
  const startCreate = () => { setCode(""); setIntitule(""); setCreating(true); };
  const startEdit = (r: EntiteRecord) => { setCode(r.code); setIntitule(r.intitule); setEditing(r); };
  const close = () => { setCreating(false); setEditing(null); };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim()) {
      toast.error("Code et intitulé sont obligatoires");
      return;
    }
    if (editing) {
      entiteStore.update(editing.id, { code: code.trim().toUpperCase(), intitule: intitule.trim() });
      toast.success("Entité modifiée");
    } else {
      entiteStore.add({ code: code.trim().toUpperCase(), intitule: intitule.trim() });
      toast.success("Entité ajoutée");
    }
    close();
  };

  return (
    <>
      <SectionShell title="Les entités" onAdd={startCreate}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucune entité.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-32">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionShell>

      <FormModal open={open} onClose={close} title={editing ? "Modifier l'entité" : "Nouvelle entité"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code <span className="text-red-500">*</span></label>
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé <span className="text-red-500">*</span></label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} placeholder="ex : Institut Supérieur d'Administration des Entreprises de Thiès" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">Annuler</button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">Sauvegarder</button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) entiteStore.remove(deleteTarget.id); toast.success("Entité supprimée"); setDeleteTarget(null); }}
      />
    </>
  );
}

export default function AcademicParametragePage({ section }: { section: string }) {
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div>
      <PageHeader breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Paramétrage" }]} title="Paramétrage académique" />

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <nav className="bg-card border border-border rounded-xl p-2 h-fit" style={{ boxShadow: "var(--shadow-sm)" }}>
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={`/admin/parametrage-academique/${s.id}`}
              className={`block px-3 py-2.5 rounded-lg text-sm transition-colors ${
                s.id === current.id ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <div>
          {current.id === "cycle" && <CycleSection />}
          {current.id === "categorie-cours" && <CategorieCoursSection />}
          {current.id === "entites" && <EntitesSection />}
        </div>
      </div>
    </div>
  );
}
