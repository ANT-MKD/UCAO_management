import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Ban, Printer, Building2, Mail, Phone, User, CalendarPlus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { usePrisesEnCharge } from "@/hooks/usePriseEnChargeStore";
import { cancelPriseEnCharge, prolongerPriseEnCharge, retirerLignePriseEnCharge, type PriseEnChargeLigne } from "@/data/priseEnChargeStore";
import { statutPEC, montantPEC, resteAEncaisser } from "@/pages/admin/PriseEnChargePage";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import { usePaiements } from "@/hooks/useStudentStore";
import { useEncaissementsPEC } from "@/hooks/useEncaissementPECStore";
import { statutEncaissementPEC } from "@/pages/admin/EncaissementPECPage";
import { montantQuittance, statutQuittance } from "@/pages/admin/PaiementsPage";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatCFA, formatDate, formatShortDate, cn } from "@/lib/utils";

const STATUT_CLS: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Expirée: "bg-red-50 text-red-700",
  Annulée: "bg-slate-100 text-slate-600",
};

const STATUT_ENC_CLS: Record<string, string> = {
  Validé: "bg-emerald-50 text-emerald-700",
  Annulé: "bg-red-50 text-red-700",
};

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function buildPECHtml(args: {
  reference: string;
  organisme: string;
  etudiant: string;
  filiere: string;
  annee: string;
  debut: string;
  fin: string;
  dateLimite: string;
  type: string;
  lignes: { label: string; montantFrais: number; montantPEC: number }[];
}): string {
  const total = args.lignes.reduce((s, l) => s + l.montantPEC, 0);
  return buildPrintDocumentHtml({
    badge: "PRISE EN CHARGE",
    numero: args.reference,
    date: formatDate(args.debut),
    dateLabel: "Début",
    metaDroiteExtra: [
      { label: "Fin", valeur: formatDate(args.fin) },
      { label: "Date limite", valeur: formatDate(args.dateLimite) },
    ],
    destinataireLabel: "Organisme",
    destinataireNom: args.organisme,
    destinataireLignes: [`Type : ${args.type}`],
    metaDroiteLabel: "Étudiant",
    metaDroiteValeur: args.etudiant,
    metaDroiteSousLignes: [`${args.filiere} (${args.annee})`],
    tableauPersonnalise: {
      entetes: ["Frais", "Montant", "Montant PEC"],
      lignes: args.lignes.map((l) => [l.label, formatCFA(l.montantFrais), formatCFA(l.montantPEC)]),
    },
    summary: [{ label: "Total pris en charge", montant: total, emphasis: "total" }],
  });
}

