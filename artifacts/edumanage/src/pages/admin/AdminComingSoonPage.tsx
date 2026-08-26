import { Construction, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/admin/PageHeader";
import { ADMIN_WIP_PAGES, type AdminWipPage } from "@/lib/adminWipPages";

export default function AdminComingSoonPage({ pageId = "" }: { pageId?: string }) {
  const meta: AdminWipPage | undefined = ADMIN_WIP_PAGES[pageId];

  const title = meta?.title ?? "Fonctionnalité à venir";
  const section = meta?.section ?? "Admin";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: section }, { label: title }]}
        title={title}
        subtitle="Page en préparation — le métier sera développé étape par étape"
      />

      <div className="max-w-xl mx-auto">
        <div
          className="rounded-2xl border border-border bg-card p-8 md:p-10 text-center"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Construction size={28} />
          </div>
          <h2
            className="text-lg font-bold text-foreground"
            style={{ fontFamily: "Outfit, sans-serif" }}
          >
            Bientôt disponible
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            La rubrique <span className="font-medium text-foreground">{title}</span> est
            réservée dans la navigation. Son contenu métier sera implémenté
            progressivement dans les prochaines étapes.
          </p>
          {!meta && pageId && (
            <p className="text-xs text-muted-foreground mt-3 font-mono">
              Identifiant : {pageId}
            </p>
          )}
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <ArrowLeft size={14} />
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
