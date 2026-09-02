import { useState } from "react";
import { Link } from "wouter";
import { Save, Building2, ShieldOff, PenTool, Shield, Plug, Users, BookOpen, Image as ImageIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { useEtablissement } from "@/hooks/useEtablissementStore";
import { updateEtablissement, type EtablissementInfo } from "@/data/etablissementStore";
import { useMotifsBlocage } from "@/hooks/useMotifBlocageStore";
import { upsertMotifBlocage, deleteMotifBlocage, ACTIONS_INTERDITES, type MotifBlocageRecord } from "@/data/motifBlocageStore";
import { useSignatureConfigs } from "@/hooks/useSignatureConfigStore";
import { setSignatureConfig, SIGNATURE_DOC_LABELS, type SignatureDocType, type SignatureConfig } from "@/data/signatureConfigStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const TAILLE_MAX_IMAGE_OCTETS = 400 * 1024;

const TABS = [
  { key: "universite", label: "Université", icon: Building2 },
  { key: "motifs", label: "Motifs de blocage", icon: ShieldOff },
  { key: "signature", label: "Signature électronique", icon: PenTool },
  { key: "academique", label: "Académique", icon: BookOpen, href: "/admin/annees" },
  { key: "securite", label: "Sécurité", icon: Shield, href: "/admin/security/portails" },
  { key: "integrations", label: "Intégrations", icon: Plug },
  { key: "utilisateurs", label: "Utilisateurs", icon: Users, href: "/admin/users" },
];

const EMPTY_MOTIF = { code: "", intitule: "", actionsInterdites: [] as string[] };

function readImageAsDataUrl(file: File, onDone: (dataUrl: string) => void) {
  if (file.size > TAILLE_MAX_IMAGE_OCTETS) {
    toast.error(`Image trop lourde (max ${Math.round(TAILLE_MAX_IMAGE_OCTETS / 1024)} Ko).`);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onDone(String(reader.result));
  reader.readAsDataURL(file);
}

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("universite");

  const etablissement = useEtablissement();
  const [etabForm, setEtabForm] = useState<EtablissementInfo>(etablissement);

  const motifs = useMotifsBlocage();
  const [motifModalOpen, setMotifModalOpen] = useState(false);
  const [motifEditId, setMotifEditId] = useState<string | null>(null);
  const [motifForm, setMotifForm] = useState(EMPTY_MOTIF);
  const [motifError, setMotifError] = useState("");

  const signatures = useSignatureConfigs();
  const [sigForms, setSigForms] = useState<Record<SignatureDocType, SignatureConfig>>(signatures);

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  const handleSaveEtablissement = () => {
    if (!currentUser || !etabForm.nom.trim()) return;
    updateEtablissement({ ...etabForm, nom: etabForm.nom.trim() }, currentUser.id);
    toast.success("Informations de l'établissement enregistrées.");
  };

  const openMotifCreate = () => {
    setMotifEditId(null);
    setMotifForm(EMPTY_MOTIF);
    setMotifError("");
    setMotifModalOpen(true);
  };

  const openMotifEdit = (motif: MotifBlocageRecord) => {
    setMotifEditId(motif.id);
    setMotifForm({ code: motif.code, intitule: motif.intitule, actionsInterdites: motif.actionsInterdites });
    setMotifError("");
    setMotifModalOpen(true);
  };

  const toggleAction = (actionId: string) => {
    setMotifForm((f) => ({
      ...f,
      actionsInterdites: f.actionsInterdites.includes(actionId)
        ? f.actionsInterdites.filter((a) => a !== actionId)
        : [...f.actionsInterdites, actionId],
    }));
  };

  const handleSaveMotif = () => {
    if (!currentUser || !motifForm.code.trim() || !motifForm.intitule.trim()) return;
    try {
      upsertMotifBlocage(motifForm, currentUser.id, motifEditId ?? undefined);
      toast.success(motifEditId ? "Motif mis à jour." : "Motif créé.");
      setMotifModalOpen(false);
    } catch (err) {
      setMotifError(err instanceof Error ? err.message : "Enregistrement impossible");
    }
  };

  const handleDeleteMotif = (id: string) => {
    try {
      deleteMotifBlocage(id);
      toast.success("Motif supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible");
    }
  };

  const handleSaveSignature = (docType: SignatureDocType) => {
    if (!currentUser) return;
    setSignatureConfig(docType, sigForms[docType], currentUser.id);
    toast.success(`Signature "${SIGNATURE_DOC_LABELS[docType]}" enregistrée.`);
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Paramètres" }]}
        title="Paramètres"
        subtitle="Configuration réelle de l'établissement et des documents officiels"
      />

      <div className="grid lg:grid-cols-4 gap-6">
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

        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>

            {activeTab === "universite" && (
              <div className="space-y-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Informations de l'établissement</h3>
                <p className="text-xs text-muted-foreground -mt-3">Réellement utilisées sur les documents officiels générés (attestations, bulletins, contrats...).</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom de l'établissement *</label>
                    <input value={etabForm.nom} onChange={(e) => { setEtabForm((f) => ({ ...f, nom: e.target.value })); }} placeholder="Institut Supérieur EduManage" className={inputClass} data-testid="etab-nom" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Adresse</label>
                    <input value={etabForm.adresse} onChange={(e) => { setEtabForm((f) => ({ ...f, adresse: e.target.value })); }} placeholder="Dakar, Sénégal" className={inputClass} data-testid="etab-adresse" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone</label>
                    <input value={etabForm.telephone} onChange={(e) => { setEtabForm((f) => ({ ...f, telephone: e.target.value })); }} placeholder="+221 33 XXX XX XX" className={inputClass} data-testid="etab-telephone" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email officiel</label>
                    <input value={etabForm.email} onChange={(e) => { setEtabForm((f) => ({ ...f, email: e.target.value })); }} placeholder="contact@etablissement.sn" className={inputClass} data-testid="etab-email" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Site web</label>
                    <input value={etabForm.siteWeb} onChange={(e) => { setEtabForm((f) => ({ ...f, siteWeb: e.target.value })); }} placeholder="https://www.etablissement.sn" className={inputClass} data-testid="etab-siteweb" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">N° d'agrément</label>
                    <input value={etabForm.agrement} onChange={(e) => { setEtabForm((f) => ({ ...f, agrement: e.target.value })); }} placeholder="Agrément Ministère de l'Enseignement Supérieur n°..." className={inputClass} data-testid="etab-agrement" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Logo de l'établissement</label>
                    <div className="flex items-center gap-4">
                      {etabForm.logoDataUrl && <img src={etabForm.logoDataUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-border" data-testid="etab-logo-apercu" />}
                      <label className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors cursor-pointer flex-1">
                        <ImageIcon size={24} className="mx-auto text-muted-foreground mb-1.5" />
                        <p className="text-sm text-muted-foreground">Glisser le logo ici ou <span className="text-primary font-medium">parcourir</span></p>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPG (max {Math.round(TAILLE_MAX_IMAGE_OCTETS / 1024)} Ko)</p>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readImageAsDataUrl(f, (url) => { setEtabForm((prev) => ({ ...prev, logoDataUrl: url })); }); }} data-testid="etab-logo-input" />
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-border">
                  <button onClick={handleSaveEtablissement} disabled={!etabForm.nom.trim()} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors" data-testid="etab-sauvegarder">
                    <Save size={15} /> Enregistrer
                  </button>
                </div>
              </div>
            )}

            {activeTab === "motifs" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Motifs de blocage étudiant</h3>
                    <p className="text-xs text-muted-foreground mt-1">Restreint des actions précises (accès portail, impression de documents) pour un étudiant, sans désactiver son dossier.</p>
                  </div>
                  <button onClick={openMotifCreate} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors flex-shrink-0" data-testid="motif-ajouter">
                    <Plus size={13} /> Ajouter
                  </button>
                </div>
                {motifs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Aucun motif défini.</p>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                    {motifs.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-4 py-3" data-testid={`motif-ligne-${m.id}`}>
                        <div>
                          <div className="text-sm font-medium text-foreground">{m.intitule}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{m.code} · {m.actionsInterdites.length} action(s) interdite(s)</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openMotifEdit(m)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" data-testid={`motif-editer-${m.id}`}><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteMotif(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" data-testid={`motif-supprimer-${m.id}`}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "signature" && (
              <div className="space-y-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Signature électronique</h3>
                <p className="text-xs text-muted-foreground -mt-3">Par type de document réellement généré par l'appli — active un bloc signature (image + nom) sur le document imprimé.</p>
                {(Object.keys(SIGNATURE_DOC_LABELS) as SignatureDocType[]).map((docType) => {
                  const cfg = sigForms[docType];
                  return (
                    <div key={docType} className="border border-border rounded-xl p-4" data-testid={`signature-card-${docType}`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-sm text-foreground">{SIGNATURE_DOC_LABELS[docType]}</span>
                        <button
                          onClick={() => setSigForms((f) => ({ ...f, [docType]: { ...f[docType], actif: !f[docType].actif } }))}
                          className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", cfg.actif ? "bg-primary" : "bg-muted")}
                          data-testid={`signature-toggle-${docType}`}
                        >
                          <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm", cfg.actif ? "translate-x-6" : "translate-x-1")} />
                        </button>
                      </div>
                      {cfg.actif && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom du signataire</label>
                            <input value={cfg.signataireNom} onChange={(e) => setSigForms((f) => ({ ...f, [docType]: { ...f[docType], signataireNom: e.target.value } }))} className={inputClass} data-testid={`signature-nom-${docType}`} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Qualité</label>
                            <input value={cfg.signataireQualite} onChange={(e) => setSigForms((f) => ({ ...f, [docType]: { ...f[docType], signataireQualite: e.target.value } }))} placeholder="Le Directeur" className={inputClass} data-testid={`signature-qualite-${docType}`} />
                          </div>
                          <div className="col-span-2 flex items-center gap-3">
                            {cfg.imageDataUrl && <img src={cfg.imageDataUrl} alt="Signature" className="h-12 border border-border rounded-lg bg-white px-2" />}
                            <label className="text-xs text-primary cursor-pointer hover:underline inline-flex items-center gap-1.5">
                              <ImageIcon size={12} /> {cfg.imageDataUrl ? "Changer l'image" : "Choisir une image"}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readImageAsDataUrl(f, (url) => setSigForms((prev) => ({ ...prev, [docType]: { ...prev[docType], imageDataUrl: url } }))); }} data-testid={`signature-image-input-${docType}`} />
                            </label>
                          </div>
                        </div>
                      )}
                      <button onClick={() => handleSaveSignature(docType)} className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors" data-testid={`signature-sauvegarder-${docType}`}>
                        <Save size={12} /> Enregistrer
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-5">
                <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Intégrations API</h3>
                <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2.5">
                  En attente du backend — aucune passerelle de paiement réelle n'est branchée pour l'instant. Ces champs seront activés lorsque le backend sera disponible.
                </p>
                <div className="space-y-4 opacity-50 pointer-events-none">
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
                        <input type="password" placeholder={api.placeholder} disabled className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <FormModal open={motifModalOpen} onClose={() => setMotifModalOpen(false)} title={motifEditId ? "Éditer le motif" : "Nouveau motif de blocage"} size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label>
            <input value={motifForm.code} onChange={(e) => setMotifForm((f) => ({ ...f, code: e.target.value }))} placeholder="ex: 0001" className={inputClass} data-testid="motif-code" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Intitulé *</label>
            <input value={motifForm.intitule} onChange={(e) => setMotifForm((f) => ({ ...f, intitule: e.target.value }))} placeholder="ex: Frais mensuels impayés" className={inputClass} data-testid="motif-intitule" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Actions à interdire</label>
            <div className="border border-border rounded-xl divide-y divide-border">
              {ACTIONS_INTERDITES.map((a) => (
                <label key={a.id} className="flex items-center gap-2.5 px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/40" data-testid={`motif-action-${a.id}`}>
                  <input type="checkbox" checked={motifForm.actionsInterdites.includes(a.id)} onChange={() => toggleAction(a.id)} className="rounded border-border" />
                  {a.label}
                </label>
              ))}
            </div>
          </div>
          {motifError && <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg px-3 py-2">{motifError}</p>}
          <button
            onClick={handleSaveMotif}
            disabled={!motifForm.code.trim() || !motifForm.intitule.trim()}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="motif-sauvegarder"
          >
            Sauvegarder
          </button>
        </div>
      </FormModal>
    </div>
  );
}
