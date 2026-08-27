import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, MapPin, Mail, Phone, User } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { useOrganismesPEC } from "@/hooks/useOrganismePECStore";
import { ANNEES_ACADEMIQUES } from "@/data/mockData";

const DEFAULT_ANNEE = ANNEES_ACADEMIQUES.find((a) => a.actuelle)?.libelle ?? ANNEES_ACADEMIQUES[0]?.libelle ?? "";

export default function OrganismePECDetailPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const organismes = useOrganismesPEC();
  const [annee, setAnnee] = useState(DEFAULT_ANNEE);

  const record = organismes.find((o) => o.id === id);

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les organismes de prise en charge", href: "/admin/organismes-pec" }]}
          title="Organisme introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Cet organisme n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Les organismes de prise en charge", href: "/admin/organismes-pec" },
          { label: record.intitule },
        ]}
        title="Consultation organisme de prise en charge"
        actions={
          <button
            onClick={() => setLocation("/admin/organismes-pec")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="grid lg:grid-cols-[380px_1fr] gap-5">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4 h-fit" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-primary" />
            </div>
            <h2 className="font-bold text-foreground text-base" style={{ fontFamily: "Outfit, sans-serif" }}>
              {record.intitule}
            </h2>
          </div>

          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              <span>{record.adresse}</span>
            </div>
            {record.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail size={14} className="shrink-0" />
                <span>{record.email}</span>
              </div>
            )}
            {record.telephone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={14} className="shrink-0" />
                <span>{record.telephone}</span>
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3 space-y-2.5 text-sm">
            <div className="flex items-center gap-2">
              <User size={14} className="text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Contact :</span>
              <span className="font-medium">{record.contactNom}</span>
            </div>
            {record.contactEmail && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail size={14} className="shrink-0" />
                <span>Email contact : {record.contactEmail}</span>
              </div>
            )}
            {record.contactTelephone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={14} className="shrink-0" />
                <span>Téléphone contact : {record.contactTelephone}</span>
              </div>
            )}
          </div>

          {record.remarques && (
            <div className="border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Remarques</p>
              <p className="text-sm text-muted-foreground">{record.remarques}</p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden h-fit" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wide">Étudiants pris en charge</h3>
            <select value={annee} onChange={(e) => setAnnee(e.target.value)} className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background">
              {ANNEES_ACADEMIQUES.map((a) => (
                <option key={a.id} value={a.libelle}>
                  {a.libelle}
                </option>
              ))}
            </select>
          </div>
          <div className="py-16 text-center text-sm text-muted-foreground px-6">
            Aucune prise en charge enregistrée pour {annee}.
          </div>
        </div>
      </div>
    </div>
  );
}
