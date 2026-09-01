import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Pencil, Trash2, Plus, Users, UsersRound, Filter, Link2, ShieldCheck, Clock3, Bell, BellRing, X,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FormModal } from "@/components/admin/FormModal";
import { DataTable, Column } from "@/components/admin/DataTable";
import { cn } from "@/lib/utils";
import { FILIERES, NIVEAUX } from "@/data/mockData";
import { useStudentStore, useAnneesAcademiques } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { getUserAccounts } from "@/data/studentStore";

import { useGroupesExternes, useGroupesInternes, useGroupesPersonnalises } from "@/hooks/useCommunicationGroupsStore";
import {
  upsertGroupeExterne, deleteGroupeExterne, type GroupeExterneRecord, type ContactExterne,
  genererGroupesInternes, supprimerGroupesInternes, resolveMembresGroupeInterne, type GroupeInterneRecord,
  upsertGroupePersonnalise, deleteGroupePersonnalise, resolveMembresGroupePersonnalise,
  type GroupePersonnaliseRecord, type RegleGroupePersonnalise, type ChampRegleGroupe, type OperateurRegleGroupe,
} from "@/data/communicationGroupsStore";

import { useCommunicationRoles } from "@/hooks/useCommunicationRolesStore";
import {
  getCommunicationRolesParType, ajouterCommunicationRole, supprimerCommunicationRole, type RoleCommunication,
} from "@/data/communicationRolesStore";

import { useCommunicationApiUrl } from "@/hooks/useCommunicationApiConfigStore";
import { setCommunicationApiUrl } from "@/data/communicationApiConfigStore";

import { useNotificationsEvenementielles } from "@/hooks/useNotificationEvenementielleStore";
import { upsertNotificationEvenementielle, type NotificationEvenementielleRecord } from "@/data/notificationEvenementielleStore";

const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

const TABS = [
  { id: "externes", label: "Groupes externes", icon: Users },
  { id: "internes", label: "Groupes internes", icon: UsersRound },
  { id: "personnalises", label: "Groupes personnalisés", icon: Filter },
  { id: "api", label: "URL API COM", icon: Link2 },
  { id: "validateur-messages", label: "Validateur Messages", icon: ShieldCheck },
  { id: "validateur-rallonge", label: "Validateur demande rallonge", icon: Clock3 },
  { id: "destinataires-alert", label: "Destinataires alert", icon: BellRing },
  { id: "notifications", label: "Notifications événementielles", icon: Bell },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Toggle({ value, onChange, disabled }: { value: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!value)}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors",
        value ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
        !disabled && "cursor-pointer hover:opacity-80",
      )}
    >
      {value ? "Oui" : "Non"}
    </button>
  );
}

