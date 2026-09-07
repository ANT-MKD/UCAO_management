import { useMemo, useState } from "react";
import { Send, X, Search, Paperclip, ShieldCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { getUserAccounts, markMessageAsRead, sendMessage } from "@/data/studentStore";
import { useMessages } from "@/hooks/useStudentStore";
import { useGroupesExternes, useGroupesInternes, useGroupesPersonnalises } from "@/hooks/useCommunicationGroupsStore";
import { useCommunicationRoles } from "@/hooks/useCommunicationRolesStore";
import { estAutorise } from "@/data/communicationRolesStore";
import { envoyerMail, resolveDestinataires, type SelectionDestinataireMail } from "@/data/mailEnvoyeStore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { cn } from "@/lib/utils";

export default function MessagesPage() {
  const { currentUser } = useAuth();
  const messages = useMessages(currentUser?.id);
  const users = useMemo(() => getUserAccounts().filter((u) => u.id !== currentUser?.id), [currentUser?.id]);
  const [toUserId, setToUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const handleSend = () => {
    if (!currentUser || !toUserId || !subject.trim() || !content.trim()) return;
    sendMessage(currentUser.id, toUserId, subject.trim(), content.trim());
    setSubject("");
    setContent("");
  };

  // === Envoi Messages : composeur de diffusion (groupes / comptes → vrais destinataires) ===
  const groupesExternes = useGroupesExternes();
  const groupesInternes = useGroupesInternes();
  const groupesPersonnalises = useGroupesPersonnalises();
  useCommunicationRoles(); // re-rend si les validateurs désignés changent

  const [destSearch, setDestSearch] = useState("");
  const [selections, setSelections] = useState<SelectionDestinataireMail[]>([]);
  const [emailsSupp, setEmailsSupp] = useState("");
  const [objet, setObjet] = useState("");
  const [corpsMail, setCorpsMail] = useState("");
  const [fichiers, setFichiers] = useState<string[]>([]);

  const autorise = currentUser ? estAutorise("validateur_message", currentUser.id) : false;

  const candidats = useMemo(() => {
    const q = destSearch.trim().toLowerCase();
    if (q.length < 1) return [];
    const out: SelectionDestinataireMail[] = [];
    groupesExternes.filter((g) => g.nom.toLowerCase().includes(q)).forEach((g) => out.push({ type: "groupe_externe", id: g.id, label: `Groupe externe — ${g.nom}` }));
    groupesInternes.filter((g) => g.nom.toLowerCase().includes(q)).forEach((g) => out.push({ type: "groupe_interne", id: g.id, label: `Groupe interne — ${g.nom}` }));
    groupesPersonnalises.filter((g) => g.nom.toLowerCase().includes(q)).forEach((g) => out.push({ type: "groupe_personnalise", id: g.id, label: `Groupe personnalisé — ${g.nom}` }));
    getUserAccounts().filter((u) => u.displayName.toLowerCase().includes(q)).forEach((u) => out.push({ type: "compte", id: u.id, label: `${u.displayName} (${u.role})` }));
    return out.filter((c) => !selections.some((s) => s.type === c.type && s.id === c.id)).slice(0, 8);
  }, [destSearch, groupesExternes, groupesInternes, groupesPersonnalises, selections]);

  const apercuDestinataires = useMemo(() => resolveDestinataires(selections), [selections]);

  const peutEnvoyer = selections.length > 0 && objet.trim().length > 0 && corpsMail.trim().length > 0;

  const handleAddSelection = (sel: SelectionDestinataireMail) => {
    setSelections((prev) => [...prev, sel]);
    setDestSearch("");
  };

  const handleRemoveSelection = (sel: SelectionDestinataireMail) => {
    setSelections((prev) => prev.filter((s) => !(s.type === sel.type && s.id === sel.id)));
  };

  const handleEnvoyerMail = () => {
    if (!currentUser || !peutEnvoyer) return;
    const mail = envoyerMail({
      auteurId: currentUser.id,
      auteurLabel: currentUser.name,
      selections,
      emailsSupplementaires: emailsSupp.split(",").map((s) => s.trim()).filter(Boolean),
      objet: objet.trim(),
      message: corpsMail.trim(),
      fichiers,
    });
    if (mail.statut === "traite") {
      toast.success(`Mail envoyé à ${apercuDestinataires.length} destinataire(s).`);
    } else {
      toast.info("Aucun validateur désigné pour votre compte — mail envoyé en validation (Validation mails).");
    }
    setSelections([]);
    setEmailsSupp("");
    setObjet("");
    setCorpsMail("");
    setFichiers([]);
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Communication" }, { label: "Envoi message" }]}
        title="Envoi message"
        subtitle="Diffusion réelle vers des groupes ou des comptes — la messagerie directe reste disponible ci-dessous"
      />

      <div className="bg-card border border-border rounded-2xl p-5 mb-6" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">Nouveau message</h3>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full",
              autorise ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
            )}
          >
            {autorise ? <ShieldCheck size={12} /> : <Clock size={12} />}
            {autorise ? "Envoi direct (validateur désigné)" : "Passera par validation"}
          </span>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Destinataires *</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={destSearch}
                onChange={(e) => setDestSearch(e.target.value)}
                placeholder="Groupe externe, interne, personnalisé, compte..."
                className={inputClass + " pl-9"}
                data-testid="envoi-destinataires-recherche"
              />
            </div>
            {candidats.length > 0 && (
              <div className="mt-1.5 border border-border rounded-xl divide-y divide-border max-h-48 overflow-auto" data-testid="envoi-destinataires-suggestions">
                {candidats.map((c) => (
                  <button
                    key={`${c.type}-${c.id}`}
                    onClick={() => handleAddSelection(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    data-testid={`envoi-destinataire-option-${c.id}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {selections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2" data-testid="envoi-destinataires-chips">
                {selections.map((s) => (
                  <span key={`${s.type}-${s.id}`} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    {s.label}
                    <button onClick={() => handleRemoveSelection(s)} className="hover:text-red-500"><X size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            {selections.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2" data-testid="envoi-destinataires-count">
                {apercuDestinataires.length} destinataire(s) résolu(s) au total (doublons fusionnés).
              </p>
            )}

            <label className="block text-xs font-medium text-muted-foreground mb-1.5 mt-4">Emails supplémentaires</label>
            <input
              value={emailsSupp}
              onChange={(e) => setEmailsSupp(e.target.value)}
              placeholder="séparés par des virgules"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Objet *</label>
            <input value={objet} onChange={(e) => setObjet(e.target.value)} className={inputClass} data-testid="envoi-objet" />

            <label className="block text-xs font-medium text-muted-foreground mb-1.5 mt-4">Message *</label>
            <textarea
              value={corpsMail}
              onChange={(e) => setCorpsMail(e.target.value)}
              className={inputClass + " min-h-[140px]"}
              data-testid="envoi-message"
            />

            <label className="inline-flex items-center gap-2 mt-3 text-xs text-primary cursor-pointer hover:underline">
              <Paperclip size={13} />
              Joindre fichiers
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setFichiers(Array.from(e.target.files ?? []).map((f) => f.name))}
              />
            </label>
            {fichiers.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">{fichiers.join(", ")}</p>
            )}
          </div>
        </div>

        <button
          onClick={handleEnvoyerMail}
          disabled={!peutEnvoyer}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          data-testid="envoi-envoyer"
        >
          <Send size={14} /> Envoyer
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold mb-3">Messagerie directe (1 à 1)</h3>
        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Boîte de réception</h4>
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {messages.map((m) => (
                <button
                  key={m.id}
                  onClick={() => currentUser && markMessageAsRead(m.id, currentUser.id)}
                  className="w-full text-left rounded-xl border border-border p-3 hover:bg-muted"
                >
                  <p className="text-sm font-semibold">{m.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{m.content}</p>
                </button>
              ))}
              {messages.length === 0 && <p className="text-sm text-muted-foreground">Aucun message.</p>}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Répondre à un compte</h4>
            <div className="space-y-3">
              <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background">
                <option value="">Destinataire</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>)}
              </select>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet" className="w-full px-3 py-2 rounded-xl border border-border bg-background" />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message..." className="w-full min-h-[120px] px-3 py-2 rounded-xl border border-border bg-background" />
              <button onClick={handleSend} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm">
                <Send size={14} /> Envoyer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
