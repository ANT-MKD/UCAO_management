import { useState } from "react";
import { Plus, Archive, ArrowRight, Calendar, CheckCircle, X, Lock } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import {
  promoteAcademicYear,
  setAnneeActuelle,
  addAnneeAcademique,
  archiveAnnee,
  cloturerAnnee,
} from "@/data/studentStore";
import { useAnneesAcademiques, useStudentStore } from "@/hooks/useStudentStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function AnneesAcademiquesPage() {
  const annees = useAnneesAcademiques();
  const etudiants = useStudentStore();
  const [showModal, setShowModal] = useState(false);
  const [newAnnee, setNewAnnee] = useState("");
  const [promoting, setPromoting] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState("");

  const handleCreate = () => {
    if (!newAnnee.match(/^\d{4}-\d{4}$/)) return;
    addAnneeAcademique(newAnnee);
    setNewAnnee("");
    setShowModal(false);
  };

  const handlePromote = (id: string) => {
    setPromoting(id);
    setTimeout(() => {
      const { count, nextLabel } = promoteAcademicYear(id);
      setPromoting(null);
      setDoneMsg(`${count} préinscriptions créées pour ${nextLabel}`);
      setTimeout(() => setDoneMsg(""), 4000);
    }, 800);
  };

  const handleCloture = (id: string, libelle: string) => {
    if (!confirm(`Clôturer définitivement l'année ${libelle} ? Les modifications académiques seront figées.`)) return;
    cloturerAnnee(id);
    toast.success(`Année ${libelle} clôturée`);
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Académiques" }, { label: "Années Académiques" }]}
        title="Gestion des Années Académiques"
        subtitle="Créer, clôturer, archiver et passer à l'année N+1"
        actions={
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={15} /> Nouvelle année
          </button>
        }
      />

      {doneMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle size={16} /> {doneMsg}
        </div>
      )}

      <p className="text-xs text-muted-foreground mb-4">
        Ces actions s&apos;appliquent à toute l&apos;année scolaire d&apos;un coup. Pour clôturer ou faire basculer une classe en particulier, utilisez plutôt Classe &gt; Clôture année / Bascule année.
      </p>

      <div className="space-y-4">
        {annees.map((a) => (
          <div key={a.id} className={cn("bg-card border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4", a.actuelle ? "border-primary ring-1 ring-primary/20" : "border-border")} style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-3 flex-1">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", a.actuelle ? "bg-primary/10" : "bg-muted")}>
                <Calendar size={22} className={a.actuelle ? "text-primary" : "text-muted-foreground"} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>{a.libelle}</h3>
                  {a.actuelle && <StatusBadge status="actif" />}
                  {a.cloturee && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">Clôturée</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {etudiants.filter((e) => e.annee === a.libelle).length} étudiants inscrits
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!a.actuelle && !a.cloturee && (
                <button onClick={() => setAnneeActuelle(a.id)} className="px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-muted transition-colors">
                  Définir comme courante
                </button>
              )}
              {!a.cloturee && (
                <button
                  onClick={() => handlePromote(a.id)}
                  disabled={promoting === a.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <ArrowRight size={12} /> {promoting === a.id ? "Reconduction..." : "Passer à N+1"}
                </button>
              )}
              {!a.cloturee && (
                <button
                  onClick={() => handleCloture(a.id, a.libelle)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  <Lock size={12} /> Clôturer
                </button>
              )}
              {!a.actuelle && (
                <button onClick={() => archiveAnnee(a.id)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
                  <Archive size={12} /> Archiver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Créer une année académique</h3>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Libellé (ex: 2026-2027)</label>
            <input value={newAnnee} onChange={(e) => setNewAnnee(e.target.value)} placeholder="2026-2027" className={inputClass} />
            <button onClick={handleCreate} className="w-full mt-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Créer l&apos;année
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
