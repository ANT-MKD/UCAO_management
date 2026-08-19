import { useState } from "react";
import { Save, Building2, BookOpen, Bell, Shield, Plug, Users } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "universite", label: "Université", icon: Building2 },
  { key: "academique", label: "Académique", icon: BookOpen },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "securite", label: "Sécurité", icon: Shield },
  { key: "integrations", label: "Intégrations", icon: Plug },
  { key: "utilisateurs", label: "Utilisateurs", icon: Users, href: "/admin/users" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", checked ? "bg-primary" : "bg-muted")}
      data-testid="toggle"
    >
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("universite");
  const [saisieNotes, setSaisieNotes] = useState(true);
  const [smsRappels, setSmsRappels] = useState(true);
  const [twoFA, setTwoFA] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Paramètres" }]}
        title="Paramètres"
        subtitle="Configuration globale de votre établissement"
      />

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            {TABS.map((tab) => (
              tab.href ? (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className="flex items-center gap-3 w-full px-4 py-3.5 text-sm font-medium text-left transition-colors border-b border-border last:border-0 text-foreground hover:bg-muted"
                >
                  <tab.icon size={16} className="text-muted-foreground" />
                  {tab.label}
                </Link>
              ) : (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3.5 text-sm font-medium text-left transition-colors border-b border-border last:border-0",
                  activeTab === tab.key ? "bg-primary/5 text-primary border-l-2 border-l-primary" : "text-foreground hover:bg-muted"
                )}
                data-testid={`settings-tab-${tab.key}`}
              >
                <tab.icon size={16} className={activeTab === tab.key ? "text-primary" : "text-muted-foreground"} />
                {tab.label}
              </button>
              )
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            {activeTab === "universite" && (
              <div className="space-y-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Informations de l'Établissement</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Nom de l'établissement *", placeholder: "Institut Supérieur EduManage", full: true },
                    { label: "Adresse *", placeholder: "Rue 12, Liberté 6, Dakar", full: true },
                    { label: "Téléphone *", placeholder: "+221 33 XXX XX XX" },
                    { label: "Email officiel *", placeholder: "contact@etablissement.sn" },
                    { label: "Site web", placeholder: "https://www.etablissement.sn" },
                  ].map((f) => (
                    <div key={f.label} className={f.full ? "col-span-2" : ""}>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{f.label}</label>
                      <input
                        type="text"
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Logo de l'établissement</label>
                    <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <Building2 size={32} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Glisser le logo ici ou <span className="text-primary font-medium">parcourir</span></p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG (max 2MB)</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "academique" && (
              <div className="space-y-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Paramètres Académiques</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année académique courante *</label>
                    <select className="w-full max-w-xs px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option>2025-2026</option>
                      <option>2024-2025</option>
                      <option>2023-2024</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                    <div>
                      <div className="text-sm font-medium text-foreground">Saisie des notes activée</div>
                      <div className="text-xs text-muted-foreground">Permettre aux enseignants de saisir des notes</div>
                    </div>
                    <Toggle checked={saisieNotes} onChange={setSaisieNotes} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Seuil de validation (sur 20)</label>
                    <input type="number" min={0} max={20} defaultValue={10} className="w-32 px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-center font-mono" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Notifications & Rappels</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                    <div>
                      <div className="text-sm font-medium text-foreground">SMS de rappel de paiement</div>
                      <div className="text-xs text-muted-foreground">Envoyer des SMS automatiques avant chaque échéance</div>
                    </div>
                    <Toggle checked={smsRappels} onChange={setSmsRappels} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Délai de rappel (heures avant l'échéance)</label>
                    <input type="number" min={0} defaultValue={48} className="w-32 px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-center" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Template SMS de rappel</label>
                    <textarea
                      rows={4}
                      defaultValue="Bonjour {prenom}, votre échéance de {montant} FCFA est due le {date}. Payez via Wave au {numero_wave}. EduManage."
                      className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Variables : {"{prenom}"}, {"{montant}"}, {"{date}"}, {"{numero_wave}"}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "securite" && (
              <div className="space-y-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Sécurité & Accès</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Politique de mot de passe</label>
                    <select className="w-full max-w-xs px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option>Standard (min. 8 caractères)</option>
                      <option>Renforcée (min. 12 caractères, majuscule + chiffre)</option>
                      <option>Stricte (min. 16 caractères, symboles requis)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Durée de session (minutes)</label>
                    <input type="number" min={15} defaultValue={60} className="w-32 px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-center" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                    <div>
                      <div className="text-sm font-medium text-foreground">Authentification à deux facteurs (2FA)</div>
                      <div className="text-xs text-muted-foreground">Obligatoire pour tous les administrateurs</div>
                    </div>
                    <Toggle checked={twoFA} onChange={setTwoFA} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Intégrations API</h3>
                <div className="space-y-4">
                  {[
                    { name: "Wave", color: "#2563eb", placeholder: "wave_live_xxxxxxxxxxxxxxxxxxxx" },
                    { name: "Orange Money", color: "#ea580c", placeholder: "om_api_xxxxxxxxxxxxxxxxxxxx" },
                  ].map((api) => (
                    <div key={api.name} className="p-4 border border-border rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full" style={{ background: api.color }} />
                        <span className="font-medium text-foreground text-sm">{api.name}</span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Clé API</label>
                        <input
                          type="password"
                          placeholder={api.placeholder}
                          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="p-4 border border-border rounded-xl">
                    <div className="font-medium text-foreground text-sm mb-3">Webhooks</div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">URL de callback paiement</label>
                      <input
                        type="url"
                        placeholder="https://votre-serveur.com/webhook/paiement"
                        className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-border">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                data-testid="btn-save-settings"
              >
                <Save size={15} /> Enregistrer les modifications
              </button>
              {saved && <span className="text-xs text-emerald-600 font-medium">Paramètres sauvegardés</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
