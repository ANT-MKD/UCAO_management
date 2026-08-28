import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Pencil, X, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { NIVEAUX, SEMESTRES, ENSEIGNANTS } from "@/data/mockData";
import { getClasseById } from "@/data/structureStore";
import { useEcs, useUes } from "@/hooks/useCurriculumStore";
import { useEvaluations } from "@/hooks/useEvaluationStore";
import {
  createEvaluation,
  updateEvaluation,
  deleteEvaluation,
  findEvaluationsDoublon,
  getPoidsAutreType,
  type EvaluationRecord,
} from "@/data/evaluationStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function PoidsEvaluationPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const ecs = useEcs();
  const ues = useUes();
  const evaluations = useEvaluations();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [professeurId, setProfesseurId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalEcId, setModalEcId] = useState("");
  const [modalSemestreId, setModalSemestreId] = useState("");
  const [modalType, setModalType] = useState<"" | EvaluationRecord["type"]>("");
  const [modalPoids, setModalPoids] = useState<number | "">("");

  const professeur = ENSEIGNANTS.find((en) => en.id === professeurId);
  const classeObj = classeId ? getClasseById(classeId) : undefined;

  const suggestions = searchQuery.trim().length > 0 && !professeurId
    ? ENSEIGNANTS.filter((en) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          en.matricule.toLowerCase().includes(q) ||
          en.prenom.toLowerCase().includes(q) ||
          en.nom.toLowerCase().includes(q) ||
          en.telephone.includes(q)
        );
      })
    : [];

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    setProfesseurId("");
    setClasseId("");
    setSelectedIds(new Set());
  };

  const handleSelectProfesseur = (en: (typeof ENSEIGNANTS)[number]) => {
    setProfesseurId(en.id);
    setSearchQuery(`${en.matricule} - ${en.prenom} ${en.nom} (${en.telephone})`);
    setShowSuggestions(false);
    setClasseId("");
    setSelectedIds(new Set());
  };

  // Pas d'évaluation créée pour ce professeur = pas de classe à proposer ici :
  // cette page ne fait qu'éditer des poids déjà posés via Nouvelle évaluation.
  const profEvaluations = professeurId ? evaluations.filter((e) => e.professeurId === professeurId) : [];
  const classeOptions = Array.from(
    new Map(profEvaluations.map((e) => [e.classeId, { classeId: e.classeId, classe: e.classe, annee: e.annee }])).values(),
  ).sort((a, b) => a.annee.localeCompare(b.annee) || a.classe.localeCompare(b.classe));

  const classeEvaluations = classeId ? profEvaluations.filter((e) => e.classeId === classeId) : [];

  const coursDisponiblesModal = ecs.filter((ec) => {
    const ue = ues.find((u) => u.id === ec.ueId);
    return !!ue && !!classeObj && ue.filiereId === classeObj.filiereId && ue.niveau === classeObj.niveau;
  });

  const handleModalCoursChange = (value: string) => {
    setModalEcId(value);
    const ec = ecs.find((e) => e.id === value);
    const ue = ec ? ues.find((u) => u.id === ec.ueId) : undefined;
    // La session découle du cours (chaque EC appartient à une seule UE, elle-même liée à un
    // seul semestre) : on la résout automatiquement plutôt que de la faire choisir en double.
    const semestreMatch = ue
      ? SEMESTRES.find((s) => s.filiere === classeObj?.filiere && s.niveau === classeObj?.niveau && s.alias === ue.semestre)
      : undefined;
    setModalSemestreId(semestreMatch?.id ?? "");
  };

  const openCreateModal = () => {
    setEditingId(null);
    setModalEcId(""); setModalSemestreId(""); setModalType(""); setModalPoids("");
    setModalOpen(true);
  };

  const openEditModal = (ev: EvaluationRecord) => {
    setEditingId(ev.id);
    setModalEcId(ev.ecId); setModalSemestreId(ev.semestreId); setModalType(ev.type); setModalPoids(ev.poids);
    setModalOpen(true);
  };

  const semestreObj = SEMESTRES.find((s) => s.id === modalSemestreId);
  const doublons = classeId && modalEcId && modalSemestreId && modalType
    ? findEvaluationsDoublon(classeId, modalEcId, modalSemestreId, modalType, editingId ?? undefined)
    : [];
  const poidsAutreType = classeId && modalEcId && modalSemestreId && modalType
    ? getPoidsAutreType(classeId, modalEcId, modalSemestreId, modalType, editingId ?? undefined)
    : undefined;
  const totalPoidsModal = poidsAutreType !== undefined && modalPoids !== "" ? poidsAutreType + Number(modalPoids) : undefined;

  const peutSauvegarderModal = !!modalEcId && !!modalSemestreId && !!modalType && modalPoids !== "" && Number(modalPoids) > 0;

  const handleModalSave = () => {
    if (!peutSauvegarderModal || !semestreObj || !modalType) return;
    if (editingId) {
      updateEvaluation(editingId, {
        semestreId: modalSemestreId,
        semestre: `${semestreObj.nom} (${semestreObj.alias})`,
        ecId: modalEcId,
        type: modalType,
        poids: Number(modalPoids),
        modifiePar: currentUser?.name ?? "Administration",
      });
      toast.success("Poids évaluation mis à jour");
    } else {
      if (!classeObj || !professeurId) return;
      const niveauObj = NIVEAUX.find((n) => n.filiereId === classeObj.filiereId && n.alias === classeObj.niveau);
      createEvaluation({
        filiereId: classeObj.filiereId,
        annee: classeObj.annee,
        niveauId: niveauObj?.id ?? "",
        niveau: classeObj.niveau,
        classeId: classeObj.id,
        semestreId: modalSemestreId,
        semestre: `${semestreObj.nom} (${semestreObj.alias})`,
        ecId: modalEcId,
        professeurId,
        professeur: professeur ? `${professeur.prenom} ${professeur.nom}` : "",
        type: modalType,
        poids: Number(modalPoids),
        creePar: currentUser?.name ?? "Administration",
      });
      toast.success("Nouveau poids évaluation créé");
    }
    setModalOpen(false);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === classeEvaluations.length ? new Set() : new Set(classeEvaluations.map((e) => e.id)),
    );
  };

  const handleDeleteOne = (ev: EvaluationRecord) => {
    if (!confirm(`Supprimer l'évaluation ${ev.type === "devoir" ? "Devoir" : "Examen"} de ${ev.cours} ?`)) return;
    deleteEvaluation(ev.id);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(ev.id); return next; });
    toast.success("Évaluation supprimée");
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} évaluation(s) sélectionnée(s) ?`)) return;
    for (const id of selectedIds) deleteEvaluation(id);
    toast.success(`${selectedIds.size} évaluation(s) supprimée(s)`);
    setSelectedIds(new Set());
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluation" }, { label: "Mise à jour poids évaluation" }]}
        title="Mise à jour poids évaluation"
        subtitle="Corriger la pondération des évaluations déjà planifiées pour un professeur et une classe"
        actions={
          <button onClick={() => setLocation("/admin/evaluation/devoir")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Professeur</label>
        <div className="relative">
          <input
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Veuillez saisir le code, le prénom, le nom ou le numéro de téléphone du professeur…"
            className={inputClass}
            data-testid="poids-professeur-recherche"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
              {suggestions.map((en) => (
                <button
                  key={en.id}
                  onClick={() => handleSelectProfesseur(en)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                  data-testid={`poids-professeur-suggestion-${en.id}`}
                >
                  {en.matricule} - {en.prenom} {en.nom} ({en.telephone})
                </button>
              ))}
            </div>
          )}
        </div>

        {professeur && (
          <div className="flex items-center justify-between gap-4 mt-5 pt-5 border-t border-border flex-wrap">
            <div className="flex items-center gap-3">
              <UserAvatar name={`${professeur.prenom} ${professeur.nom}`} size="md" />
              <div>
                <p className="font-bold text-foreground">{professeur.matricule} - {professeur.prenom} {professeur.nom}</p>
                <p className="text-xs text-muted-foreground">{professeur.grade}</p>
              </div>
            </div>
            <div className="w-full sm:w-72">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Classe</label>
              <select value={classeId} onChange={(e) => { setClasseId(e.target.value); setSelectedIds(new Set()); }} className={inputClass} data-testid="poids-classe">
                <option value="">Sélectionner</option>
                {classeOptions.map((c) => <option key={c.classeId} value={c.classeId}>{c.annee} - {c.classe}</option>)}
              </select>
              {classeOptions.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">Aucune évaluation planifiée pour ce professeur pour l&apos;instant.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {classeId && (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-wrap gap-3">
            <h3 className="font-bold text-foreground text-sm">{classeEvaluations.length} évaluation(s) pour cette classe</h3>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
              data-testid="poids-nouveau"
            >
              <Plus size={14} /> Nouveau poids évaluation
            </button>
          </div>

          {classeEvaluations.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Aucune évaluation pour cette classe.</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Cours</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Session</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Type évaluation</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Poids</th>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3 text-right">
                      <label className="flex items-center justify-end gap-1.5 text-xs font-semibold text-muted-foreground uppercase cursor-pointer">
                        Cocher tout
                        <input type="checkbox" checked={selectedIds.size === classeEvaluations.length} onChange={toggleAll} className="rounded" />
                      </label>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {classeEvaluations.map((ev) => (
                    <tr key={ev.id} className="border-b border-border last:border-0" data-testid={`poids-row-${ev.id}`}>
                      <td className="px-4 py-3 text-foreground">{ev.cours}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ev.semestre}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ev.type === "devoir" ? "Devoir" : "Examen"}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {ev.modifiePar ? (
                          <span title={`Modifié par ${ev.modifiePar} le ${ev.modifieLe}`} className="border-b border-dashed border-muted-foreground/50 cursor-help">
                            {ev.poids.toFixed(2)}
                          </span>
                        ) : (
                          ev.poids.toFixed(2)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEditModal(ev)} className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 flex items-center justify-center hover:bg-blue-100 transition-colors" data-testid={`poids-editer-${ev.id}`}>
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDeleteOne(ev)} className="w-7 h-7 rounded-full bg-red-50 text-red-600 dark:bg-red-950 flex items-center justify-center hover:bg-red-100 transition-colors" data-testid={`poids-supprimer-${ev.id}`}>
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input type="checkbox" checked={selectedIds.has(ev.id)} onChange={() => toggle(ev.id)} className="rounded" data-testid={`poids-check-${ev.id}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedIds.size > 0 && (
                <div className="px-5 py-4 border-t border-border flex justify-end">
                  <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors" data-testid="poids-supprimer-masse">
                    Supprimer ({selectedIds.size})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {modalOpen && classeObj && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 bg-emerald-600 text-white">
              <h3 className="font-bold flex items-center gap-2"><Plus size={16} /> {editingId ? "Modifier le poids évaluation" : "Nouveau poids évaluation"}</h3>
              <button onClick={() => setModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <UserAvatar name={professeur ? `${professeur.prenom} ${professeur.nom}` : ""} size="sm" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{professeur?.matricule} - {professeur?.prenom} {professeur?.nom} | {professeur?.grade}</p>
                  <p className="text-xs text-muted-foreground">{classeObj.nom}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cours *</label>
                <select value={modalEcId} onChange={(e) => handleModalCoursChange(e.target.value)} className={inputClass} data-testid="poids-modal-cours">
                  <option value="">Sélectionner</option>
                  {coursDisponiblesModal.map((ec) => <option key={ec.id} value={ec.id}>{ec.code} — {ec.libelle}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Session *</label>
                <select value={modalSemestreId} onChange={(e) => setModalSemestreId(e.target.value)} disabled={!modalEcId} className={cn(inputClass, "disabled:opacity-50")} data-testid="poids-modal-session">
                  <option value="">Sélectionner</option>
                  {SEMESTRES.filter((s) => s.filiere === classeObj.filiere && s.niveau === classeObj.niveau).map((s) => (
                    <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type *</label>
                  <select value={modalType} onChange={(e) => setModalType(e.target.value as "" | EvaluationRecord["type"])} className={inputClass} data-testid="poids-modal-type">
                    <option value="">Sélectionner</option>
                    <option value="devoir">Devoir</option>
                    <option value="examen">Examen</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Poids *</label>
                  <input type="number" min={1} max={100} value={modalPoids} onChange={(e) => setModalPoids(e.target.value === "" ? "" : Number(e.target.value))} className={inputClass} data-testid="poids-modal-poids" />
                </div>
              </div>

              {totalPoidsModal !== undefined && totalPoidsModal !== 100 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-700 dark:text-amber-300" data-testid="poids-modal-total-warning">
                  Devoir ({modalType === "devoir" ? modalPoids : poidsAutreType}%) + Examen ({modalType === "examen" ? modalPoids : poidsAutreType}%) = {totalPoidsModal}%, pas 100%. La moyenne de Saisie des Notes utilisera quand même ces poids tels quels.
                </div>
              )}

              {doublons.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-700 dark:text-amber-300" data-testid="poids-modal-doublon">
                  Une évaluation « {modalType === "devoir" ? "Devoir" : "Examen"} » existe déjà pour ce cours, cette classe et cette session. Vous pouvez tout de même enregistrer.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-border">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
              <button
                onClick={handleModalSave}
                disabled={!peutSauvegarderModal}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="poids-modal-sauvegarder"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