export default function ParametrageCommunicationPage() {
  const [tab, setTab] = useState<TabId>("externes");

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Communication" }, { label: "Paramétrage de la communication" }]}
        title="Paramétrage de la communication"
        subtitle="Groupes de diffusion, validateurs, alertes et notifications événementielles — réellement connectés au reste de l'application"
      />

      <div className="flex flex-wrap gap-2 mb-6 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              tab === t.id ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-muted",
            )}
            data-testid={`param-com-tab-${t.id}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "externes" && <GroupesExternesTab />}
      {tab === "internes" && <GroupesInternesTab />}
      {tab === "personnalises" && <GroupesPersonnalisesTab />}
      {tab === "api" && <UrlApiComTab />}
      {tab === "validateur-messages" && <RoleCommunicationTab role="validateur_message" titre="Les validateurs de messages" colonneLabel="Remarques" testIdPrefix="validateur-msg" />}
      {tab === "validateur-rallonge" && <RoleCommunicationTab role="validateur_rallonge" titre="Les validateurs de demande de rallonge" colonneLabel="Remarques" testIdPrefix="validateur-rallonge" />}
      {tab === "destinataires-alert" && <RoleCommunicationTab role="destinataire_alert" titre="Les destinataires alert" colonneLabel="Action" testIdPrefix="destinataire-alert" avecAction />}
      {tab === "notifications" && <NotificationsEvenementiellesTab />}
    </div>
  );
}

// ===================== Groupes externes =====================

const EMPTY_CONTACT: ContactExterne = { intitule: "", telephone: "", email: "" };

function GroupesExternesTab() {
  const groupes = useGroupesExternes();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GroupeExterneRecord | null>(null);
  const [nom, setNom] = useState("");
  const [code, setCode] = useState("");
  const [contacts, setContacts] = useState<ContactExterne[]>([{ ...EMPTY_CONTACT }]);

  const openNew = () => { setEditing(null); setNom(""); setCode(""); setContacts([{ ...EMPTY_CONTACT }]); setModalOpen(true); };
  const openEdit = (g: GroupeExterneRecord) => { setEditing(g); setNom(g.nom); setCode(g.code); setContacts(g.contacts.length ? g.contacts : [{ ...EMPTY_CONTACT }]); setModalOpen(true); };

  const handleSave = () => {
    if (!nom.trim() || !code.trim()) { toast.error("Nom et code sont requis"); return; }
    const contactsValides = contacts.filter((c) => c.intitule.trim() && c.telephone.trim() && c.email.trim());
    upsertGroupeExterne({ nom: nom.trim(), code: code.trim(), contacts: contactsValides }, editing?.id);
    toast.success(`Groupe externe enregistré — ${nom}`);
    setModalOpen(false);
  };

  const handleDelete = (g: GroupeExterneRecord) => {
    if (!confirm(`Supprimer le groupe externe "${g.nom}" ?`)) return;
    deleteGroupeExterne(g.id);
    toast.success("Groupe supprimé");
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "nom", header: "Nom", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.nom as string}</span> },
    { key: "code", header: "Code", render: (r) => <span className="text-xs font-mono text-muted-foreground">{r.code as string}</span> },
    { key: "contacts", header: "# Contacts", render: (r) => <span>{(r.contacts as ContactExterne[]).length}</span> },
    {
      key: "actions", header: "",
      render: (row) => {
        const g = row as unknown as GroupeExterneRecord;
        return (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); openEdit(g); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" data-testid={`groupe-externe-editer-${g.id}`}><Pencil size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(g); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors" data-testid={`groupe-externe-supprimer-${g.id}`}><Trash2 size={14} /></button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="groupe-externe-nouveau">
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <DataTable columns={columns} data={groupes as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher un groupe..." />

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le groupe externe" : "Nouveau groupe externe"} size="lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom *</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} className={inputClass} data-testid="groupe-externe-nom" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} data-testid="groupe-externe-code" />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Contacts</p>
            <div className="space-y-2">
              {contacts.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <input value={c.intitule} onChange={(e) => setContacts((prev) => prev.map((p, j) => j === i ? { ...p, intitule: e.target.value } : p))} placeholder="Intitulé" className={inputClass} data-testid={`groupe-externe-contact-intitule-${i}`} />
                  <input value={c.telephone} onChange={(e) => setContacts((prev) => prev.map((p, j) => j === i ? { ...p, telephone: e.target.value } : p))} placeholder="Téléphone" className={inputClass} data-testid={`groupe-externe-contact-telephone-${i}`} />
                  <input value={c.email} onChange={(e) => setContacts((prev) => prev.map((p, j) => j === i ? { ...p, email: e.target.value } : p))} placeholder="Email" className={inputClass} data-testid={`groupe-externe-contact-email-${i}`} />
                  <button onClick={() => setContacts((prev) => prev.filter((_, j) => j !== i))} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"><X size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setContacts((prev) => [...prev, { ...EMPTY_CONTACT }])} className="mt-2 text-xs font-medium text-primary hover:underline" data-testid="groupe-externe-nouvelle-ligne">
              + Nouvelle ligne
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="groupe-externe-sauvegarder">Sauvegarder</button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

// ===================== Groupes internes (générés en live) =====================

function GroupesInternesTab() {
  const groupes = useGroupesInternes();
  const etudiants = useStudentStore();
  const annees = useAnneesAcademiques();
  const [annee, setAnnee] = useState("");
  const [programmes, setProgrammes] = useState(false);
  const [niveaux, setNiveaux] = useState(false);
  const [classes, setClasses] = useState(false);

  const handleCreer = () => {
    if (!annee) { toast.error("Sélectionnez une année académique"); return; }
    if (!programmes && !niveaux && !classes) { toast.error("Cochez au moins un niveau de granularité"); return; }
    const nb = genererGroupesInternes(annee, { programmes, niveaux, classes });
    toast.success(nb > 0 ? `${nb} groupe(s) interne(s) créé(s)` : "Aucun nouveau groupe — déjà à jour pour cette année");
  };

  const handleSupprimer = () => {
    if (!annee) { toast.error("Sélectionnez une année académique"); return; }
    if (!confirm(`Supprimer tous les groupes internes de ${annee} ?`)) return;
    const nb = supprimerGroupesInternes(annee);
    toast.success(`${nb} groupe(s) supprimé(s)`);
  };

  const groupesAnnee = useMemo(() => groupes.filter((g) => !annee || g.annee === annee), [groupes, annee]);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-4">Génération Groupes Internes</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-52">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Année académique *</label>
            <select value={annee} onChange={(e) => setAnnee(e.target.value)} className={inputClass} data-testid="groupe-interne-annee">
              <option value="">Sélectionner</option>
              {annees.map((a) => <option key={a.id} value={a.libelle}>{a.libelle}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={programmes} onChange={(e) => setProgrammes(e.target.checked)} className="rounded" data-testid="groupe-interne-programmes" /> Programmes
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={niveaux} onChange={(e) => setNiveaux(e.target.checked)} className="rounded" data-testid="groupe-interne-niveaux" /> Niveaux
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={classes} onChange={(e) => setClasses(e.target.checked)} className="rounded" data-testid="groupe-interne-classes" /> Classes
          </label>
          <div className="flex-1" />
          <button onClick={handleCreer} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="groupe-interne-creer">Créer les groupes</button>
          <button onClick={handleSupprimer} className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors" data-testid="groupe-interne-supprimer">Supprimer les groupes</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Groupes existants{annee ? ` — ${annee}` : ""}</p>
        </div>
        {groupesAnnee.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucun groupe interne{annee ? ` pour ${annee}` : ""}.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">Nom</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-3">Membres réels</th>
              </tr>
            </thead>
            <tbody>
              {groupesAnnee.map((g: GroupeInterneRecord, i) => {
                const membres = resolveMembresGroupeInterne(g, etudiants);
                return (
                  <tr key={g.id} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")} data-testid={`groupe-interne-ligne-${g.id}`}>
                    <td className="px-5 py-3 font-semibold text-foreground">{g.nom}</td>
                    <td className="px-3 py-3 text-xs text-muted-foreground capitalize">{g.type}</td>
                    <td className="px-3 py-3 text-xs font-medium text-foreground">{membres.length} étudiant(s)</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ===================== Groupes personnalisés (constructeur de règles) =====================

const CHAMP_LABELS: Record<ChampRegleGroupe, string> = {
  filiereId: "Filière", niveau: "Niveau", classeId: "Classe", statut: "Statut", soldeDu: "Solde dû",
};
const OPERATEUR_LABELS: Record<OperateurRegleGroupe, string> = {
  egal: "égal à", different: "différent de", superieurA: "supérieur à", inferieurA: "inférieur à",
};
const STATUT_OPTIONS = ["inscrit", "preinscrit", "suspendu", "abandon"];

function RegleValeurInput({ regle, onChange, classes }: { regle: RegleGroupePersonnalise; onChange: (v: string) => void; classes: ReturnType<typeof useClasses> }) {
  if (regle.champ === "filiereId") {
    return (
      <select value={regle.valeur} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Sélectionner</option>
        {FILIERES.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
      </select>
    );
  }
  if (regle.champ === "classeId") {
    return (
      <select value={regle.valeur} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Sélectionner</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </select>
    );
  }
  if (regle.champ === "niveau") {
    const aliases = Array.from(new Set(NIVEAUX.map((n) => n.alias)));
    return (
      <select value={regle.valeur} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Sélectionner</option>
        {aliases.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    );
  }
  if (regle.champ === "statut") {
    return (
      <select value={regle.valeur} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value="">Sélectionner</option>
        {STATUT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }
  return <input type="number" value={regle.valeur} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder="Montant (FCFA)" />;
}

const EMPTY_REGLE: RegleGroupePersonnalise = { champ: "filiereId", operateur: "egal", valeur: "" };

function GroupesPersonnalisesTab() {
  const groupes = useGroupesPersonnalises();
  const etudiants = useStudentStore();
  const classes = useClasses();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GroupePersonnaliseRecord | null>(null);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [regles, setRegles] = useState<RegleGroupePersonnalise[]>([{ ...EMPTY_REGLE }]);

  const openNew = () => { setEditing(null); setNom(""); setDescription(""); setRegles([{ ...EMPTY_REGLE }]); setModalOpen(true); };
  const openEdit = (g: GroupePersonnaliseRecord) => { setEditing(g); setNom(g.nom); setDescription(g.description); setRegles(g.regles.length ? g.regles : [{ ...EMPTY_REGLE }]); setModalOpen(true); };

  const regleValides = regles.filter((r) => r.valeur.trim() !== "");
  const apercu = useMemo(() => resolveMembresGroupePersonnalise(regleValides, etudiants), [regleValides, etudiants]);

  const handleSave = () => {
    if (!nom.trim() || !description.trim()) { toast.error("Nom et description sont requis"); return; }
    if (regleValides.length === 0) { toast.error("Au moins une règle est requise"); return; }
    upsertGroupePersonnalise({ nom: nom.trim(), description: description.trim(), regles: regleValides }, editing?.id);
    toast.success(`Groupe personnalisé enregistré — ${nom}`);
    setModalOpen(false);
  };

  const handleDelete = (g: GroupePersonnaliseRecord) => {
    if (!confirm(`Supprimer le groupe personnalisé "${g.nom}" ?`)) return;
    deleteGroupePersonnalise(g.id);
    toast.success("Groupe supprimé");
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "nom", header: "Nom", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.nom as string}</span> },
    { key: "description", header: "Description", render: (r) => <span className="text-sm text-muted-foreground">{r.description as string}</span> },
    {
      key: "membres", header: "# Membres",
      render: (r) => <span className="font-medium text-foreground">{resolveMembresGroupePersonnalise((r.regles as RegleGroupePersonnalise[]), etudiants).length}</span>,
    },
    {
      key: "actions", header: "",
      render: (row) => {
        const g = row as unknown as GroupePersonnaliseRecord;
        return (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); openEdit(g); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" data-testid={`groupe-perso-editer-${g.id}`}><Pencil size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(g); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors" data-testid={`groupe-perso-supprimer-${g.id}`}><Trash2 size={14} /></button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Ciblage par règles réelles (Filière/Niveau/Classe/Statut/Solde dû, combinées en ET) — calculé sur les vrais étudiants à chaque consultation.
      </p>
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="groupe-perso-nouveau">
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <DataTable columns={columns} data={groupes as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher un groupe..." />

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier le groupe personnalisé" : "Création groupe personnalisé"} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom *</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className={inputClass} data-testid="groupe-perso-nom" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={cn(inputClass, "min-h-[70px]")} data-testid="groupe-perso-description" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Règles (toutes doivent être vraies)</p>
            <div className="space-y-2">
              {regles.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <select value={r.champ} onChange={(e) => setRegles((prev) => prev.map((p, j) => j === i ? { champ: e.target.value as ChampRegleGroupe, operateur: p.operateur, valeur: "" } : p))} className={inputClass} data-testid={`groupe-perso-regle-champ-${i}`}>
                    {(Object.keys(CHAMP_LABELS) as ChampRegleGroupe[]).map((c) => <option key={c} value={c}>{CHAMP_LABELS[c]}</option>)}
                  </select>
                  <select value={r.operateur} onChange={(e) => setRegles((prev) => prev.map((p, j) => j === i ? { ...p, operateur: e.target.value as OperateurRegleGroupe } : p))} className={inputClass} data-testid={`groupe-perso-regle-operateur-${i}`}>
                    {(r.champ === "soldeDu" ? (["egal", "different", "superieurA", "inferieurA"] as OperateurRegleGroupe[]) : (["egal", "different"] as OperateurRegleGroupe[])).map((op) => (
                      <option key={op} value={op}>{OPERATEUR_LABELS[op]}</option>
                    ))}
                  </select>
                  <div data-testid={`groupe-perso-regle-valeur-${i}`}>
                    <RegleValeurInput regle={r} onChange={(v) => setRegles((prev) => prev.map((p, j) => j === i ? { ...p, valeur: v } : p))} classes={classes} />
                  </div>
                  <button onClick={() => setRegles((prev) => prev.filter((_, j) => j !== i))} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600"><X size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setRegles((prev) => [...prev, { ...EMPTY_REGLE }])} className="mt-2 text-xs font-medium text-primary hover:underline" data-testid="groupe-perso-nouvelle-regle">
              + Ajouter une règle
            </button>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm" data-testid="groupe-perso-apercu">
            <span className="font-semibold text-foreground">{apercu.length}</span> étudiant(s) correspondent à ces règles actuellement.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="groupe-perso-sauvegarder">Sauvegarder</button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

// ===================== URL API COM =====================

function UrlApiComTab() {
  const url = useCommunicationApiUrl();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(url);

  const handleSave = () => {
    setCommunicationApiUrl(value.trim());
    toast.success("URL mise à jour");
    setEditing(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">URL API COM</p>
        {!editing && (
          <button onClick={() => { setValue(url); setEditing(true); }} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors" data-testid="api-com-modifier">
            <Pencil size={14} /> Mettre à jour
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">URL</label>
            <input value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} data-testid="api-com-url-input" />
          </div>
          <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="api-com-sauvegarder">Sauvegarder</button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-foreground">URL</span>
          <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline" data-testid="api-com-url-affichee">{url}</a>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-4">
        Point d'intégration externe (passerelle SMS/email) — aucun envoi réel n'est déclenché par cette application, cette URL est conservée pour une future intégration.
      </p>
    </div>
  );
}

// ===================== Validateurs / Destinataires (rôles unifiés) =====================

function RoleCommunicationTab({ role, titre, colonneLabel, testIdPrefix, avecAction }: { role: RoleCommunication; titre: string; colonneLabel: string; testIdPrefix: string; avecAction?: boolean }) {
  useCommunicationRoles();
  const roles = getCommunicationRolesParType(role);
  const comptes = useMemo(() => getUserAccounts().filter((u) => u.role === "admin" || u.role === "teacher"), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [remarque, setRemarque] = useState("");

  const openNew = () => { setUserId(""); setRemarque(""); setModalOpen(true); };

  const handleSave = () => {
    const compte = comptes.find((c) => c.id === userId);
    if (!compte) { toast.error(avecAction ? "Sélectionnez un destinataire" : "Sélectionnez un validateur"); return; }
    ajouterCommunicationRole({
      role,
      userId: compte.id,
      userLabel: `${compte.identifier} - ${compte.displayName}${compte.role === "admin" ? " - ADM" : " - ENS"}`,
      remarque: avecAction ? undefined : (remarque.trim() || undefined),
      action: avecAction ? (remarque.trim() || undefined) : undefined,
    });
    toast.success("Ajouté");
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Retirer cette désignation ?")) return;
    supprimerCommunicationRole(id);
    toast.success("Retiré");
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "userLabel", header: avecAction ? "Destinataire" : "Validateur", sortable: true, render: (r) => <span className="font-medium text-foreground">{r.userLabel as string}</span> },
    { key: avecAction ? "action" : "remarque", header: colonneLabel, render: (r) => <span className="text-sm text-muted-foreground">{(avecAction ? r.action : r.remarque) as string ?? "—"}</span> },
    {
      key: "actions", header: "",
      render: (row) => (
        <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id as string); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-600 transition-colors" data-testid={`${testIdPrefix}-supprimer-${row.id}`}>
          <Trash2 size={14} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-foreground flex items-center gap-2"><ShieldCheck size={16} className="text-primary" /> {titre}</p>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid={`${testIdPrefix}-ajouter`}>
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <DataTable columns={columns} data={roles as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher..." />

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={avecAction ? "Nouveau destinataire alert" : "Nouveau validateur"}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{avecAction ? "Destinataire" : "Validateur"} *</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass} data-testid={`${testIdPrefix}-compte`}>
              <option value="">Sélectionner</option>
              {comptes.map((c) => <option key={c.id} value={c.id}>{c.identifier} - {c.displayName} - {c.role === "admin" ? "ADM" : "ENS"}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">{avecAction ? "Action" : "Remarques"}</label>
            <textarea value={remarque} onChange={(e) => setRemarque(e.target.value)} className={cn(inputClass, "min-h-[70px]")} data-testid={`${testIdPrefix}-remarque`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid={`${testIdPrefix}-sauvegarder`}>Sauvegarder</button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}

// ===================== Notifications événementielles =====================

const EMPTY_NOTIF: Omit<NotificationEvenementielleRecord, "id" | "brancheReellement"> = {
  code: "", description: "", actif: false, envoyerEtudiant: false, envoyerProfesseur: false, envoyerParent: false, envoyerTuteur: false,
};

function NotificationsEvenementiellesTab() {
  const notifications = useNotificationsEvenementielles();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationEvenementielleRecord | null>(null);
  const [form, setForm] = useState(EMPTY_NOTIF);

  const openNew = () => { setEditing(null); setForm(EMPTY_NOTIF); setModalOpen(true); };
  const openEdit = (n: NotificationEvenementielleRecord) => { setEditing(n); setForm(n); setModalOpen(true); };

  const handleSave = () => {
    if (!form.code.trim() || !form.description.trim()) { toast.error("Code et description sont requis"); return; }
    upsertNotificationEvenementielle(form, editing?.id);
    toast.success("Notification enregistrée");
    setModalOpen(false);
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "code", header: "Code", sortable: true, render: (r) => <span className="font-mono text-xs font-semibold text-foreground">{r.code as string}</span> },
    { key: "description", header: "Description", render: (r) => <span className="text-sm text-muted-foreground">{r.description as string}</span> },
    {
      key: "actif", header: "Activé ?",
      render: (row) => {
        const n = row as unknown as NotificationEvenementielleRecord;
        return <Toggle value={n.actif} onChange={(v) => upsertNotificationEvenementielle({ ...n, actif: v }, n.id)} />;
      },
    },
    {
      key: "actions", header: "",
      render: (row) => {
        const n = row as unknown as NotificationEvenementielleRecord;
        return (
          <button onClick={(e) => { e.stopPropagation(); openEdit(n); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors" data-testid={`notif-evt-editer-${n.id}`}>
            <Pencil size={14} />
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="notif-evt-ajouter">
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <DataTable columns={columns} data={notifications as unknown as Record<string, unknown>[]} searchable searchPlaceholder="Rechercher un code..." />

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier la notification" : "Nouvelle notification"}>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} className={cn(inputClass, "font-mono")} disabled={!!editing?.brancheReellement} data-testid="notif-evt-code" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Activé ?</label>
              <Toggle value={form.actif} onChange={(v) => setForm((f) => ({ ...f, actif: v }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={cn(inputClass, "min-h-[60px]")} data-testid="notif-evt-description" />
          </div>
          {editing?.brancheReellement === false && editing && (
            <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 rounded-lg px-3 py-2">
              Ce code n'est pas encore branché sur un événement réel de l'application — l'activer ne déclenchera aucune notification pour l'instant.
            </p>
          )}
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Destinataires</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">Envoyer à l'étudiant ?</span>
                <Toggle value={form.envoyerEtudiant} onChange={(v) => setForm((f) => ({ ...f, envoyerEtudiant: v }))} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">Envoyer au professeur ?</span>
                <Toggle value={form.envoyerProfesseur} onChange={(v) => setForm((f) => ({ ...f, envoyerProfesseur: v }))} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">Envoyer au parent ?</span>
                <Toggle value={form.envoyerParent} onChange={(v) => setForm((f) => ({ ...f, envoyerParent: v }))} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">Envoyer au tuteur ?</span>
                <Toggle value={form.envoyerTuteur} onChange={(v) => setForm((f) => ({ ...f, envoyerTuteur: v }))} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Aucun compte parent/tuteur n'existe encore dans EduManage — ces bascules restent sans effet tant qu'un tel rôle n'a pas été introduit.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Fermer</button>
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="notif-evt-sauvegarder">Sauvegarder</button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
