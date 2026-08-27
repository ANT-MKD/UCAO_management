import { useState } from "react";
import { Link } from "wouter";
import { FileEdit, Ban } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { ENSEIGNANTS } from "@/data/mockData";
import { useEcs } from "@/hooks/useCurriculumStore";
import { useClasses } from "@/hooks/useStructureStore";
import { montantTotal, contractStatut, resilierContract, type ContractLigne } from "@/data/teacherContractStore";
import { useTeacherContracts } from "@/hooks/useTeacherContractStore";
import { type EnseignantRecord } from "@/lib/teacherUtils";
import { formatCFA, formatShortDate, formatDate, cn } from "@/lib/utils";

const MODE_LABEL: Record<ContractLigne["modePaiement"], string> = {
  taux_horaire: "Volume horaire",
  forfait: "Forfait",
};

function lignesTotal(lignes: ContractLigne[]): number {
  return lignes.reduce((sum, l) => sum + l.montant, 0);
}

export default function TeacherContractDetailPage({ id }: { id: string }) {
  const contracts = useTeacherContracts();
  const ecs = useEcs();
  const classes = useClasses();
  const teachers = ENSEIGNANTS as EnseignantRecord[];
  const [resilierOpen, setResilierOpen] = useState(false);
  const [motifResiliation, setMotifResiliation] = useState("");

  const contract = contracts.find((c) => c.id === id);

  if (!contract) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Accueil" }, { label: "Les contrats Professeur", href: "/admin/teachers/contracts" }]}
          title="Contrat introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce contrat n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const teacher = teachers.find((t) => t.id === contract.teacherId);
  const statut = contractStatut(contract);

  const handleResilier = () => {
    if (!motifResiliation.trim()) {
      toast.error("Indiquez un motif de résiliation");
      return;
    }
    resilierContract(contract.id, motifResiliation.trim());
    toast.success("Contrat résilié");
    setResilierOpen(false);
    setMotifResiliation("");
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Accueil" },
          { label: "Les contrats Professeur", href: "/admin/teachers/contracts" },
          { label: contract.id },
        ]}
        title={`Contrat ${contract.id}`}
        actions={
          !contract.resilie && (
            <div className="flex gap-2">
              <Link
                href={`/admin/teachers/contracts/${contract.id}/avenant`}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                data-testid="contract-nouvel-avenant"
              >
                <FileEdit size={15} /> Nouvel avenant
              </Link>
              <button
                type="button"
                onClick={() => setResilierOpen(true)}
                className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                data-testid="contract-resilier"
              >
                <Ban size={15} /> Résilier
              </button>
            </div>
          )
        }
      />

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Professeur</p>
          <p className="font-semibold text-sm mt-1">{teacher ? `${teacher.prenom} ${teacher.nom}` : contract.teacherId}</p>
          <p className="text-xs text-muted-foreground">{teacher?.matricule}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Année</p>
          <p className="font-semibold text-sm mt-1">{contract.annee}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Période</p>
          <p className="font-semibold text-sm mt-1">
            {formatShortDate(contract.dateDebut)} → {formatShortDate(contract.dateFin)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Statut</p>
          <span
            className={cn(
              "inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium",
              statut === "actif" && "bg-emerald-50 text-emerald-700",
              statut === "expire" && "bg-slate-100 text-slate-600",
              statut === "resilie" && "bg-red-50 text-red-700",
            )}
          >
            {statut === "actif" ? "Actif" : statut === "expire" ? "Expiré" : "Résilié"}
          </span>
          {contract.resilie && contract.motifResiliation && (
            <p className="text-xs text-red-600 mt-1">{contract.motifResiliation}</p>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Détails contrat</h3>
          <span className="text-sm font-semibold">{formatCFA(montantTotal(contract))}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Cours Professeur</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-left px-4 py-3">Mode Paiement</th>
              </tr>
            </thead>
            <tbody>
              {contract.lignes.map((l, i) => {
                const ec = ecs.find((e) => e.id === l.ecId);
                const classe = classes.find((c) => c.id === l.classeId);
                return (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{ec ? `${ec.code} — ${ec.libelle}` : l.ecId}</p>
                      <p className="text-xs text-muted-foreground">{classe?.nom}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCFA(l.montant)}</td>
                    <td className="px-4 py-3">{MODE_LABEL[l.modePaiement]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">
            Avenants {contract.avenants.length > 0 && `(${contract.avenants.length})`}
          </h3>
        </div>
        {contract.avenants.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Aucun avenant sur ce contrat.</div>
        ) : (
          <div className="divide-y divide-border">
            {[...contract.avenants].reverse().map((a) => (
              <div key={a.numero} className="px-5 py-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold text-sm">Avenant n°{a.numero}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(a.date)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{a.motif}</p>
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                  {a.dateFinAvant !== a.dateFinApres && (
                    <span>
                      Fin de contrat : {formatShortDate(a.dateFinAvant)} → <strong className="text-foreground">{formatShortDate(a.dateFinApres)}</strong>
                    </span>
                  )}
                  <span>
                    Montant : {formatCFA(lignesTotal(a.lignesAvant))} → <strong className="text-foreground">{formatCFA(lignesTotal(a.lignesApres))}</strong>
                  </span>
                  <span>
                    Cours : {a.lignesAvant.length} → <strong className="text-foreground">{a.lignesApres.length}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resilierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setResilierOpen(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1">Résilier le contrat {contract.id}</h2>
            <p className="text-xs text-muted-foreground mb-4">Cette action est définitive.</p>
            <textarea
              value={motifResiliation}
              onChange={(e) => setMotifResiliation(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Motif de la résiliation…"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setResilierOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={handleResilier} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
                Confirmer la résiliation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
