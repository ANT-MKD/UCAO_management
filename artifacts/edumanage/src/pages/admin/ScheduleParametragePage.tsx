import { useState } from "react";
import { Link } from "wouter";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import {
  typeSeanceStore,
  jourFerieStore,
  type TypeSeanceRecord,
  type JourFerieRecord,
} from "@/data/scheduleSettingsStore";
import { useTypesSeance, useJoursFeries } from "@/hooks/useScheduleSettingsStore";
import { formatShortDate, cn } from "@/lib/utils";

const SECTIONS = [
  { id: "jours-feries", label: "Jours fériés" },
  { id: "type-seance", label: "Type emploi du temps" },
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

function SectionShell({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
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

function JoursFeriesSection() {
  const items = useJoursFeries();
  const [editing, setEditing] = useState<JourFerieRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [intitule, setIntitule] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<JourFerieRecord | null>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setIntitule("");
    setDateDebut("");
    setDateFin("");
    setCreating(true);
  };
  const startEdit = (r: JourFerieRecord) => {
    setIntitule(r.intitule);
    setDateDebut(r.dateDebut);
    setDateFin(r.dateFin);
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!intitule.trim() || !dateDebut || !dateFin) {
      toast.error("Intitulé, date de début et date de fin sont obligatoires");
      return;
    }
    if (dateFin < dateDebut) {
      toast.error("La date de fin doit être postérieure ou égale à la date de début");
      return;
    }
    if (editing) {
      jourFerieStore.update(editing.id, { intitule: intitule.trim(), dateDebut, dateFin });
      toast.success("Jour férié modifié");
    } else {
      jourFerieStore.add({ intitule: intitule.trim(), dateDebut, dateFin });
      toast.success("Jour férié ajouté");
    }
    close();
  };

  const sorted = [...items].sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));

  return (
    <>
      <SectionShell title="Les jours fériés" onAdd={startCreate}>
        {sorted.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun jour férié déclaré.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-left px-4 py-3">Début</th>
                <th className="text-left px-4 py-3">Date fin</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.intitule}</td>
                  <td className="px-4 py-3">{formatShortDate(r.dateDebut)}</td>
                  <td className="px-4 py-3">{formatShortDate(r.dateFin)}</td>
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

      <FormModal open={open} onClose={close} title={editing ? "Modifier le jour férié" : "Nouveau jour férié"} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} placeholder="Ex : Fête de l'indépendance" className={inputClass} data-testid="jour-ferie-intitule" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Date début <span className="text-red-500">*</span>
              </label>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} data-testid="jour-ferie-date-debut" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Date fin <span className="text-red-500">*</span>
              </label>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} data-testid="jour-ferie-date-fin" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) jourFerieStore.remove(deleteTarget.id);
          toast.success("Jour férié supprimé");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

function TypeSeanceSection() {
  const items = useTypesSeance();
  const [editing, setEditing] = useState<TypeSeanceRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [intitule, setIntitule] = useState("");
  const [categorie, setCategorie] = useState<TypeSeanceRecord["categorie"]>("emploi_du_temps");
  const [couleur, setCouleur] = useState("#4f46e5");
  const [trajet, setTrajet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TypeSeanceRecord | null>(null);

  const open = creating || !!editing;

  const startCreate = () => {
    setCode("");
    setIntitule("");
    setCategorie("emploi_du_temps");
    setCouleur("#4f46e5");
    setTrajet(false);
    setCreating(true);
  };
  const startEdit = (r: TypeSeanceRecord) => {
    setCode(r.code);
    setIntitule(r.intitule);
    setCategorie(r.categorie);
    setCouleur(r.couleur);
    setTrajet(r.trajet);
    setEditing(r);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!code.trim() || !intitule.trim()) {
      toast.error("Code et intitulé sont obligatoires");
      return;
    }
    if (editing) {
      typeSeanceStore.update(editing.id, { code: code.trim().toUpperCase(), intitule: intitule.trim(), categorie, couleur, trajet });
      toast.success("Type d'emploi du temps modifié");
    } else {
      typeSeanceStore.add({ code: code.trim().toUpperCase(), intitule: intitule.trim(), categorie, couleur, trajet });
      toast.success("Type d'emploi du temps ajouté");
    }
    close();
  };

  return (
    <>
      <SectionShell title="Les types d'emploi du temps" onAdd={startCreate}>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Aucun type d&apos;emploi du temps.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3 w-24">Code</th>
                <th className="text-left px-4 py-3">Intitulé</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Couleur</th>
                <th className="text-center px-4 py-3">Trajet ?</th>
                <th className="text-right px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{r.code}</td>
                  <td className="px-4 py-3">{r.intitule}</td>
                  <td className="px-4 py-3">{r.categorie === "evenement" ? "Évènement" : "Emploi du temps"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block w-6 h-6 rounded-md border border-border align-middle" style={{ background: r.couleur }} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", r.trajet ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                      {r.trajet ? "Oui" : "Non"}
                    </span>
                  </td>
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

      <FormModal open={open} onClose={close} title={editing ? "Modifier le type" : "Nouveau type d'emploi du temps"} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Code <span className="text-red-500">*</span>
              </label>
              <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} data-testid="type-seance-code" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Couleur</label>
              <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} className={`${inputClass} h-[42px] p-1`} data-testid="type-seance-couleur" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Intitulé <span className="text-red-500">*</span>
            </label>
            <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={inputClass} data-testid="type-seance-intitule" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value as TypeSeanceRecord["categorie"])} className={inputClass} data-testid="type-seance-categorie">
              <option value="emploi_du_temps">Emploi du temps</option>
              <option value="evenement">Évènement</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={trajet} onChange={(e) => setTrajet(e.target.checked)} className="rounded" data-testid="type-seance-trajet" />
            Trajet ?
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
              Annuler
            </button>
            <button type="button" onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Sauvegarder
            </button>
          </div>
        </div>
      </FormModal>

      <DeleteConfirm
        open={!!deleteTarget}
        label={deleteTarget?.intitule ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) typeSeanceStore.remove(deleteTarget.id);
          toast.success("Type d'emploi du temps supprimé");
          setDeleteTarget(null);
        }}
      />
    </>
  );
}

export default function ScheduleParametragePage({ section }: { section: string }) {
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];

  return (
    <div>
      <PageHeader breadcrumb={[{ label: "Admin" }, { label: "Emploi du temps" }, { label: "Paramétrage" }]} title="Paramétrage emploi du temps" />

      <div className="grid lg:grid-cols-[220px_1fr] gap-6">
        <nav className="bg-card border border-border rounded-xl p-2 h-fit" style={{ boxShadow: "var(--shadow-sm)" }}>
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={`/admin/schedule/parametrage/${s.id}`}
              className={cn(
                "block px-3 py-2.5 rounded-lg text-sm transition-colors",
                s.id === current.id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <div>
          {current.id === "jours-feries" && <JoursFeriesSection />}
          {current.id === "type-seance" && <TypeSeanceSection />}
        </div>
      </div>
    </div>
  );
}
