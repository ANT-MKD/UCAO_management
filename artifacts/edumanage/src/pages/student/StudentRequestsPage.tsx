import { useMemo, useState } from "react";
import { ClipboardList, Send, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { addStudentRequest, type StudentRequestRecord } from "@/data/studentStore";
import { useStudentRequests } from "@/hooks/useStudentStore";
import { cn, formatDate } from "@/lib/utils";

const REQUEST_TYPES: { value: StudentRequestRecord["type"]; label: string }[] = [
  { value: "justificatif_absence", label: "Justificatif d'absence" },
  { value: "attestation", label: "Attestation" },
  { value: "reclamation_note", label: "Réclamation de note" },
];

const STATUS_STYLES: Record<StudentRequestRecord["status"], { label: string; className: string }> = {
  nouveau: { label: "Nouveau", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  en_cours: { label: "En cours", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  valide: { label: "Validé", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  rejete: { label: "Rejeté", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
};

export default function StudentRequestsPage() {
  const { currentUser } = useAuth();
  const allRequests = useStudentRequests();
  const [type, setType] = useState<StudentRequestRecord["type"]>("justificatif_absence");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const myRequests = useMemo(
    () => allRequests.filter((r) => r.studentId === currentUser?.linkedId),
    [allRequests, currentUser?.linkedId],
  );

  const handleSubmit = () => {
    if (!currentUser?.linkedId || !subject.trim() || !message.trim()) return;
    addStudentRequest({
      studentId: currentUser.linkedId,
      type,
      subject: subject.trim(),
      message: message.trim(),
    });
    setSubject("");
    setMessage("");
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={18} className="text-primary" />
          <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>
            Nouvelle demande
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Déposez une demande au secrétariat (justificatif, attestation ou réclamation).
        </p>

        <div className="space-y-3 max-w-xl">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type de demande</label>
            <select value={type} onChange={(e) => setType(e.target.value as StudentRequestRecord["type"])} className={inputClass}>
              {REQUEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Objet</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Justificatif absence du 12/01"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décrivez votre demande..."
              className={cn(inputClass, "min-h-[120px]")}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!subject.trim() || !message.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {sent ? <CheckCircle size={14} /> : <Send size={14} />}
            {sent ? "Demande envoyée" : "Envoyer la demande"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
        <h3 className="font-bold text-foreground mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
          Mes demandes ({myRequests.length})
        </h3>
        {myRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune demande pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {myRequests.map((req) => {
              const typeLabel = REQUEST_TYPES.find((t) => t.value === req.type)?.label ?? req.type;
              const status = STATUS_STYLES[req.status];
              return (
                <div key={req.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{req.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {typeLabel} · {formatDate(req.createdAt)}
                      </p>
                    </div>
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", status.className)}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{req.message}</p>
                  {req.resolution && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Réponse du secrétariat</p>
                      <p className="text-sm text-foreground">{req.resolution}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
