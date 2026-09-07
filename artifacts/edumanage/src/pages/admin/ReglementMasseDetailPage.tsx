import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useReglementsMasse } from "@/hooks/useReglementMasseStore";
import { cancelReglementMasse } from "@/data/reglementMasseStore";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import { statutReglementMasse } from "@/pages/admin/ReglementMassePage";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  Validé: "bg-emerald-50 text-emerald-700",
  Annulé: "bg-slate-100 text-slate-600",
};

function buildReglementHtml(args: {
  reference: string;
  organisme: string;
  annee: string;
  date: string;
  modePaiement: string;
  referenceBancaire?: string;
  lignes: { reference: string; etudiant: string; montant: number }[];
}): string {
  const total = args.lignes.reduce((s, l) => s + l.montant, 0);
  return buildPrintDocumentHtml({
    badge: "RÈGLEMENT MASSE",
    numero: args.reference,
    date: formatDate(args.date),
    destinataireLabel: "Entité",
    destinataireNom: args.organisme,
    destinataireLignes: [`Année référence : ${args.annee}`],
    tableauPersonnalise: {
      entetes: ["Prise en charge", "Étudiant", "Montant réglé"],
      lignes: args.lignes.map((l) => [l.reference, l.etudiant, formatCFA(l.montant)]),
    },
    encartLabel: "Méthode de paiement",
    encartLignes: [`Mode : ${args.modePaiement}`, ...(args.referenceBancaire ? [`Référence : ${args.referenceBancaire}`] : [])],
    summary: [{ label: "Total réglé", montant: total, emphasis: "total" }],
  });
}

export default function ReglementMasseDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const reglements = useReglementsMasse();
  const organismes = useOrganismesPEC();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = reglements.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les règlements en masse", href: "/admin/encaissements-pec-masse" }]}
          title="Règlement introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce règlement n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const statut = statutReglementMasse(record);
  const total = record.lignes.reduce((s, l) => s + l.montant, 0);
  const organisme = organismes.find((o) => o.id === record.organismeId);

  const handleCancel = () => {
    cancelReglementMasse(record.id);
    toast.success("Règlement en masse annulé — l'encaissement a été retiré de chaque PEC concernée");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildReglementHtml({
        reference: record.reference,
        organisme: record.organisme,
        annee: record.annee,
        date: record.date,
        modePaiement: record.modePaiement,
        referenceBancaire: record.referenceBancaire,
        lignes: record.lignes,
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
          { label: "Les règlements en masse", href: "/admin/encaissements-pec-masse" },
          { label: record.reference },
        ]}
        title={`Règlement en masse ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/encaissements-pec-masse")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="regm-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Ce règlement en masse a été annulé. L&apos;encaissement a été retiré de chaque PEC concernée.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Entité</p>
          {organisme ? (
            <button onClick={() => setLocation(`/admin/organismes-pec/${organisme.id}`)} className="font-semibold text-sm mt-1 text-primary hover:underline text-left" data-testid="regm-voir-organisme">
              {record.organisme}
            </button>
          ) : (
            <p className="font-semibold text-sm mt-1">{record.organisme}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Année référence</p>
          <p className="font-semibold text-sm mt-1">{record.annee}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Date / Mode de paiement</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
          <p className="text-xs text-muted-foreground">{record.modePaiement}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Montant global / Réparti</p>
          <p className="font-semibold text-sm mt-1">{formatCFA(record.montantGlobal)}</p>
          <p className="text-xs text-muted-foreground">Réparti : {formatCFA(total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Statut</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Prises en charge concernées</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Référence PEC</th>
              <th className="text-left px-4 py-3">Étudiant</th>
              <th className="text-right px-4 py-3">Montant réglé</th>
              <th className="w-14" />
            </tr>
          </thead>
          <tbody>
            {record.lignes.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{l.reference}</td>
                <td className="px-4 py-3">{l.etudiant}</td>
                <td className="px-4 py-3 text-right font-medium">{formatCFA(l.montant)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setLocation(`/admin/prises-en-charge/${l.priseEnChargeId}`)}
                    className="text-xs text-primary hover:underline whitespace-nowrap"
                  >
                    Voir la PEC
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!record.annulee ? (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler le règlement en masse
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Ce règlement a été annulé.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler le règlement {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              L&apos;encaissement sera retiré de chaque PEC concernée (leur reste à encaisser augmentera d&apos;autant). Action irréversible.
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
