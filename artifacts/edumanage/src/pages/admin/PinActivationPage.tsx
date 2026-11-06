import { useMemo, useState } from "react";
import { KeyRound, Search, X, Ban, Inbox, Users, Printer } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, type Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useCodesPin, useComptesAdmin, useDemandesAttente, type CodePinVue } from "@/hooks/useComptesAdmin";
import type { StatutPin } from "@/data/pinActivationStore";
import { DUREES_CODE, genererCodePin, genererCodesClasse, revoquerCodePin, type CodeEtudiant } from "@/data/comptesAdmin";
import { getAnneeActuelle } from "@/data/studentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { imprimerCodesClasse } from "@/lib/impressionCodes";
import { PORTAL_LABELS } from "@/data/portalAccessStore";
import { modeSupabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { UserAccountRecord } from "@/data/studentStore";
import { cn } from "@/lib/utils";

const STATUT_CONFIG: Record<StatutPin, { label: string; cls: string }> = {
  actif: { label: "Actif", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
  utilise: { label: "Utilisé", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  expire: { label: "Expiré", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
  remplace: { label: "Remplacé", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-500" },
  revoque: { label: "Révoqué", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PinActivationPage() {
  const { currentUser } = useAuth();
  const comptes = useComptesAdmin();
  const pins = useCodesPin();
  const demandesEnAttente = useDemandesAttente();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserAccountRecord | null>(null);
  const [dernierCode, setDernierCode] = useState<{ compteLabel: string; compteIdentifier: string; pin: string } | null>(null);

  const candidats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 1) return [];
    return comptes
      .filter((c) => c.displayName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.identifier.toLowerCase().includes(q))
      .slice(0, 8);
  }, [comptes, search]);

  const genererPour = async (compte: UserAccountRecord) => {
    if (!currentUser) return;
    try {
      const { code } = await genererCodePin(compte, { id: currentUser.id, name: currentUser.name });
      setDernierCode({ compteLabel: compte.displayName, compteIdentifier: compte.identifier, pin: code });
      setSelected(null);
      setSearch("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible");
    }
  };

  const handleGenerer = () => {
    if (!selected) return;
    void genererPour(selected);
  };

  const handleRevoquer = async (record: CodePinVue) => {
    if (!currentUser) return;
    try {
      await revoquerCodePin(record.id, currentUser.name);
      toast.success(`PIN de ${record.compteLabel} révoqué.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Révocation impossible");
    }
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "compteLabel",
      header: "Utilisateur",
      sortable: true,
      render: (row) => {
        const r = row as unknown as CodePinVue;
        return (
          <div>
            <span className="font-mono text-xs text-muted-foreground">{r.compteIdentifier}</span>
            <span className="text-muted-foreground"> — </span>
            <span className="font-medium text-foreground">{r.compteLabel}</span>
          </div>
        );
      },
    },
    {
      key: "pin",
      header: "Code pin",
      render: (row) => {
        const pin = (row as unknown as CodePinVue).pin;
        // Avec Supabase, la base ne garde qu'une empreinte du code : il n'est montré qu'à sa génération.
        return pin
          ? <span className="font-mono font-semibold">{pin}</span>
          : <span className="font-mono text-muted-foreground" title="Montré une seule fois, à la génération">••••••</span>;
      },
    },
    { key: "createdAt", header: "Date création", sortable: true, render: (row) => formatDateTime((row as unknown as CodePinVue).createdAt) },
    { key: "auteurLabel", header: "Créé par", render: (row) => (row as unknown as CodePinVue).auteurLabel },
    {
      key: "statut",
      header: "Statut",
      render: (row) => {
        const r = row as unknown as CodePinVue;
        const cfg = STATUT_CONFIG[r.statut];
        return <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", cfg.cls)}>{cfg.label}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => {
        const r = row as unknown as CodePinVue;
        if (r.statut !== "actif") return null;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); void handleRevoquer(r); }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-muted-foreground transition-colors dark:hover:bg-red-950/40"
            data-testid={`pin-revoquer-${r.id}`}
          >
            <Ban size={12} /> Révoquer
          </button>
        );
      },
    },
  ];

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Sécurité" }, { label: "Code pin activation" }]}
        title="Code pin activation"
        subtitle="Code à remettre en main propre, après vérification d'identité, pour activer un compte ou réinitialiser un mot de passe"
      />

      {dernierCode && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5 mb-6 flex flex-wrap items-center gap-4" data-testid="pin-dernier-code">
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-semibold text-foreground">Code à remettre à {dernierCode.compteLabel} ({dernierCode.compteIdentifier})</p>
            <p className="text-xs text-muted-foreground mt-1">
              {modeSupabase && "Montré une seule fois : notez-le avant de fermer. "}Valable 24 heures, 5 essais au maximum. La personne le saisit sur la page de connexion : « Mot de passe oublié ? » → « J&apos;ai déjà un code ».
            </p>
          </div>
          <span className="font-mono text-3xl font-bold tracking-[0.2em] text-foreground" data-testid="pin-dernier-code-valeur">{dernierCode.pin}</span>
          <button onClick={() => setDernierCode(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fermer"><X size={14} /></button>
        </div>
      )}

      {demandesEnAttente.length > 0 && (
        <div className="bg-card border border-amber-200 dark:border-amber-900 rounded-2xl p-5 mb-6" style={{ boxShadow: "var(--shadow-sm)" }} data-testid="pin-demandes-attente">
          <h3 className="font-bold text-foreground mb-1 flex items-center gap-2"><Inbox size={16} className="text-amber-600" /> Demandes « mot de passe oublié » en attente ({demandesEnAttente.length})</h3>
          <p className="text-xs text-muted-foreground mb-3">Vérifiez l&apos;identité de la personne (pièce d&apos;identité) avant de générer son code.</p>
          <div className="divide-y divide-border">
            {demandesEnAttente.map((d) => {
              const compte = comptes.find((c) => c.id === d.compteId);
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <UserAvatar name={d.compteLabel} size="xs" />
                  <div className="flex-1 min-w-[200px] text-sm">
                    <span className="font-medium">{d.compteLabel}</span>
                    <span className="font-mono text-xs text-muted-foreground"> · {d.compteIdentifier}</span>
                    <div className="text-[11px] text-muted-foreground">Demandé le {formatDateTime(d.createdAt)}</div>
                  </div>
                  <button
                    onClick={() => compte && void genererPour(compte)}
                    disabled={!compte}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-40"
                    data-testid={`pin-demande-generer-${d.compteId}`}
                  >
                    <KeyRound size={12} /> Générer le code
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 mb-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <h3 className="font-bold text-foreground mb-3">Générer un PIN</h3>
        <div className="max-w-md">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Nom, matricule ou email du compte"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Nom, matricule ou email du compte..."
              className={inputClass + " pl-9"}
              data-testid="pin-recherche-compte"
            />
          </div>
          {!selected && candidats.length > 0 && (
            <div className="mt-1.5 border border-border rounded-xl divide-y divide-border max-h-48 overflow-auto">
              {candidats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setSearch(c.displayName); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                  data-testid={`pin-compte-option-${c.id}`}
                >
                  <UserAvatar name={c.displayName} size="xs" />
                  <div>
                    <div className="font-medium">{c.displayName}</div>
                    <div className="text-[10px] text-muted-foreground">{c.email} · {PORTAL_LABELS[c.role]}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {selected && (
            <div className="flex items-center gap-2 mt-2 border border-primary/30 bg-primary/5 rounded-xl p-2.5" data-testid="pin-compte-selectionne">
              <UserAvatar name={selected.displayName} size="xs" />
              <div className="flex-1 min-w-0 text-xs">
                <div className="font-medium truncate">{selected.displayName}</div>
                <div className="text-muted-foreground truncate">{selected.email}</div>
              </div>
              <button aria-label="Fermer" title="Fermer" onClick={() => { setSelected(null); setSearch(""); }} className="p-1 rounded-lg hover:bg-muted"><X size={12} /></button>
            </div>
          )}
        </div>
        <button
          onClick={handleGenerer}
          disabled={!selected}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          data-testid="pin-generer"
        >
          <KeyRound size={14} /> Générer le code
        </button>
      </div>

      <CodesClasse />

      <DataTable
        columns={columns}
        data={pins as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Compte..."
        emptyMessage="Aucun PIN généré pour l'instant."
      />
    </div>
  );
}


/** Codes pour toute une classe (partie 10, lot 1) : à la rentrée, une liste imprimée remise en
 * classe contre signature plutôt qu'un passage de chaque étudiant au bureau. */
function CodesClasse() {
  const { currentUser } = useAuth();
  const annee = getAnneeActuelle();
  const classes = useClasses().filter((c) => c.annee === annee && !c.cloturee);
  const [classeId, setClasseId] = useState("");
  const [jours, setJours] = useState(7);
  const [confirmer, setConfirmer] = useState(false);
  const [enCours, setEnCours] = useState<{ fait: number; total: number } | null>(null);
  const [resultat, setResultat] = useState<{ classe: string; lignes: CodeEtudiant[] } | null>(null);
  // Étudiants cochés : seuls eux reçoivent un code (un seul, quelques-uns ou toute la classe).
  const [choisis, setChoisis] = useState<Set<string>>(() => new Set());
  const [filtre, setFiltre] = useState("");
  const classe = classes.find((c) => c.id === classeId);
  const tous = useStudentStore();
  const etudiants = useMemo(() => tous
    .filter((e) => e.classeId === classeId && e.statut !== "abandon")
    .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr")), [tous, classeId]);
  const q = filtre.trim().toLowerCase();
  const visibles = q ? etudiants.filter((e) => `${e.nom} ${e.prenom} ${e.matricule}`.toLowerCase().includes(q)) : etudiants;
  const retenus = etudiants.filter((e) => choisis.has(e.id));
  const toute = retenus.length > 0 && retenus.length === etudiants.length;

  const choisirClasse = (id: string) => {
    setClasseId(id);
    setChoisis(new Set());
    setFiltre("");
    setConfirmer(false);
  };
  const cocher = (id: string, oui: boolean) => {
    setConfirmer(false);
    setChoisis((c) => {
      const n = new Set(c);
      if (oui) n.add(id); else n.delete(id);
      return n;
    });
  };
  const cocherVisibles = (oui: boolean) => {
    setConfirmer(false);
    setChoisis((c) => {
      const n = new Set(c);
      for (const e of visibles) if (oui) n.add(e.id); else n.delete(e.id);
      return n;
    });
  };

  const lancer = async () => {
    if (!currentUser || !classe || retenus.length === 0) return;
    setConfirmer(false);
    setEnCours({ fait: 0, total: 0 });
    try {
      const lignes = await genererCodesClasse(classe.id, jours, { id: currentUser.id, name: currentUser.name },
        (fait, total) => setEnCours({ fait, total }), retenus.map((e) => e.id));
      setResultat({ classe: classe.nom, lignes });
      setChoisis(new Set());
      const sans = lignes.filter((l) => !l.code).length;
      toast.success(`${lignes.length - sans} code(s) générés pour ${classe.nom}${sans ? `, ${sans} étudiant(s) sans code` : ""}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible");
    } finally {
      setEnCours(null);
    }
  };

  const imprimer = () => {
    if (resultat && !imprimerCodesClasse(resultat.classe, resultat.lignes)) {
      toast.error("Le navigateur a bloqué la fenêtre d'impression : autorisez les fenêtres pour ce site.");
    }
  };

  const champ = "px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="bg-card border border-border rounded-2xl p-5 mb-6" style={{ boxShadow: "var(--shadow-sm)" }} data-testid="pin-classe">
      <h3 className="font-bold text-foreground mb-1 flex items-center gap-2"><Users size={16} /> Codes pour une classe ou quelques étudiants</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Choisissez la classe, puis cochez les étudiants qui ont besoin d&apos;un code : un seul, quelques-uns, ou toute la classe
        avec « Tout cocher ». Seuls les étudiants cochés reçoivent un code, sur une liste à imprimer et à remettre en main propre.
        {modeSupabase && " Le compte d'un étudiant qui n'en a pas encore est ouvert au passage."}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1">
          Classe ({annee})
          <select value={classeId} onChange={(e) => choisirClasse(e.target.value)} className={champ + " min-w-[220px]"}
            disabled={!!enCours} data-testid="pin-classe-choix">
            <option value="">Choisir une classe…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1">
          Validité
          <select value={jours} onChange={(e) => setJours(Number(e.target.value))} className={champ} disabled={!!enCours} data-testid="pin-classe-duree">
            {DUREES_CODE.map((d) => <option key={d} value={d}>{d === 1 ? "1 jour" : `${d} jours`}</option>)}
          </select>
        </label>
        {!confirmer && (
          <button onClick={() => setConfirmer(true)} disabled={!classe || retenus.length === 0 || !!enCours}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="pin-classe-generer">
            <KeyRound size={14} /> {retenus.length > 0 ? `Générer ${retenus.length === 1 ? "1 code" : `${retenus.length} codes`}` : "Générer les codes"}
          </button>
        )}
      </div>

      {classe && (
        <div className="mt-3 border border-border rounded-xl" data-testid="pin-classe-etudiants">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Nom ou matricule…" aria-label="Chercher un étudiant de la classe"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={!!enCours} data-testid="pin-classe-filtre" />
            </div>
            <button onClick={() => cocherVisibles(true)} disabled={!!enCours || visibles.length === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted disabled:opacity-40" data-testid="pin-classe-tout-cocher">
              Tout cocher{q ? " (résultats)" : ""}
            </button>
            <button onClick={() => cocherVisibles(false)} disabled={!!enCours || choisis.size === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted disabled:opacity-40" data-testid="pin-classe-tout-decocher">
              Tout décocher{q ? " (résultats)" : ""}
            </button>
            <span className="text-xs text-muted-foreground" data-testid="pin-classe-compte">{retenus.length} / {etudiants.length} coché(s)</span>
          </div>
          {etudiants.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">Aucun étudiant dans cette classe.</p>
          ) : (
            <ul className="max-h-60 overflow-auto divide-y divide-border">
              {visibles.map((e) => (
                <li key={e.id}>
                  <label className="flex items-center gap-3 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/40">
                    <input type="checkbox" checked={choisis.has(e.id)} onChange={(ev) => cocher(e.id, ev.target.checked)} disabled={!!enCours}
                      data-testid={`pin-classe-cocher-${e.id}`} />
                    <span className="font-mono text-xs text-muted-foreground w-36 shrink-0">{e.matricule}</span>
                    <span className="text-foreground">{e.nom} {e.prenom}</span>
                  </label>
                </li>
              ))}
              {visibles.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">Aucun étudiant ne correspond.</li>}
            </ul>
          )}
        </div>
      )}

      {confirmer && classe && (
        <div className="mt-3 border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 flex flex-wrap items-center gap-3" data-testid="pin-classe-confirmation">
          <p className="flex-1 min-w-[240px] text-xs text-foreground">
            {toute
              ? `Chaque étudiant de ${classe.nom} reçoit un nouveau code`
              : retenus.length === 1
                ? `${retenus[0].nom} ${retenus[0].prenom} reçoit un nouveau code`
                : `${retenus.length} étudiants de ${classe.nom} reçoivent un nouveau code`}
            , valable {jours === 1 ? "1 jour" : `${jours} jours`} ; le code reçu avant ne servira plus.
            {!toute && " Les autres étudiants de la classe gardent le leur."}
          </p>
          <button onClick={() => setConfirmer(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted">Annuler</button>
          <button onClick={() => void lancer()} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary/90" data-testid="pin-classe-confirmer">
            Confirmer
          </button>
        </div>
      )}

      {enCours && (
        <p className="mt-3 text-xs text-muted-foreground" role="status" data-testid="pin-classe-progression">
          {enCours.total > 0 ? `Codes générés : ${enCours.fait} sur ${enCours.total}…` : "Préparation des comptes…"}
        </p>
      )}

      {resultat && (
        <div className="mt-4 border-t border-border pt-4" data-testid="pin-classe-resultat">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <p className="flex-1 min-w-[240px] text-sm font-semibold text-foreground">
              {resultat.classe} : {resultat.lignes.filter((l) => l.code).length} code(s)
              {modeSupabase && <span className="block text-xs font-normal text-muted-foreground">Montrés une seule fois : imprimez la liste avant de quitter cette page.</span>}
            </p>
            <button onClick={imprimer} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border border-border hover:bg-muted" data-testid="pin-classe-imprimer">
              <Printer size={14} /> Imprimer la liste
            </button>
            <button onClick={() => setResultat(null)} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Fermer la liste"><X size={14} /></button>
          </div>
          <div className="max-h-72 overflow-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground sticky top-0">
                <tr><th className="text-left px-3 py-2">Matricule</th><th className="text-left px-3 py-2">Nom</th><th className="text-left px-3 py-2">Code</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {resultat.lignes.map((l) => (
                  <tr key={l.etudiantId} data-testid={`pin-classe-ligne-${l.etudiantId}`}>
                    <td className="px-3 py-1.5 font-mono text-xs">{l.matricule}</td>
                    <td className="px-3 py-1.5">{l.nomComplet}</td>
                    <td className="px-3 py-1.5">
                      {l.code
                        ? <span className="font-mono font-semibold tracking-widest">{l.code}</span>
                        : <span className="text-xs text-muted-foreground italic">{l.motif ?? "sans code"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
