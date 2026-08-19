import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Check, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { TRANSACTIONS } from "@/data/mockData";
import { MODES_PAIEMENT } from "@/lib/inscriptionConstants";
import { formatCFA, cn } from "@/lib/utils";

const CATEGORIES = [...new Set(TRANSACTIONS.map((t) => t.categorie))];

interface TransactionForm {
  type: "Recette" | "Dépense";
  categorie: string;
  beneficiaire: string;
  libelle: string;
  montant: number;
  moyen: string;
  date: string;
  reference: string;
}

const MOYEN_STYLES: Record<string, { bg: string; text: string }> = {
  Wave: { bg: "#eff6ff", text: "#2563eb" },
  OrangeMoney: { bg: "#fff7ed", text: "#ea580c" },
  Virement: { bg: "#eef2ff", text: "#4f46e5" },
  Especes: { bg: "#f0fdf4", text: "#16a34a" },
  Cheque: { bg: "#f8fafc", text: "#64748b" },
};

export default function AddTransactionPage() {
  const [, setLocation] = useLocation();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<TransactionForm>({
    defaultValues: {
      type: "Recette",
      categorie: CATEGORIES[0] ?? "Scolarité",
      beneficiaire: "",
      libelle: "",
      montant: 0,
      moyen: "Wave",
      date: new Date().toISOString().split("T")[0],
      reference: "",
    },
  });

  const type = form.watch("type");
  const moyen = form.watch("moyen");
  const montant = form.watch("montant");

  const onSubmit = form.handleSubmit(() => {
    setSubmitted(true);
    setTimeout(() => setLocation("/admin/transactions"), 1500);
  });

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Transactions", href: "/admin/transactions" },
          { label: "Nouvelle opération" },
        ]}
        title="Nouvelle transaction"
        subtitle="Enregistrer une recette ou une dépense dans le journal comptable"
        actions={
          <button
            onClick={() => setLocation("/admin/transactions")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Retour au journal
          </button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={onSubmit} className="lg:col-span-2 space-y-5">
          <section className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4">Type d'opération</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["Recette", "Dépense"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => form.setValue("type", t)}
                  className={cn(
                    "flex items-center justify-center gap-2 py-4 rounded-xl border-2 text-sm font-semibold transition-all",
                    type === t
                      ? t === "Recette"
                        ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-red-400 bg-red-50 text-red-700"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t === "Recette" ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {t}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-2">Détails de l'opération</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Catégorie *</label>
                <select {...form.register("categorie", { required: true })} className={inputClass}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="Divers">Divers</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date *</label>
                <input type="date" {...form.register("date", { required: true })} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Bénéficiaire / Tiers *</label>
                <input {...form.register("beneficiaire", { required: true })} placeholder="Nom de l'étudiant, fournisseur, enseignant…" className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Libellé *</label>
                <input {...form.register("libelle", { required: true })} placeholder="Description de l'opération" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant (FCFA) *</label>
                <input type="number" min={0} {...form.register("montant", { required: true, valueAsNumber: true })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Référence</label>
                <input {...form.register("reference")} placeholder="WAVE-001, VIR-002…" className={cn(inputClass, "font-mono")} />
              </div>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4">Mode de règlement</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MODES_PAIEMENT.map((m) => {
                const style = MOYEN_STYLES[m.key] ?? { bg: "#f1f5f9", text: "#64748b" };
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => form.setValue("moyen", m.key)}
                    className={cn(
                      "py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all",
                      moyen === m.key ? "border-primary shadow-sm" : "border-transparent hover:bg-muted",
                    )}
                    style={moyen === m.key ? { background: style.bg, color: style.text } : undefined}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex gap-3">
            <button type="button" onClick={() => setLocation("/admin/transactions")} className="flex-1 py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted">
              Annuler
            </button>
            <button type="submit" className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90">
              Enregistrer la transaction
            </button>
          </div>
        </form>

        <aside>
          <div className="bg-card border border-border rounded-2xl p-5 sticky top-4" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground mb-4">Récapitulatif</h3>
            {submitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Check size={24} />
                </div>
                <p className="text-sm font-medium text-emerald-700">Transaction enregistrée (mock)</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={cn("text-center py-4 rounded-xl", type === "Recette" ? "bg-emerald-50" : "bg-red-50")}>
                  <p className="text-xs text-muted-foreground mb-1">{type}</p>
                  <p className={cn("text-2xl font-bold", type === "Recette" ? "text-emerald-600" : "text-red-600")}>
                    {type === "Recette" ? "+" : "−"}{formatCFA(montant || 0)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mode : <span className="font-semibold text-foreground">{moyen}</span>
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
