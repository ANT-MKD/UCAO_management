import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { useDevisList } from "@/hooks/useDevisStore";
import { annulerDevis } from "@/data/devisStore";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, cn } from "@/lib/utils";

function ligneDescription(intitule: string, montant: number, modalite: string, nbEcheances: number | undefined, dateLimite: string | undefined, modeleLabel: string): string {
  if (modalite === "echeances" && nbEcheances) {
    const parEcheance = Math.round(montant / nbEcheances);
    const dateTxt = dateLimite ? ` au plus tard le ${dateLimite}` : "";
    return `${intitule} - ${formatCFA(montant)} payable en ${nbEcheances} échéances de ${formatCFA(parEcheance)}${dateTxt} pour le modèle de frais ${modeleLabel}`;
  }
  return `${intitule} - ${formatCFA(montant)} pour le modèle de frais ${modeleLabel} avant inscription`;
}

function buildDevisHtml(args: {
  reference: string;
  date: string;
  filiereLabel: string;
  niveauLabel: string;
  annee: string;
  beneficiaire: string;
  telephone: string;
  email?: string;
  adresse?: string;
  tauxTaxe: number;
  lignesTxt: { desc: string; montantTTC: number }[];
  totalHT: number;
  totalTaxe: number;
  totalTTC: number;
}): string {
  return buildPrintDocumentHtml({
    badge: "DEVIS",
    numero: args.reference,
    date: formatDate(args.date),
    destinataireNom: args.beneficiaire,
    destinataireLignes: [
      args.telephone,
      ...(args.email ? [args.email] : []),
      ...(args.adresse ? [args.adresse] : []),
    ],
    metaDroiteLabel: "Filière",
    metaDroiteValeur: args.filiereLabel,
    metaDroiteSousLignes: [`${args.niveauLabel} — ${args.annee}`, `Taxe appliquée : ${args.tauxTaxe}%`],
    colonneLabel: "Intitulé",
    lignes: args.lignesTxt.map((l) => ({ label: l.desc, montant: l.montantTTC })),
    summary: [
      { label: "Total hors taxe", montant: args.totalHT },
      { label: "Total taxe", montant: args.totalTaxe },
      { label: "Grand Total (TTC)", montant: args.totalTTC, emphasis: "total" },
    ],
    messageMerci: "Document informatif, sans valeur d'engagement financier.",
  });
}

export default function DevisDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const devisList = useDevisList();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const record = devisList.find((d) => d.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les devis", href: "/admin/devis" }]}
          title="Devis introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce devis n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  const handleCancel = () => {
    const result = annulerDevis(record.id);
    if (!result.ok) {
      toast.error(result.reason);
      setConfirmCancel(false);
      return;
    }
    toast.success("Devis annulé");
    setConfirmCancel(false);
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildDevisHtml({
        reference: record.reference,
        date: record.date,
        filiereLabel: record.filiereLabel,
        niveauLabel: record.niveauLabel,
        annee: record.annee,
        beneficiaire: record.beneficiaire,
        telephone: record.telephone,
        email: record.email,
        adresse: record.adresse,
        tauxTaxe: record.tauxTaxe,
        lignesTxt: record.lignes.map((l) => ({
          desc: ligneDescription(l.intitule, l.montantHT, l.modalite, l.nbEcheances, l.dateLimite, record.modeleFraisLabel),
          montantTTC: l.montantTTC,
        })),
        totalHT: record.totalHT,
        totalTaxe: record.totalTaxe,
        totalTTC: record.totalTTC,
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
          { label: "Les devis", href: "/admin/devis" },
          { label: record.reference },
        ]}
        title={`Devis ${record.reference}`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/admin/devis")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="devis-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
            {!record.annule && !record.convertiEtudiantId && (
              <button
                onClick={() => setLocation(`/admin/devis/${record.id}/convertir`)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
                data-testid="devis-convertir"
              >
                <UserPlus size={15} /> Convertir en inscription
              </button>
            )}
          </div>
        }
      />

      {record.annule && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Ce devis a été annulé.
        </div>
      )}

      {record.convertiEtudiantId && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium flex items-center justify-between gap-3">
          <span>Ce devis a été converti en inscription réelle.</span>
          <button onClick={() => setLocation(`/admin/students/${record.convertiEtudiantId}`)} className="underline hover:no-underline whitespace-nowrap" data-testid="devis-voir-etudiant-converti">
            Voir la fiche étudiant
          </button>
        </div>
      )}

      <div className="mb-5 px-4 py-3 rounded-xl bg-sky-50 text-sky-700 text-xs">
        Document purement informatif : ce devis ne crée aucune dette ni quittance pour un étudiant.
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mb-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <p className="text-xs text-muted-foreground">Filière / Niveau</p>
          <button onClick={() => setLocation(`/admin/filieres/${record.filiereId}/edit`)} className="font-semibold text-sm mt-1 text-primary hover:underline text-left" data-testid="devis-voir-filiere">
            {record.filiereLabel}
          </button>
          <p className="text-xs text-muted-foreground">{record.niveauLabel} — {record.annee}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Adressé à</p>
          <p className="font-semibold text-sm mt-1">{record.beneficiaire}</p>
          <p className="text-xs text-muted-foreground">{record.telephone}{record.email ? ` · ${record.email}` : ""}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Émis le / Modèle de frais</p>
          <p className="font-semibold text-sm mt-1">{formatDate(record.date)}</p>
          <p className="text-xs text-muted-foreground">{record.modeleFraisLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Grand Total (TTC)</p>
          <p className="font-bold text-primary text-sm mt-1">{formatCFA(record.totalTTC)}</p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", record.annule ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
            {record.annule ? "Annulé" : "Actif"}
          </span>
        </div>
      </div>

      <div className="bg-sky-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl mb-0">
        Taxe appliquée : {record.tauxTaxe}%
      </div>
      <div className="bg-card border border-border rounded-b-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Intitulé</th>
              <th className="text-right px-4 py-3">Montant TTC</th>
            </tr>
          </thead>
          <tbody>
            {record.lignes.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{ligneDescription(l.intitule, l.montantHT, l.modalite, l.nbEcheances, l.dateLimite, record.modeleFraisLabel)}</td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatCFA(l.montantTTC)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/20">
              <td className="px-4 py-2 text-right text-xs text-muted-foreground">Total hors taxe</td>
              <td className="px-4 py-2 text-right text-sm">{formatCFA(record.totalHT)}</td>
            </tr>
            <tr className="bg-muted/20">
              <td className="px-4 py-2 text-right text-xs text-muted-foreground">Total taxe</td>
              <td className="px-4 py-2 text-right text-sm">{formatCFA(record.totalTaxe)}</td>
            </tr>
            <tr className="bg-muted/20 font-bold">
              <td className="px-4 py-3 text-right">Grand Total</td>
              <td className="px-4 py-3 text-right text-primary">{formatCFA(record.totalTTC)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {record.annule ? (
        <p className="text-sm text-red-600 font-medium">Ce devis a été annulé.</p>
      ) : record.convertiEtudiantId ? (
        <p className="text-xs text-muted-foreground">Ce devis a été converti en inscription — annulation impossible.</p>
      ) : (
        <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input type="checkbox" checked={false} onChange={() => setConfirmCancel(true)} className="rounded" />
          Annuler le devis
        </label>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmCancel(false)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Ban size={16} className="text-red-600" /> Annuler le devis {record.reference} ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Ce devis étant purement informatif, l&apos;annulation n&apos;a aucun impact financier.
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