export default function PriseEnChargeDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const prisesEnCharge = usePrisesEnCharge();
  const organismes = useOrganismesPEC();
  const paiements = usePaiements();
  const encaissements = useEncaissementsPEC();
  const [action, setAction] = useState<"" | "annuler" | "prolonger">("");
  const [nouvelleFin, setNouvelleFin] = useState("");
  const [nouvelleDateLimite, setNouvelleDateLimite] = useState("");
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [filtreFrais, setFiltreFrais] = useState("");
  const [retirerTarget, setRetirerTarget] = useState<PriseEnChargeLigne | null>(null);

  const record = prisesEnCharge.find((r) => r.id === id);
  const organisme = record ? organismes.find((o) => o.id === record.organismeId) : undefined;

  const fraisEligibles = useMemo(() => {
    if (!record) return [];
    const dejaCouverts = new Set(record.lignes.map((l) => l.quittanceId));
    return paiements
      .filter((p) => p.etudiantId === record.etudiantId && p.statut !== "annule" && p.montant === 0 && !dejaCouverts.has(p.id))
      .map((p) => ({ id: p.id, label: p.rubrique, montantFrais: montantQuittance(p), dateLimite: p.dateLimite }));
  }, [paiements, record]);

  const fraisEligiblesFiltres = useMemo(
    () => fraisEligibles.filter((f) => f.label.toLowerCase().includes(filtreFrais.toLowerCase())),
    [fraisEligibles, filtreFrais],
  );

  const montantDejaApplique = record ? montantPEC(record) : 0;
  const resteDisponible = record?.type === "montant" ? Math.max(0, (record.montant ?? 0) - montantDejaApplique) : undefined;

  const allocationProlongation = useMemo(() => {
    if (!record) return [];
    const checked = fraisEligibles.filter((f) => checkedIds.includes(f.id));
    if (record.type === "pourcentage") {
      const pct = record.pourcentage ?? 0;
      return checked.map((f) => ({ ...f, montantPEC: Math.round((f.montantFrais * pct) / 100) }));
    }
    let remaining = resteDisponible ?? 0;
    return checked.map((f) => {
      const applied = Math.min(remaining, f.montantFrais);
      remaining -= applied;
      return { ...f, montantPEC: applied };
    });
  }, [record, fraisEligibles, checkedIds, resteDisponible]);

  const totalProlongation = allocationProlongation.reduce((s, l) => s + l.montantPEC, 0);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les prises en charge", href: "/admin/prises-en-charge" }]}
          title="Prise en charge introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cette prise en charge n&apos;existe pas ou a été supprimée.
        </div>
      </div>
    );
  }

  const statut = statutPEC(record);
  const total = montantPEC(record);
  const reste = resteAEncaisser(record);
  const encaissementsRecus = encaissements.filter((e) => e.lignes.some((l) => l.priseEnChargeId === record.id));

  const toggleLigne = (fid: string) => {
    setCheckedIds((prev) => (prev.includes(fid) ? prev.filter((x) => x !== fid) : [...prev, fid]));
  };

  const toggleTousFraisFiltres = () => {
    const idsFiltres = fraisEligiblesFiltres.map((f) => f.id);
    const tousCoches = idsFiltres.every((fid) => checkedIds.includes(fid));
    setCheckedIds((prev) =>
      tousCoches ? prev.filter((fid) => !idsFiltres.includes(fid)) : [...new Set([...prev, ...idsFiltres])],
    );
  };

  const handleRetirerLigne = () => {
    if (!retirerTarget) return;
    retirerLignePriseEnCharge(record.id, retirerTarget.quittanceId);
    toast.success(`Frais « ${retirerTarget.label} » retiré de la prise en charge`);
    setRetirerTarget(null);
  };

  const handleCancel = () => {
    cancelPriseEnCharge(record.id);
    toast.success("Prise en charge annulée — les quittances couvertes ont été rétablies");
    setAction("");
  };

  const handleProlonger = () => {
    if (!nouvelleFin || !nouvelleDateLimite) {
      toast.error("Indiquez la nouvelle date de fin et la nouvelle date limite");
      return;
    }
    if (nouvelleFin <= record.fin) {
      toast.error("La nouvelle date de fin doit être postérieure à la fin actuelle");
      return;
    }
    const lignes: PriseEnChargeLigne[] = allocationProlongation.map((l) => ({
      quittanceId: l.id,
      label: l.label,
      montantFrais: l.montantFrais,
      montantPEC: l.montantPEC,
    }));
    prolongerPriseEnCharge(record.id, { nouvelleFin, nouvelleDateLimite, lignes });
    toast.success(lignes.length > 0 ? `Prise en charge prolongée — ${lignes.length} frais supplémentaire(s) couvert(s)` : "Prise en charge prolongée");
    setAction("");
    setCheckedIds([]);
    setNouvelleFin("");
    setNouvelleDateLimite("");
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(
      buildPECHtml({
        reference: record.reference,
        organisme: record.organisme,
        etudiant: record.etudiant,
        filiere: record.filiere,
        annee: record.annee,
        debut: record.debut,
        fin: record.fin,
        dateLimite: record.dateLimite,
        type: record.type,
        lignes: record.lignes.map((l) => ({ label: l.label, montantFrais: l.montantFrais, montantPEC: l.montantPEC })),
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
          { label: "Les prises en charge", href: "/admin/prises-en-charge" },
          { label: record.reference },
        ]}
        title={`Consultation prise en charge [${record.reference}]`}
        actions={
          <div className="flex gap-2">
            {organisme && (
              <button
                onClick={() => setLocation(`/admin/organismes-pec/${organisme.id}`)}
                className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
              >
                Modifier l&apos;organisme
              </button>
            )}
            <button
              onClick={() => setLocation("/admin/prises-en-charge")}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="pec-imprimer"
            >
              <Printer size={15} /> Imprimer
            </button>
          </div>
        }
      />

      {record.annulee && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
          Cette prise en charge a été annulée. Les quittances qu&apos;elle couvrait ont été rétablies.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_380px] gap-5 mb-5">
        <div className="bg-card border border-border rounded-xl p-5 space-y-2" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-sm">{record.etudiant}</p>
            <p className="font-bold text-primary">{formatCFA(total)}</p>
          </div>
          <p className="text-xs text-muted-foreground">{record.filiere} | {record.annee}</p>
          <p className="text-sm">
            Type PEC : <strong>{record.type === "montant" ? "PEC par montant" : "PEC par pourcentage"}</strong>
            {record.type === "pourcentage" && <span className="text-muted-foreground"> ({record.pourcentage}%)</span>}
          </p>
          <p className="text-sm">
            Engagé : <strong>{formatCFA(total)}</strong> — Encaissé :{" "}
            <strong className="text-emerald-600">{formatCFA(record.montantEncaisse ?? 0)}</strong> — Reste à encaisser :{" "}
            <strong className={reste > 0 ? "text-amber-600" : "text-emerald-600"}>{formatCFA(reste)}</strong>
          </p>
          <p className="text-sm">
            Valable du <strong>{formatDate(record.debut)}</strong> au <strong>{formatDate(record.fin)}</strong>
          </p>
          <p className="text-sm">Date limite : <strong>{formatDate(record.dateLimite)}</strong></p>
          <p className="text-sm text-muted-foreground">Référence externe : {record.referenceExterne || "—"}</p>
          <p className="text-sm text-muted-foreground">Ajoutée par : <strong className="text-foreground">{record.ajouteePar}</strong></p>
          <span className={cn("inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium", STATUT_CLS[statut])}>{statut}</span>
        </div>

        {organisme && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-2.5 text-sm" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-primary shrink-0" />
              <span className="font-semibold">{organisme.intitule}</span>
            </div>
            {organisme.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail size={13} className="shrink-0" /> {organisme.email}
              </div>
            )}
            {organisme.telephone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={13} className="shrink-0" /> {organisme.telephone}
              </div>
            )}
            <div className="border-t border-border pt-2.5 flex items-center gap-2">
              <User size={13} className="text-muted-foreground shrink-0" />
              <span>Contact : <strong>{organisme.contactNom}</strong></span>
            </div>
            {organisme.contactEmail && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail size={13} className="shrink-0" /> Email contact : {organisme.contactEmail}
              </div>
            )}
            {organisme.contactTelephone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={13} className="shrink-0" /> Téléphone contact : {organisme.contactTelephone}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border bg-muted/40">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Frais concernés</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <th className="text-left px-4 py-3">Frais</th>
              <th className="text-right px-4 py-3">Montant</th>
              <th className="text-right px-4 py-3">Montant PEC</th>
              <th className="text-left px-4 py-3">Date limite</th>
              <th className="text-center px-4 py-3">Statut</th>
              {!record.annulee && <th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {record.lignes.map((l, i) => {
              const quittance = paiements.find((p) => p.id === l.quittanceId);
              const statutLigne = quittance ? statutQuittance(quittance) : "—";
              return (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{l.label}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCFA(l.montantFrais)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCFA(l.montantPEC)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{quittance?.dateLimite ? formatShortDate(quittance.dateLimite) : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        statutLigne === "Payé" && "bg-emerald-50 text-emerald-700",
                        statutLigne === "Acompte" && "bg-amber-50 text-amber-700",
                        statutLigne === "Impayé" && "bg-slate-100 text-slate-600",
                        statutLigne === "Annulé" && "bg-red-50 text-red-700",
                      )}
                    >
                      {statutLigne}
                    </span>
                  </td>
                  {!record.annulee && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setRetirerTarget(l)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        aria-label="Retirer ce frais"
                        data-testid={`pec-retirer-ligne-${l.quittanceId}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {encaissementsRecus.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 border-b border-border bg-muted/40">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Encaissements reçus</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="text-left px-4 py-3">Référence</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Mode de paiement</th>
                <th className="text-right px-4 py-3">Montant</th>
                <th className="text-center px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {encaissementsRecus.map((e) => {
                const ligne = e.lignes.find((l) => l.priseEnChargeId === record.id);
                const statutEnc = statutEncaissementPEC(e);
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setLocation(`/admin/encaissements-pec/${e.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{e.reference}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">{e.modePaiement}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCFA(ligne?.montant ?? 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUT_ENC_CLS[statutEnc])}>{statutEnc}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!record.annulee && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={action === "annuler"} onChange={() => setAction("annuler")} className="accent-primary" />
              Annuler la prise en charge
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" checked={action === "prolonger"} onChange={() => setAction("prolonger")} className="accent-primary" data-testid="pec-radio-prolonger" />
              Prolonger la prise en charge
            </label>
          </div>

          {action === "annuler" && (
            <div className="border-t border-border pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Les quittances couvertes redeviendront dues pour le montant retiré. Action irréversible.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setAction("")} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                  Annuler
                </button>
                <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
                  <Ban size={14} /> Confirmer l&apos;annulation
                </button>
              </div>
            </div>
          )}

          {action === "prolonger" && (
            <div className="border-t border-border pt-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Nouvelle date de fin <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={nouvelleFin} onChange={(e) => setNouvelleFin(e.target.value)} min={record.fin} className={inputClass} data-testid="pec-nouvelle-fin" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    Nouvelle date limite <span className="text-red-500">*</span>
                  </label>
                  <input type="date" value={nouvelleDateLimite} onChange={(e) => setNouvelleDateLimite(e.target.value)} className={inputClass} data-testid="pec-nouvelle-limite" />
                </div>
              </div>

              {record.type === "montant" && (
                <p className="text-xs text-muted-foreground">
                  Montant restant disponible sur cette PEC : <strong className="text-foreground">{formatCFA(resteDisponible ?? 0)}</strong>
                </p>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Frais éligibles non encore couverts</p>
                  {fraisEligibles.length > 0 && (
                    <button onClick={toggleTousFraisFiltres} className="text-xs text-primary hover:underline">
                      Tout {fraisEligiblesFiltres.every((f) => checkedIds.includes(f.id)) && fraisEligiblesFiltres.length > 0 ? "décocher" : "cocher"}
                    </button>
                  )}
                </div>
                {fraisEligibles.length > 3 && (
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
                {fraisEligibles.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                    Aucun frais impayé supplémentaire pour cet étudiant.
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          <th className="px-3 py-2 w-8" />
                          <th className="text-left px-3 py-2">Intitulé frais</th>
                          <th className="text-right px-3 py-2">Montant</th>
                          <th className="text-right px-3 py-2">Montant PEC</th>
                          <th className="text-left px-3 py-2">Date limite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fraisEligiblesFiltres.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                              Aucun frais ne correspond au filtre.
                            </td>
                          </tr>
                        ) : (
                          fraisEligiblesFiltres.map((f) => {
                            const checked = checkedIds.includes(f.id);
                            const ligne = allocationProlongation.find((l) => l.id === f.id);
                            return (
                              <tr key={f.id} className="border-b border-border last:border-0">
                                <td className="px-3 py-2">
                                  <input type="checkbox" checked={checked} onChange={() => toggleLigne(f.id)} className="rounded" data-testid={`pec-prolong-ligne-${f.id}`} />
                                </td>
                                <td className="px-3 py-2">{f.label}</td>
                                <td className="px-3 py-2 text-right">{formatCFA(f.montantFrais)}</td>
                                <td className="px-3 py-2 text-right font-medium text-primary">{checked ? formatCFA(ligne?.montantPEC ?? 0) : "—"}</td>
                                <td className="px-3 py-2">{f.dateLimite ? formatShortDate(f.dateLimite) : "—"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                    <div className="px-3 py-2 bg-muted/20 text-xs text-muted-foreground">
                      {checkedIds.length} frais sélectionné(s) — total ajouté à la PEC : <strong className="text-foreground">{formatCFA(totalProlongation)}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setAction("")} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                  Annuler
                </button>
                <button
                  onClick={handleProlonger}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90"
                  data-testid="pec-confirmer-prolongation"
                >
                  <CalendarPlus size={14} /> Confirmer la prolongation
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {record.annulee && <p className="text-sm text-red-600 font-medium">Cette prise en charge a été annulée.</p>}

      {retirerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRetirerTarget(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6">
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Trash2 size={16} className="text-red-600" /> Retirer « {retirerTarget.label} » ?
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Ce frais redeviendra dû par l&apos;étudiant. Les autres frais couverts par cette PEC ne sont pas affectés.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRetirerTarget(null)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted">
                Annuler
              </button>
              <button type="button" onClick={handleRetirerLigne} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700">
                Retirer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
