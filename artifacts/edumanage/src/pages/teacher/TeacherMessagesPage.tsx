import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Send, Plus, ArrowLeft, Check, CheckCheck, Phone, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { sendMessage, markMessageAsRead, type MessageRecord, type UserAccountRecord } from "@/data/studentStore";
import { useMessages, useUserAccounts } from "@/hooks/useStudentStore";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { FormModal } from "@/components/admin/FormModal";
import { cn, formatDate } from "@/lib/utils";

interface Conversation {
  contactId: string;
  contact: UserAccountRecord;
  messages: MessageRecord[];
  lastMessage: MessageRecord;
  unreadCount: number;
}

function roleLabel(u: UserAccountRecord): string {
  if (u.fonction) return u.fonction;
  return u.role === "student" ? "Étudiant" : "Administration";
}

function timeLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function dayLabel(dateStr: string): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const day = dateStr.slice(0, 10);
  if (day === today) return "Aujourd'hui";
  if (day === yesterday) return "Hier";
  return formatDate(dateStr);
}

function listTimeLabel(dateStr: string): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const day = dateStr.slice(0, 10);
  if (day === today) return timeLabel(dateStr);
  if (day === yesterday) return "Hier";
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Même modèle générique que la messagerie étudiante (MessageRecord/sendMessage ne connaissent
 * pas de rôle particulier) — un enseignant peut déjà recevoir un message d'un étudiant ou de
 * l'administration ; seule cette page manquait pour le consulter et y répondre. Démarrer une
 * nouvelle conversation reste réservé à l'administration (pas de messagerie prof→étudiant ici). */
