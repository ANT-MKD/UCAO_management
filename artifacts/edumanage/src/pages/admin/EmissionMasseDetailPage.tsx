import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useEmissionsMasse } from "@/hooks/useEmissionMasseStore";
import { usePaiements } from "@/hooks/useStudentStore";
import { useModelesFrais } from "@/hooks/useFinanceSettingsStore";
import { cancelEmissionMasse } from "@/data/emissionMasseStore";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, cn } from "@/lib/utils";

function buildEmissionHtml(args: {
  reference: string;
  filiere: string;
  annee: string;
  niveau: string;
  classe: string;
  emisLe: string;
  emisPar: string;
  ligneIntitules: string[];
  commentaire: string;
  lignes: { numeroRecu: string; etudiant: string; montant: number }[];
}): string {
  const total = args.lignes.reduce((s, l) => s + l.montant, 0);
  return buildPrintDocumentHtml({
    badge: "ÉMISSION",
    numero: args.reference,
    date: formatDate(args.emisLe),
    dateLabel: "Émis le",
    metaDroiteExtra: [{ label: "Effectuée par", valeur: args.emisPar }],
    destinataireLabel: "Cohorte concernée",
    destinataireNom: `${args.filiere} — ${args.niveau}`,
    destinataireLignes: [
      `Classe : ${args.classe}`,
      `Année : ${args.annee}`,
      `Frais facturés : ${args.ligneIntitules.join(", ") || "—"}`,
      ...(args.commentaire ? [`Commentaire : ${args.commentaire}`] : []),
    ],
    tableauPersonnalise: {
      entetes: ["N° quittance", "Étudiant", "Montant"],
      lignes: args.lignes.map((l) => [l.numeroRecu, l.etudiant, formatCFA(l.montant)]),
    },
    summary: [{ label: "Total facturé", montant: total, emphasis: "total" }],
  });
}

export default function EmissionMasseDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const emissions = useEmissionsMasse();
  const paiements = usePaiements();
  const modelesFrais = useModelesFrais();
  const [expanded, setExpanded] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = emissions.find((e) => e.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Émission en masse", href: "/admin/emissions-masse" }]}
          title="Émission introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cette génération n&apos;existe pas ou a été supprimée.
        </div>
      </div>
    );
  }

  const quittances = record.quittanceIds
    .map((qid) => paiements.find((p) => p.id === qid))
    .filter((p): p is NonNullable<typeof p> => !!p);
  const montantTotal = quittances.reduce(
    (sum, q) => sum + (q.lignes && q.lignes.length > 0 ? q.lignes.reduce((s, l) => s + l.montant, 0) : q.montant),
    0,
  );

  const handleCancel = () => {
    cancelEmissionMasse(record.id);
    toast.success("Génération annulée — les quittances non payées ont été annulées");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildEmissionHtml({
        reference: record.reference,
        filiere: record.filiere,
        annee: record.annee,
        niveau: record.niveau,
        classe: record.classe,
        emisLe: record.emisLe,
        emisPar: record.emisPar,
        ligneIntitules: record.ligneIntitules,
        commentaire: record.commentaire,
        lignes: quittances.map((q) => ({
          numeroRecu: q.numeroRecu,
          etudiant: q.etudiant,
          montant: q.lignes && q.lignes.length > 0 ? q.lignes.reduce((s, l) => s + l.montant, 0) : q.montant,
        })),
      }),
    );
    win.document.close();
    win.print();
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Émission en masse", href: "/admin/emissions-masse" },
          { label: record.reference },
        ]}
        title={`Émission ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/emissions-masse")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Fermer
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="emm-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Cette génération a été annulée. Les quittances non payées qu&apos;elle avait créées ont été annulées.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Programme</p>
          <p className="font-semibold text-sm mt-1">{record.filiere}</p>
          <p className="text-xs text-muted-foreground">{record.niveau} — {record.classe} — {record.annee}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Émis le / Effectuée par</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.emisLe)}</p>
          <p className="text-xs text-muted-foreground">{record.emisPar}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Modèle de frais / Facturé le</p>
          <p className="font-semibold text-sm mt-1">{modelesFrais.find((m) => m.id === record.modeleFraisId)?.intitule ?? record.modeleFraisId}</p>
          <p className="text-xs text-muted-foreground">{formatDate(record.dateFacturation)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total facturé</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(montantTotal)}</p>
          <p className="text-xs text-muted-foreground">{quittances.length} quittance(s)</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">Frais facturés (grille tarifaire)</h3>
        <p className="text-sm">{record.ligneIntitules.join(" + ") || "—"}</p>
      </div>

      {record.commentaire && (
        <div className="bg-card border border-border rounded-xl p-5 mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide mb-2">Commentaire</h3>
          <p className="text-sm text-muted-foreground">{record.commentaire}</p>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
          data-testid="emm-toggle-quittances"
        >
          <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-2">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {quittances.length} quittance(s) créée(s) — cliquer ici pour consulter
          </span>
        </button>
        {expanded && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">N° quittance</th>
                <th className="text-left px-4 py-3">Étudiant</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-center px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {quittances.map((q) => {
                const montant = q.lignes && q.lignes.length > 0 ? q.lignes.reduce((s, l) => s + l.montant, 0) : q.montant;
                const statut = q.statut === "annule" ? "Annulé" : q.montant === 0 ? "Impayé" : q.montant >= montant ? "Payé" : "Acompte";
                return (
                  <tr
                    key={q.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setLocation(`/admin/paiements/${q.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{q.numeroRecu}</td>
                    <td className="px-4 py-3">{q.etudiant}</td>
                    <td className="px-4 py-3 text-right">{formatCFA(montant)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-medium",
                          statut === "Payé" && "bg-emerald-50 text-emerald-700",
                          statut === "Acompte" && "bg-amber-50 text-amber-700",
                          statut === "Annulé" && "bg-red-50 text-red-700",
                          statut === "Impayé" && "bg-slate-100 text-slate-600",
                        )}
                      >
                        {statut}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!record.annulee ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler la génération
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Cette génération a été annulée.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler la génération {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Les quittances non encore payées seront annulées et le solde des étudiants concernés sera rétabli. Action irréversible.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmCancel(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={handleCancel} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
