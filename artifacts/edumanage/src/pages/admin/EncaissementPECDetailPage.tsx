import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useEncaissementsPEC } from "@/hooks/useEncaissementPECStore";
import { cancelEncaissementPEC } from "@/data/encaissementPECStore";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import { montantEncaissement, statutEncaissementPEC } from "@/pages/admin/EncaissementPECPage";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  Validé: "bg-emerald-50 text-emerald-700",
  Annulé: "bg-red-50 text-red-700",
};

function buildEncaissementHtml(args: {
  reference: string;
  organisme: string;
  date: string;
  modePaiement: string;
  referenceBancaire?: string;
  lignes: { reference: string; montant: number }[];
}): string {
  const total = args.lignes.reduce((s, l) => s + l.montant, 0);
  return buildPrintDocumentHtml({
    badge: "ENCAISSEMENT PEC",
    numero: args.reference,
    date: formatDate(args.date),
    destinataireLabel: "Organisme",
    destinataireNom: args.organisme,
    colonneLabel: "Prise en charge",
    lignes: args.lignes.map((l) => ({ label: l.reference, montant: l.montant })),
    encartLabel: "Méthode de paiement",
    encartLignes: [`Mode : ${args.modePaiement}`, ...(args.referenceBancaire ? [`Référence : ${args.referenceBancaire}`] : [])],
    summary: [{ label: "Total encaissé", montant: total, emphasis: "total" }],
  });
}

export default function EncaissementPECDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const encaissements = useEncaissementsPEC();
  const organismes = useOrganismesPEC();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = encaissements.find((r) => r.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les encaissements PEC", href: "/admin/encaissements-pec" }]}
          title="Encaissement introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cet encaissement n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const total = montantEncaissement(record);
  const statut = statutEncaissementPEC(record);
  const organisme = organismes.find((o) => o.id === record.organismeId);

  const handleCancel = () => {
    cancelEncaissementPEC(record.id);
    toast.success("Encaissement annulé — l'encaissement a été retiré de chaque PEC concernée");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildEncaissementHtml({
        reference: record.reference,
        organisme: record.organisme,
        date: record.date,
        modePaiement: record.modePaiement,
        referenceBancaire: record.referenceBancaire,
        lignes: record.lignes.map((l) => ({ reference: l.reference, montant: l.montant })),
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
          { label: "Les encaissements PEC", href: "/admin/encaissements-pec" },
          { label: record.reference },
        ]}
        title={`Encaissement ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/encaissements-pec")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="enc-pec-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Cet encaissement a été annulé. L&apos;encaissement a été retiré de chaque PEC concernée.
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Organisme</p>
          {organisme ? (
            <button onClick={() => setLocation(`/admin/organismes-pec/${organisme.id}`)} className="font-semibold text-sm mt-1 text-primary hover:underline text-left" data-testid="enc-pec-voir-organisme">
              {record.organisme}
            </button>
          ) : (
            <p className="font-semibold text-sm mt-1">{record.organisme}</p>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Date / Mode de paiement</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
          <p className="text-xs text-muted-foreground">{record.modePaiement}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Référence bancaire</p>
          <p className="font-semibold text-sm mt-1">{record.referenceBancaire || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total encaissé</p>
          <p className="font-bold text-primary text-sm mt-1">{formatCFA(total)}</p>
          <p className="text-xs text-muted-foreground">Ajouté par : {record.ajouteePar}</p>
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
              <th className="text-right px-4 py-3">Montant encaissé</th>
              <th className="w-14" />
            </tr>
          </thead>
          <tbody>
            {record.lignes.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{l.reference}</td>
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
          Annuler l&apos;encaissement
        </label>
      ) : (
        <p className="text-sm text-red-600 font-medium">Cet encaissement a été annulé.</p>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler l&apos;encaissement {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              L&apos;encaissement reconnu sera retiré de chaque prise en charge concernée (son « reste à encaisser » redevient dû). Action irréversible.
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
