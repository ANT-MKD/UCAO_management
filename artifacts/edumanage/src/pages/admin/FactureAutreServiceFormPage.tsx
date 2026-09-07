import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useArticlesService } from "@/hooks/useFinanceSettingsStore";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { addFactureAutreService } from "@/data/factureAutreServiceStore";
import type { FactureAutreServiceLigne } from "@/data/factureAutreServiceStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

function moyenColors(label: string): { color: string; bg: string } {
  const l = label.toLowerCase();
  if (l.includes("wave")) return { color: "#2563eb", bg: "#eff6ff" };
  if (l.includes("orange")) return { color: "#ea580c", bg: "#fff7ed" };
  if (l.includes("vir")) return { color: "#4f46e5", bg: "#eef2ff" };
  if (l.includes("esp")) return { color: "#16a34a", bg: "#f0fdf4" };
  if (l.includes("ch")) return { color: "#64748b", bg: "#f8fafc" };
  return { color: "#64748b", bg: "#f8fafc" };
}

const STEP_LABELS = ["Bénéficiaire & articles", "Paiement", "Confirmation"];

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function FactureAutreServiceFormPage() {
  const [, setLocation] = useLocation();
  const articles = useArticlesService();
  const modesPaiement = useModesPaiementFinance();
  const { currentUser } = useAuth();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [beneficiaire, setBeneficiaire] = useState("");
  const [telephone, setTelephone] = useState("");
  const [referenceExterne, setReferenceExterne] = useState("");
  const [adresse, setAdresse] = useState("");
  const [remarque, setRemarque] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [lignes, setLignes] = useState<FactureAutreServiceLigne[]>([]);

  const [montantVerse, setMontantVerse] = useState("");
  const [dateOperation, setDateOperation] = useState(new Date().toISOString().split("T")[0]);
  const [selectedMoyen, setSelectedMoyen] = useState("Wave");
  const [referenceBancaire, setReferenceBancaire] = useState("");

  const totalFacture = useMemo(() => lignes.reduce((s, l) => s + l.montant, 0), [lignes]);

  const syncMontantVerse = (nextLignes: FactureAutreServiceLigne[]) => {
    setMontantVerse(String(nextLignes.reduce((s, l) => s + l.montant, 0)));
  };

  const handleAddArticle = (articleId: string) => {
    setSelectedArticleId("");
    if (!articleId) return;
    const article = articles.find((a) => a.id === articleId);
    if (!article) return;
    setLignes((prev) => {
      const existing = prev.find((l) => l.articleId === articleId);
      const next = existing
        ? prev.map((l) =>
            l.articleId === articleId
              ? { ...l, quantite: l.quantite + 1, montant: l.prixUnitaire * (l.quantite + 1) }
              : l,
          )
        : [...prev, { articleId, article: article.intitule, prixUnitaire: article.prixUnitaire, quantite: 1, montant: article.prixUnitaire }];
      syncMontantVerse(next);
      return next;
    });
  };

  const updateQuantite = (articleId: string, quantite: number) => {
    setLignes((prev) => {
      const next = prev.map((l) => (l.articleId === articleId ? { ...l, quantite: Math.max(1, quantite), montant: l.prixUnitaire * Math.max(1, quantite) } : l));
      syncMontantVerse(next);
      return next;
    });
  };

  const removeLigne = (articleId: string) => {
    setLignes((prev) => {
      const next = prev.filter((l) => l.articleId !== articleId);
      syncMontantVerse(next);
      return next;
    });
  };

  const canGoStep2 = beneficiaire.trim().length > 0 && remarque.trim().length > 0 && lignes.length > 0;
  const canGoStep3 = Number(montantVerse) >= 0 && Number(montantVerse) <= totalFacture;

  const handleSubmit = () => {
    const record = addFactureAutreService({
      beneficiaire: beneficiaire.trim(),
      telephone: telephone.trim() || undefined,
      adresse: adresse.trim() || undefined,
      referenceExterne: referenceExterne.trim() || undefined,
      remarque: remarque.trim(),
      lignes,
      montantVerse: Number(montantVerse) || 0,
      moyen: Number(montantVerse) > 0 ? selectedMoyen : undefined,
      referenceBancairePaiement: referenceBancaire.trim() || undefined,
      datePaiement: Number(montantVerse) > 0 ? dateOperation : undefined,
      date: dateOperation,
      ajouteePar: currentUser?.name ?? "Administration",
    });
    setSubmitted(true);
    setTimeout(() => setLocation(`/admin/factures-autres-services/${record.id}`), 1500);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Les factures des autres services", href: "/admin/factures-autres-services" },
          { label: "Nouvelle facture" },
        ]}
        title="Nouvelle facture autre service"
        actions={
          <button onClick={() => setLocation("/admin/factures-autres-services")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Annuler
          </button>
        }
      />

      <div className="flex items-center justify-center mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                step === i + 1 ? "bg-primary text-white shadow-lg shadow-primary/30" :
                step > i + 1 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              )}>
                {step > i + 1 ? <Check size={14} /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium mt-1.5 whitespace-nowrap max-w-28 text-center", step === i + 1 ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn("h-0.5 w-14 mx-2 mb-5 rounded-full transition-all", step > i + 1 ? "bg-emerald-500" : "bg-muted")} />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto">
        {step === 1 && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Bénéficiaire <span className="text-red-500">*</span>
                </label>
                <input value={beneficiaire} onChange={(e) => setBeneficiaire(e.target.value)} className={inputClass} data-testid="fas-beneficiaire" placeholder="Nom du bénéficiaire" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone mobile</label>
                <div className="flex gap-2">
                  <span className="flex items-center px-3 py-2.5 text-sm border border-border rounded-xl bg-muted/40 text-muted-foreground">🇸🇳 +221</span>
                  <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputClass} data-testid="fas-telephone" placeholder="77 XXX XX XX" />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Référence</label>
                <input value={referenceExterne} onChange={(e) => setReferenceExterne(e.target.value)} className={inputClass} data-testid="fas-reference" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Adresse</label>
                <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={inputClass} data-testid="fas-adresse" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Remarque <span className="text-red-500">*</span>
              </label>
              <textarea value={remarque} onChange={(e) => setRemarque(e.target.value)} rows={3} className={inputClass} data-testid="fas-remarque" />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Ajouter un article</label>
              <select
                value={selectedArticleId}
                onChange={(e) => handleAddArticle(e.target.value)}
                className={inputClass}
                data-testid="fas-select-article"
              >
                <option value="">Veuillez choisir un article</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>{a.intitule} — {formatCFA(a.prixUnitaire)}</option>
                ))}
              </select>
              {articles.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1.5">
                  Aucun article configuré — ajoutez-en dans Paramétrage finances → Article/Service.
                </p>
              )}
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 text-xs font-bold text-foreground uppercase tracking-wide">
                Les articles à ajouter
              </div>
              {lignes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun article ajouté.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-4 py-2">Article</th>
                      <th className="text-right px-4 py-2">Prix Unitaire</th>
                      <th className="text-right px-4 py-2">Quantité</th>
                      <th className="text-right px-4 py-2">Montant</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l) => (
                      <tr key={l.articleId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5">{l.article}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCFA(l.prixUnitaire)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <input
                            type="number"
                            min={1}
                            value={l.quantite}
                            onChange={(e) => updateQuantite(l.articleId, Number(e.target.value) || 1)}
                            className="w-16 px-2 py-1 text-right border border-border rounded-lg bg-background text-sm"
                            data-testid={`fas-quantite-${l.articleId}`}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatCFA(l.montant)}</td>
                        <td className="px-2 py-2.5 text-right">
                          <button onClick={() => removeLigne(l.articleId)} className="p-1 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors" aria-label="Retirer">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="px-4 py-2.5" colSpan={3}>Total facture</td>
                      <td className="px-4 py-2.5 text-right text-primary">{formatCFA(totalFacture)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setLocation("/admin/factures-autres-services")} className="flex-1 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                Annuler
              </button>
              <button
                onClick={() => canGoStep2 && setStep(2)}
                disabled={!canGoStep2}
                className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                data-testid="fas-suivant"
              >
                Suivant <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
              {lignes.map((l) => (
                <div key={l.articleId} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{l.article} × {l.quantite}</span>
                  <span>{formatCFA(l.montant)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm border-t border-border pt-2 font-bold">
                <span>Total facture</span>
                <span className="text-primary">{formatCFA(totalFacture)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant versé (FCFA)</label>
                <input
                  type="number"
                  min={0}
                  max={totalFacture}
                  value={montantVerse}
                  onChange={(e) => setMontantVerse(e.target.value)}
                  className={cn(inputClass, "font-mono")}
                  data-testid="fas-montant-verse"
                />
                {Number(montantVerse) > 0 && Number(montantVerse) < totalFacture && (
                  <p className="text-[11px] text-amber-600 mt-1">Versement partiel — la facture restera en statut Acompte.</p>
                )}
                {Number(montantVerse) === 0 && <p className="text-[11px] text-muted-foreground mt-1">Aucun versement — facture émise en Impayé.</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date d&apos;opération</label>
                <input type="date" value={dateOperation} onChange={(e) => setDateOperation(e.target.value)} className={inputClass} />
              </div>
            </div>

            {Number(montantVerse) > 0 && (
              <>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-3">Mode de paiement</label>
                  <div className="grid grid-cols-3 gap-2">
                    {modesPaiement.map((m) => {
                      const colors = moyenColors(m.intitule);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMoyen(m.intitule)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold",
                            selectedMoyen === m.intitule ? "border-current" : "border-border hover:border-muted-foreground",
                          )}
                          style={selectedMoyen === m.intitule ? { background: colors.bg, color: colors.color, borderColor: colors.color } : {}}
                          data-testid={`fas-moyen-${m.code}`}
                        >
                          <div className="w-5 h-5 rounded-full" style={{ background: colors.color }} />
                          {m.intitule}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Référence bancaire / N° reçu</label>
                  <input value={referenceBancaire} onChange={(e) => setReferenceBancaire(e.target.value)} className={cn(inputClass, "font-mono")} placeholder="Auto si vide" />
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <button
                onClick={() => canGoStep3 && setStep(3)}
                disabled={!canGoStep3}
                className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                data-testid="fas-confirmer"
              >
                Confirmer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Facture enregistrée</h3>
                <p className="text-sm text-muted-foreground mt-1">Reçu généré — redirection...</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ClipboardCheck size={24} className="text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Confirmation — facture autre service</h3>
                </div>
                <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3 mb-6">
                  {[
                    { label: "Bénéficiaire", value: beneficiaire },
                    ...(telephone ? [{ label: "Téléphone", value: `+221 ${telephone}` }] : []),
                    { label: "Remarque", value: remarque },
                    { label: "Total facture", value: formatCFA(totalFacture), primary: true },
                    { label: "Montant versé", value: formatCFA(Number(montantVerse) || 0) },
                    { label: "Date", value: dateOperation },
                    ...(Number(montantVerse) > 0 ? [{ label: "Moyen", value: selectedMoyen }] : []),
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0 gap-4">
                      <span className="text-muted-foreground shrink-0">{row.label}</span>
                      <span className={cn("font-medium text-foreground text-right", "primary" in row && row.primary && "text-primary font-bold text-base")}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                    <ArrowLeft size={16} /> Retour
                  </button>
                  <button onClick={handleSubmit} className="flex items-center gap-2 flex-1 justify-center py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors" data-testid="fas-valider">
                    <Check size={16} /> Valider et Générer Reçu
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