export default function TeacherMessagesPage() {
  const { currentUser } = useAuth();
  const messages = useMessages(currentUser?.id);
  const accounts = useUserAccounts();

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [tab, setTab] = useState<"toutes" | "non_lues">("toutes");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newContactId, setNewContactId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newContent, setNewContent] = useState("");
  const threadEndRef = useRef<HTMLDivElement>(null);

  const contacts = useMemo(
    () => accounts.filter((a) => a.id !== currentUser?.id && a.actif && a.role === "admin"),
    [accounts, currentUser?.id],
  );

  const conversations = useMemo(() => {
    if (!currentUser) return [];
    const map = new Map<string, MessageRecord[]>();
    for (const m of messages) {
      const otherId = m.fromUserId === currentUser.id ? m.toUserId : m.fromUserId;
      const arr = map.get(otherId) ?? [];
      arr.push(m);
      map.set(otherId, arr);
    }
    const list: Conversation[] = [];
    for (const [contactId, msgs] of map) {
      const contact = accounts.find((a) => a.id === contactId);
      if (!contact) continue;
      const sorted = [...msgs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const unreadCount = sorted.filter((m) => m.toUserId === currentUser.id && !m.read).length;
      list.push({ contactId, contact, messages: sorted, lastMessage: sorted[sorted.length - 1], unreadCount });
    }
    return list.sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
  }, [messages, accounts, currentUser]);

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (tab === "non_lues" && c.unreadCount === 0) return false;
      if (q && !c.contact.displayName.toLowerCase().includes(q) && !roleLabel(c.contact).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [conversations, tab, query]);

  const nonLuesCount = conversations.filter((c) => c.unreadCount > 0).length;

  const effectiveSelectedId = selectedContactId ?? conversations[0]?.contactId ?? null;
  const activeConversation = conversations.find((c) => c.contactId === effectiveSelectedId) ?? null;

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeConversation?.messages.length, effectiveSelectedId]);

  const openConversation = (contactId: string) => {
    setSelectedContactId(contactId);
    if (!currentUser) return;
    const conv = conversations.find((c) => c.contactId === contactId);
    conv?.messages.filter((m) => m.toUserId === currentUser.id && !m.read).forEach((m) => markMessageAsRead(m.id, currentUser.id));
  };

  const handleReply = () => {
    if (!currentUser || !activeConversation || !draft.trim()) return;
    sendMessage(currentUser.id, activeConversation.contactId, activeConversation.lastMessage.subject, draft.trim());
    setDraft("");
  };

  const handleCreateConversation = () => {
    if (!currentUser || !newContactId || !newSubject.trim() || !newContent.trim()) return;
    sendMessage(currentUser.id, newContactId, newSubject.trim(), newContent.trim());
    toast.success("Message envoyé.");
    setSelectedContactId(newContactId);
    setShowNewMessage(false);
    setNewContactId("");
    setNewSubject("");
    setNewContent("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Messagerie</h2>
        <p className="text-sm text-muted-foreground mt-1">Communiquez avec l'administration et vos étudiants.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_260px]">
        {/* Liste des conversations */}
        <div className={cn("rounded-2xl border border-border bg-card flex-col overflow-hidden", selectedContactId ? "hidden lg:flex" : "flex")}>
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-foreground">Conversations</h3>
              <button
                type="button"
                onClick={() => setShowNewMessage(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
                data-testid="messagerie-nouveau"
              >
                <Plus size={13} /> Nouveau
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une conversation..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="messagerie-recherche"
              />
            </div>
            <div className="flex gap-1">
              {(
                [
                  ["toutes", `Toutes${conversations.length ? ` ${conversations.length}` : ""}`],
                  ["non_lues", `Non lues${nonLuesCount ? ` ${nonLuesCount}` : ""}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                    tab === key ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted",
                  )}
                  data-testid={`messagerie-onglet-${key}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[560px]">
            {filteredConversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10 px-4">
                {conversations.length === 0 ? "Aucune conversation pour le moment." : "Aucune conversation ne correspond à votre recherche."}
              </p>
            ) : (
              filteredConversations.map((c) => (
                <button
                  key={c.contactId}
                  type="button"
                  onClick={() => openConversation(c.contactId)}
                  className={cn(
                    "w-full text-left p-3.5 flex items-start gap-2.5 border-b border-border hover:bg-muted/50 transition-colors",
                    effectiveSelectedId === c.contactId && "bg-muted",
                  )}
                  data-testid={`conversation-${c.contactId}`}
                >
                  <UserAvatar name={c.contact.displayName} src={c.contact.photoDataUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm truncate", c.unreadCount > 0 ? "font-bold text-foreground" : "font-medium text-foreground")}>{c.contact.displayName}</p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{listTimeLabel(c.lastMessage.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={cn("text-xs truncate min-w-0", c.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                        {c.lastMessage.fromUserId === currentUser?.id ? "Vous : " : ""}
                        {c.lastMessage.content}
                      </p>
                      {c.unreadCount > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Fil de discussion */}
        <div className={cn("rounded-2xl border border-border bg-card flex-col overflow-hidden", selectedContactId ? "flex" : "hidden lg:flex")}>
          {activeConversation ? (
            <>
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedContactId(null)}
                  className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-muted text-muted-foreground"
                  aria-label="Retour"
                  data-testid="messagerie-retour"
                >
                  <ArrowLeft size={16} />
                </button>
                <UserAvatar name={activeConversation.contact.displayName} src={activeConversation.contact.photoDataUrl} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{activeConversation.contact.displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{roleLabel(activeConversation.contact)}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[440px] px-4 py-4 space-y-3">
                {activeConversation.messages.map((m, i) => {
                  const mine = m.fromUserId === currentUser?.id;
                  const prev = activeConversation.messages[i - 1];
                  const showDaySeparator = !prev || !isSameDay(prev.createdAt, m.createdAt);
                  return (
                    <div key={m.id}>
                      {showDaySeparator && (
                        <div className="flex justify-center my-3">
                          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{dayLabel(m.createdAt)}</span>
                        </div>
                      )}
                      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5", mine ? "bg-primary text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm")}>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                          <div className={cn("flex items-center gap-1 mt-1 justify-end", mine ? "text-white/70" : "text-muted-foreground")}>
                            <span className="text-[10px]">{timeLabel(m.createdAt)}</span>
                            {mine && (m.read ? <CheckCheck size={12} /> : <Check size={12} />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={threadEndRef} />
              </div>

              <div className="p-3 border-t border-border flex items-end gap-2 flex-shrink-0">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                  placeholder="Écrire un message..."
                  rows={1}
                  className="flex-1 px-3.5 py-2.5 text-sm border border-border rounded-xl bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="messagerie-saisie"
                />
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={!draft.trim()}
                  className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0"
                  data-testid="messagerie-envoyer"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <MessageSquare size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucune conversation sélectionnée</p>
              <p className="text-xs text-muted-foreground mt-1">Choisissez une conversation ou démarrez-en une nouvelle.</p>
            </div>
          )}
        </div>

        {/* Informations sur le contact */}
        <div className="hidden xl:flex rounded-2xl border border-border bg-card p-5 flex-col">
          {activeConversation ? (
            <>
              <h3 className="text-sm font-bold text-foreground mb-4">Informations</h3>
              <div className="flex flex-col items-center text-center pb-4 border-b border-border">
                <UserAvatar name={activeConversation.contact.displayName} src={activeConversation.contact.photoDataUrl} size="lg" className="mb-2" />
                <p className="text-sm font-bold text-foreground">{activeConversation.contact.displayName}</p>
                <p className="text-xs text-muted-foreground">{roleLabel(activeConversation.contact)}</p>
              </div>
              <div className="pt-4 space-y-2.5 text-sm">
                <div className="flex items-start gap-2 min-w-0">
                  <Mail size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-foreground truncate min-w-0">{activeConversation.contact.email}</span>
                </div>
                {activeConversation.contact.telephone && (
                  <div className="flex items-start gap-2 min-w-0">
                    <Phone size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-foreground truncate min-w-0">{activeConversation.contact.telephone}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Sélectionnez une conversation pour voir les informations du contact.</p>
          )}
        </div>
      </div>

      <FormModal open={showNewMessage} onClose={() => setShowNewMessage(false)} title="Nouveau message" subtitle="Contactez un membre de l'administration">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Destinataire <span className="text-red-500">*</span></label>
            <select
              value={newContactId}
              onChange={(e) => setNewContactId(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="nouveau-message-destinataire"
            >
              <option value="">— Sélectionner —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName} — {roleLabel(c)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Objet <span className="text-red-500">*</span></label>
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Objet de votre message"
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="nouveau-message-objet"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message <span className="text-red-500">*</span></label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Votre message..."
              className="w-full min-h-[120px] px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              data-testid="nouveau-message-contenu"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateConversation}
            disabled={!newContactId || !newSubject.trim() || !newContent.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="nouveau-message-envoyer"
          >
            <Send size={14} /> Envoyer
          </button>
        </div>
      </FormModal>
    </div>
  );
}
