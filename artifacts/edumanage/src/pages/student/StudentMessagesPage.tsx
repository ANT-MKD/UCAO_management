import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { sendMessage, getUserAccounts, markMessageAsRead } from "@/data/studentStore";
import { useMessages } from "@/hooks/useStudentStore";

export default function StudentMessagesPage() {
  const { currentUser } = useAuth();
  const messages = useMessages(currentUser?.id);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const adminUser = useMemo(() => getUserAccounts().find((u) => u.role === "admin"), []);

  const handleSend = () => {
    if (!currentUser || !adminUser || !subject.trim() || !content.trim()) return;
    sendMessage(currentUser.id, adminUser.id, subject.trim(), content.trim());
    setSubject("");
    setContent("");
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold mb-3">Mes messages</h2>
        <div className="space-y-2 max-h-[500px] overflow-auto">
          {messages.map((m) => (
            <button
              key={m.id}
              onClick={() => currentUser && markMessageAsRead(m.id, currentUser.id)}
              className="w-full text-left p-3 rounded-xl border border-border hover:bg-muted"
            >
              <p className="text-sm font-semibold">{m.subject}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{m.content}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold mb-3">Nouveau message au secrétariat</h2>
        <div className="space-y-3">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet" className="w-full px-3 py-2 rounded-xl border border-border bg-background" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Votre message..." className="w-full min-h-[160px] px-3 py-2 rounded-xl border border-border bg-background" />
          <button onClick={handleSend} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm">
            <Send size={14} /> Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
