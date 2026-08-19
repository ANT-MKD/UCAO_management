import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { getUserAccounts, markMessageAsRead, sendMessage } from "@/data/studentStore";
import { useMessages } from "@/hooks/useStudentStore";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";

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

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Communication" }, { label: "Messagerie" }]}
        title="Messagerie interne"
        subtitle="Communication directe avec enseignants et étudiants"
      />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold mb-3">Boîte de réception</h3>
          <div className="space-y-2 max-h-[520px] overflow-auto">
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
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-bold mb-3">Nouveau message</h3>
          <div className="space-y-3">
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-border bg-background">
              <option value="">Destinataire</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.displayName} ({u.role})</option>)}
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet" className="w-full px-3 py-2 rounded-xl border border-border bg-background" />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Message..." className="w-full min-h-[180px] px-3 py-2 rounded-xl border border-border bg-background" />
            <button onClick={handleSend} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm">
              <Send size={14} /> Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
