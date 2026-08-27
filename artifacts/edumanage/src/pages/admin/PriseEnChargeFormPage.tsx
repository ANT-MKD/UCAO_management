import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Search, Send, Upload } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useStudentStore, usePaiements } from "@/hooks/useStudentStore";
import type { EtudiantRecord } from "@/data/studentStore";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import { addPriseEnCharge, type TypePEC, type PriseEnChargeLigne } from "@/data/priseEnChargeStore";
import { useAuth } from "@/contexts/AuthContext";
import { montantQuittance } from "@/pages/admin/PaiementsPage";
import { formatCFA, formatShortDate, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PriseEnChargeFormPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const paiements = usePaiements();
  const organismes = useOrganismesPEC();

  const [type, setType] = useState<TypePEC>("montant");
  const [dateSaisie, setDateSaisie] = useState(today());
  const [organismeId, setOrganismeId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [dateLimite, setDateLimite] = useState("");
  const [montantTotal, setMontantTotal] = useState("");
  const [pourcentage, setPourcentage] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [referenceExterne, setReferenceExterne] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [filtreFrais, setFiltreFrais] = useState("");
  const { currentUser } = useAuth();

  const filteredStudents = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.telephone.includes(searchQuery)
      ).slice(0, 6)
    : [];

  const fraisImpayes = useMemo(() => {
    if (!selectedStudent) return [];
    return paiements
      .filter((p) => p.etudiantId === selectedStudent.id && p.statut !== "annule" && p.montant === 0)
      .map((p) => ({
        id: p.id,
        label: p.rubrique,
        montantFrais: montantQuittance(p),
        dateLimite: p.dateLimite,
      }));
  }, [paiements, selectedStudent]);

  const allocation = useMemo(() => {
    const checked = fraisImpayes.filter((f) => checkedIds.includes(f.id));
    if (type === "pourcentage") {
      const pct = Number(pourcentage) || 0;
      return checked.map((f) => ({ ...f, montantPEC: Math.round((f.montantFrais * pct) / 100) }));
    }
    let remaining = Number(montantTotal) || 0;
    return checked.map((f) => {
      const applied = Math.min(remaining, f.montantFrais);
      remaining -= applied;
      return { ...f, montantPEC: applied };
    });
  }, [fraisImpayes, checkedIds, type, montantTotal, pourcentage]);

  const totalAlloue = allocation.reduce((s, l) => s + l.montantPEC, 0);
  const nonAffecte = type === "montant" ? Math.max(0, (Number(montantTotal) || 0) - totalAlloue) : 0;

  const fraisImpayesFiltres = useMemo(
    () => fraisImpayes.filter((f) => f.label.toLowerCase().includes(filtreFrais.toLowerCase())),
    [fraisImpayes, filtreFrais],
  );

  const pickStudent = (s: EtudiantRecord) => {
    setSelectedStudent(s);
    setSearchQuery(`${s.prenom} ${s.nom}`);
    setCheckedIds([]);
    setFiltreFrais("");
  };

  const toggleLigne = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTousFraisFiltres = () => {
    const idsFiltres = fraisImpayesFiltres.map((f) => f.id);
    const tousCoches = idsFiltres.every((fid) => checkedIds.includes(fid));
    setCheckedIds((prev) =>
      tousCoches ? prev.filter((fid) => !idsFiltres.includes(fid)) : [...new Set([...prev, ...idsFiltres])],
    );
  };

  const handleSubmit = () => {
    if (!organismeId) {
      toast.error("Sélectionnez un organisme");
      return;
    }
    if (!selectedStudent) {
      toast.error("Sélectionnez un étudiant");
      return;
    }
    if (!debut || !fin || !dateLimite) {
      toast.error("Renseignez la période (début, fin) et la date limite");
      return;
    }
    if (type === "montant" && (!Number(montantTotal) || Number(montantTotal) <= 0)) {
      toast.error("Indiquez un montant valide");
      return;
    }
    if (type === "pourcentage" && (!Number(pourcentage) || Number(pourcentage) <= 0)) {
      toast.error("Indiquez un pourcentage valide");
      return;
    }
    if (allocation.length === 0 || totalAlloue <= 0) {
      toast.error("Sélectionnez au moins un frais à prendre en charge");
      return;
    }

    const organisme = organismes.find((o) => o.id === organismeId);
    const lignes: PriseEnChargeLigne[] = allocation.map((l) => ({
      quittanceId: l.id,
      label: l.label,
      montantFrais: l.montantFrais,
      montantPEC: l.montantPEC,
    }));

    const record = addPriseEnCharge({
      type,
      dateSaisie,
      organismeId,
      organisme: organisme?.intitule ?? "",
      etudiantId: selectedStudent.id,
      etudiant: `${selectedStudent.matricule} - ${selectedStudent.prenom} ${selectedStudent.nom}`,
      filiere: selectedStudent.filiere,
      annee: selectedStudent.annee,
      debut,
      fin,
      dateLimite,
      montant: type === "montant" ? Number(montantTotal) : undefined,
      pourcentage: type === "pourcentage" ? Number(pourcentage) : undefined,
      document: documentName || undefined,
      referenceExterne: referenceExterne || undefined,
      ajouteePar: currentUser?.name ?? "Administration",
      lignes,
    });

    toast.success(`Prise en charge ${record.reference} enregistrée`);
    setLocation(`/admin/prises-en-charge/${record.id}`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Les prises en charge", href: "/admin/prises-en-charge" },
          { label: "Nouvelle prise en charge" },
        ]}
        title="Nouvelle prise en charge"
        actions={
          <button
            onClick={() => setLocation("/admin/prises-en-charge")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-6 space-y-5 max-w-4xl" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            Type de PEC <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={type === "montant"} onChange={() => setType("montant")} className="accent-primary" />
              Prise en charge par montant
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={type === "pourcentage"} onChange={() => setType("pourcentage")} className="accent-primary" />
              PEC par pourcentage
            </label>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date saisie <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateSaisie} onChange={(e) => setDateSaisie(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Organisme <span className="text-red-500">*</span>
            </label>
            <select value={organismeId} onChange={(e) => setOrganismeId(e.target.value)} className={inputClass} data-testid="pec-organisme">
              <option value="">Sélectionner…</option>
              {organismes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.intitule}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Étudiant <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value.trim()) setSelectedStudent(null);
              }}
              placeholder="Code, prénom, nom ou téléphone de l'étudiant…"
              className={cn(inputClass, "pl-10")}
              data-testid="pec-student-search"
            />
          </div>
          {searchQuery.length > 1 && !selectedStudent && filteredStudents.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickStudent(s)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors"
                  data-testid={`pec-student-option-${s.id}`}
                >
                  <UserAvatar name={`${s.prenom} ${s.nom}`} size="sm" />
                  <span>
                    <span className="font-mono text-xs text-muted-foreground">{s.matricule}</span> — {s.prenom} {s.nom} ({s.telephone})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedStudent && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Filière</label>
            <input readOnly value={`${selectedStudent.filiere} — ${selectedStudent.classe} (${selectedStudent.annee})`} className={cn(inputClass, "bg-muted/40 text-muted-foreground")} />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Début <span className="text-red-500">*</span>
            </label>
            <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Fin <span className="text-red-500">*</span>
            </label>
            <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {type === "montant" ? "Montant" : "Pourcentage(%)"} <span className="text-red-500">*</span>
            </label>
            {type === "montant" ? (
              <input type="number" min={0} value={montantTotal} onChange={(e) => setMontantTotal(e.target.value)} className={inputClass} data-testid="pec-montant" />
            ) : (
              <input type="number" min={0} max={100} value={pourcentage} onChange={(e) => setPourcentage(e.target.value)} className={inputClass} data-testid="pec-pourcentage" />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Date limite P.E.C <span className="text-red-500">*</span>
            </label>
            <input type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Document</label>
            <label className={cn(inputClass, "flex items-center gap-2 cursor-pointer text-muted-foreground")}>
              <Upload size={14} />
              {documentName || "Choisir un fichier"}
              <input type="file" className="hidden" onChange={(e) => setDocumentName(e.target.files?.[0]?.name ?? "")} />
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Référence externe</label>
            <input value={referenceExterne} onChange={(e) => setReferenceExterne(e.target.value)} placeholder="Référence du dossier chez l'organisme" className={cn(inputClass, "font-mono")} />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Les frais concernés par la prise en charge</h3>
            {fraisImpayes.length > 0 && (
              <button onClick={toggleTousFraisFiltres} className="text-xs text-primary hover:underline">
                Tout {fraisImpayesFiltres.every((f) => checkedIds.includes(f.id)) && fraisImpayesFiltres.length > 0 ? "décocher" : "cocher"}
              </button>
            )}
          </div>
          <p className="text-xs text-red-500 mb-3">Seuls les frais qui n&apos;ont pas fait l&apos;objet d&apos;acompte sont susceptibles d&apos;être pris en charge</p>

          {!selectedStudent ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              Sélectionnez un étudiant pour voir ses frais impayés.
            </div>
          ) : fraisImpayes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              Aucun frais impayé (non entamé par un acompte) pour cet étudiant.
            </div>
          ) : (
            <>
              {fraisImpayes.length > 3 && (
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={filtreFrais}
                    onChange={(e) => setFiltreFrais(e.target.value)}
                    placeholder="Filtrer les frais (ex. scolarité)…"
                    className={cn(inputClass, "pl-9 py-2")}
                  />
                </div>
              )}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="px-3 py-2 w-8" />
                      <th className="text-left px-3 py-2">Intitulé frais</th>
                      <th className="text-right px-3 py-2">Montant</th>
                      <th className="text-right px-3 py-2">Montant PEC</th>
                      <th className="text-left px-3 py-2">Date Limite</th>
                      <th className="text-center px-3 py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fraisImpayesFiltres.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                          Aucun frais ne correspond au filtre.
                        </td>
                      </tr>
                    ) : (
                      fraisImpayesFiltres.map((f) => {
                        const checked = checkedIds.includes(f.id);
                        const ligne = allocation.find((l) => l.id === f.id);
                        return (
                          <tr key={f.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={checked} onChange={() => toggleLigne(f.id)} className="rounded" data-testid={`pec-ligne-${f.id}`} />
                            </td>
                            <td className="px-3 py-2">{f.label}</td>
                            <td className="px-3 py-2 text-right">{formatCFA(f.montantFrais)}</td>
                            <td className="px-3 py-2 text-right font-medium text-primary">{checked ? formatCFA(ligne?.montantPEC ?? 0) : "—"}</td>
                            <td className="px-3 py-2">{f.dateLimite ? formatShortDate(f.dateLimite) : "—"}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">Impayé</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-muted/20 flex justify-between text-xs">
                  <span className="text-muted-foreground">{checkedIds.length} frais sélectionné(s) — total pris en charge : <strong className="text-foreground">{formatCFA(totalAlloue)}</strong></span>
                  {nonAffecte > 0 && <span className="text-amber-600">Non affecté : {formatCFA(nonAffecte)}</span>}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="pec-submit"
          >
            <Send size={15} /> Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
