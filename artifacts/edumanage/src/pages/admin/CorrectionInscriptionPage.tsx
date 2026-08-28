import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Search, ArrowLeft, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FILIERES, NIVEAUX, ANNEES_ACADEMIQUES } from "@/data/mockData";
import { useStudentStore, useInscriptions } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useModelesFrais } from "@/hooks/useFinanceSettingsStore";
import { registerInscriptionCorrection } from "@/data/studentStore";
import type { EtudiantRecord } from "@/data/studentStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function CorrectionInscriptionPage() {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const etudiants = useStudentStore();
  const classes = useClasses();
  const modelesFrais = useModelesFrais();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);

  const [filiereId, setFiliereId] = useState("");
  const [niveauId, setNiveauId] = useState("");
  const [annee, setAnnee] = useState("");
  const [specialite, setSpecialite] = useState("");
  const [modeleFraisId, setModeleFraisId] = useState("");
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);

  const studentInscriptions = useInscriptions(selectedStudent?.id ?? "");

  const filteredStudents = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  const pickStudent = (stu: EtudiantRecord) => {
    setSelectedStudent(stu);
    setSearchQuery("");
    const niveauActuel = NIVEAUX.find((n) => n.alias === stu.niveau && n.filiereId === stu.filiereId);
    const derniere = [...studentInscriptions].sort((a, b) => b.annee.localeCompare(a.annee))[0];
    setFiliereId(stu.filiereId);
    setNiveauId(niveauActuel?.id ?? "");
    setAnnee(stu.annee);
    setSpecialite(derniere?.specialite ?? "");
    setModeleFraisId(derniere?.modeleFraisId ?? "");
  };

  const niveauxFiliere = useMemo(() => NIVEAUX.filter((n) => n.filiereId === filiereId), [filiereId]);
  const niveau = NIVEAUX.find((n) => n.id === niveauId);

  const peutSoumettre = !!selectedStudent && !!filiereId && !!niveauId && !!annee && motif.trim().length > 0;

  const resolveClasseId = (): string | undefined => {
    const dispo = classes.filter((c) => c.filiereId === filiereId && c.niveau === niveau?.alias && c.annee === annee && !c.cloturee);
    if (dispo.length === 0) return undefined;
    return [...dispo].sort((a, b) => (b.max - b.inscrits) - (a.max - a.inscrits))[0].id;
  };

  const handleSave = () => {
    if (!selectedStudent || !peutSoumettre || !niveau) return;
    const classeId = resolveClasseId();
    if (!classeId) {
      toast.error(`Aucune classe pédagogique disponible pour ${niveau.alias} en ${annee} dans cette filière.`);
      return;
    }
    const classeResolue = classes.find((c) => c.id === classeId);
    const modele = modelesFrais.find((m) => m.id === modeleFraisId);
    setSaving(true);
    try {
      registerInscriptionCorrection(
        {
          etudiantId: selectedStudent.id,
          annee,
          filiereId,
          classeId,
          niveau: niveau.alias,
          statut: selectedStudent.statut,
          soldeDu: selectedStudent.soldeDu,
          specialite: specialite.trim() || undefined,
          modeleFraisId: modele?.id,
          modeleFrais: modele?.intitule,
          effectuePar: currentUser?.name ?? "Administration",
        },
        motif.trim(),
      );
      toast.success(`Inscription corrigée — ${selectedStudent.prenom} ${selectedStudent.nom} inscrit(e) dans ${classeResolue?.nom}`);
      setLocation(`/admin/students/${selectedStudent.id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Scolarité" }, { label: "Inscription" }, { label: "Correction inscription" }]}
        title="Correction inscription"
        subtitle="Corriger la filière, le niveau ou l'année d'un étudiant déjà inscrit, avec motif obligatoire"
        actions={
          <button onClick={() => setLocation("/admin/students")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="max-w-2xl space-y-4">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Étudiants</p>
          {selectedStudent ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary bg-primary/5">
              <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="sm" />
              <div className="flex-1">
                <div className="font-medium text-foreground text-sm">{selectedStudent.matricule} — {selectedStudent.prenom} {selectedStudent.nom}</div>
                <div className="text-xs text-muted-foreground">{selectedStudent.telephone}</div>
              </div>
              <button onClick={() => { setSelectedStudent(null); setFiliereId(""); setNiveauId(""); setAnnee(""); setSpecialite(""); setModeleFraisId(""); setMotif(""); }} className="text-xs text-primary hover:underline ml-2">Changer</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom ou matricule…"
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="correction-inscription-search"
                />
              </div>
              {filteredStudents.map((stu) => (
                <div
                  key={stu.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted cursor-pointer transition-all"
                  onClick={() => pickStudent(stu)}
                  data-testid={`correction-inscription-option-${stu.id}`}
                >
                  <UserAvatar name={`${stu.prenom} ${stu.nom}`} size="sm" />
                  <div className="flex-1">
                    <div className="font-medium text-foreground text-sm">{stu.matricule} — {stu.prenom} {stu.nom}</div>
                    <div className="text-xs text-muted-foreground">{stu.telephone}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {selectedStudent && (
          <>
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-800 text-white text-sm" data-testid="correction-inscription-bandeau">
              <Briefcase size={15} />
              Inscrit(e) en {selectedStudent.filiere} / {selectedStudent.niveau} / {selectedStudent.classe} — {selectedStudent.annee}
            </div>

            <div className="bg-card border border-border rounded-xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Nouvelle fiche d&apos;inscription</p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière *</label>
                <select value={filiereId} onChange={(e) => { setFiliereId(e.target.value); setNiveauId(""); }} className={inputClass} data-testid="correction-inscription-filiere">
                  <option value="">Sélectionner</option>
                  {FILIERES.filter((f) => f.statut === "actif").map((f) => <option key={f.id} value={f.id}>{f.code} — {f.nom}</option>)}
                </select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Choix année scolaire *</label>
                  <select value={annee} onChange={(e) => setAnnee(e.target.value)} className={inputClass} data-testid="correction-inscription-annee">
                    <option value="">Sélectionner</option>
                    {ANNEES_ACADEMIQUES.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau *</label>
                  <select value={niveauId} onChange={(e) => setNiveauId(e.target.value)} disabled={!filiereId} className={cn(inputClass, "disabled:opacity-50")} data-testid="correction-inscription-niveau">
                    <option value="">Sélectionner</option>
                    {niveauxFiliere.map((n) => <option key={n.id} value={n.id}>{n.nom} ({n.alias})</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Spécialité</label>
                  <input value={specialite} onChange={(e) => setSpecialite(e.target.value)} placeholder="Optionnel" className={inputClass} data-testid="correction-inscription-specialite" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Modèle de frais</label>
                  <select value={modeleFraisId} onChange={(e) => setModeleFraisId(e.target.value)} className={inputClass} data-testid="correction-inscription-modele-frais">
                    <option value="">Sélectionner</option>
                    {modelesFrais.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.intitule}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motif *</label>
                <textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  placeholder="Veuillez saisir le motif"
                  className={cn(inputClass, "resize-y")}
                  data-testid="correction-inscription-motif"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={!peutSoumettre || saving}
                className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="correction-inscription-sauvegarder"
              >
                {saving ? "Enregistrement…" : "Sauvegarder"}
              </button>
              <button onClick={() => setLocation("/admin/students")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
