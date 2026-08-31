import { useState } from "react";
import { Eye, Download, Printer, FileText, X, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { ATTESTATIONS, ETUDIANTS } from "@/data/mockData";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { formatDate, cn } from "@/lib/utils";

const STATUT_LABELS = {
  genere: { label: "Généré", cls: "bg-blue-50 text-blue-700" },
  envoye: { label: "Envoyé", cls: "bg-emerald-50 text-emerald-700" },
  en_attente: { label: "En attente", cls: "bg-amber-50 text-amber-700" },
};

const TYPES = ["Certificat de scolarité", "Attestation d'inscription", "Attestation de réussite"];

function buildAttestationHtml(entry: typeof ATTESTATIONS[0]) {
  const today = new Date().toISOString().split("T")[0];
  return buildPrintDocumentHtml({
    badge: entry.type.toUpperCase(),
    numeroLabel: "Réf.",
    numero: entry.id.toUpperCase(),
    date: formatDate(today),
    destinataireLabel: "Concerne",
    destinataireNom: entry.etudiant,
    destinataireLignes: [`Matricule : ${entry.matricule}`, `${entry.filiere} — Classe ${entry.classe}`, `Année académique : ${entry.annee}`],
    corps: `
      <p>Je soussigné(e), le Directeur de l'Institut Supérieur EduManage, certifie par la présente que :</p>
      <p style="text-align:center;font-size:16px;font-weight:bold;margin:20px 0">${entry.etudiant}</p>
      <p>Est régulièrement inscrit(e) dans notre établissement pour l'année universitaire en cours et suit assidûment les cours dispensés.</p>
      <p>En foi de quoi, la présente attestation est délivrée pour servir et valoir ce que de droit.</p>
    `,
    messageMerci: "",
    signatureLabel: "Le Directeur",
  });
}

export default function AttestationsPage() {
  const [attestations, setAttestations] = useState([...ATTESTATIONS]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [preview, setPreview] = useState<typeof ATTESTATIONS[0] | null>(null);

  const filtered = attestations.filter((a) => {
    if (search && !a.etudiant.toLowerCase().includes(search.toLowerCase()) && !a.matricule.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && a.type !== typeFilter) return false;
    if (statutFilter && a.statut !== statutFilter) return false;
    return true;
  });

  const generate = (etudiantId: string, type: string) => {
    const etu = ETUDIANTS.find((e) => e.id === etudiantId);
    if (!etu) return;
    const newAtt = {
      id: `att-${Date.now()}`,
      etudiantId,
      etudiant: `${etu.prenom} ${etu.nom}`,
      matricule: etu.matricule,
      classe: etu.classe,
      filiere: etu.filiere,
      type,
      annee: etu.annee,
      statut: "genere" as const,
      dateGeneration: new Date().toISOString().split("T")[0],
    };
    setAttestations((prev) => [newAtt, ...prev]);
  };

  const printAttestation = (entry: typeof ATTESTATIONS[0]) => {
    const win = window.open("", "_blank");
    if (win) { win.document.write(buildAttestationHtml(entry)); win.document.close(); win.print(); }
  };

  const inputClass = "px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Évaluations" }, { label: "Attestations & Certificats" }]}
        title="Attestations & Certificats"
        subtitle="Génération de certificats de scolarité et attestations d'inscription"
      />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher étudiant..." className={inputClass + " w-full pl-9"} />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputClass}>
          <option value="">Tous les types</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className={inputClass}>
          <option value="">Tous les statuts</option>
          <option value="genere">Généré</option>
          <option value="envoye">Envoyé</option>
          <option value="en_attente">En attente</option>
        </select>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-bold text-foreground mb-4">Générer une attestation</h3>
          <div className="space-y-3">
            {ETUDIANTS.slice(0, 6).map((e) => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                <UserAvatar name={`${e.prenom} ${e.nom}`} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{e.prenom} {e.nom}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{e.matricule}</div>
                </div>
                <button onClick={() => generate(e.id, "Certificat de scolarité")} className="text-[10px] px-2 py-1 bg-primary text-white rounded-lg hover:bg-primary/90">
                  Générer
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                {["Étudiant", "Type", "Année", "Statut", "Date", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const st = STATUT_LABELS[a.statut as keyof typeof STATUT_LABELS];
                return (
                  <tr key={a.id} className="border-b border-border/60 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{a.etudiant}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{a.matricule}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{a.type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.annee}</td>
                    <td className="px-4 py-3"><span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", st?.cls)}>{st?.label}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.dateGeneration ? formatDate(a.dateGeneration) : "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setPreview(a)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" title="Aperçu"><Eye size={14} /></button>
                        <button onClick={() => printAttestation(a)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" title="Imprimer"><Printer size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold flex items-center gap-2"><FileText size={18} /> Aperçu — {preview.type}</h3>
              <button onClick={() => setPreview(null)}><X size={18} /></button>
            </div>
            <div className="p-8 text-center border-b-4 border-indigo-600">
              <h2 className="text-xl font-bold text-indigo-600">Institut Supérieur EduManage</h2>
              <p className="text-xs text-gray-500 mt-1">Dakar, Sénégal</p>
            </div>
            <div className="p-8">
              <h3 className="text-center font-bold underline mb-6">{preview.type.toUpperCase()}</h3>
              <p className="text-sm leading-relaxed text-justify">
                Je certifie que <strong>{preview.etudiant}</strong> (matricule {preview.matricule}),
                inscrit(e) en {preview.filiere} — {preview.classe}, année {preview.annee},
                est régulièrement inscrit(e) dans notre établissement.
              </p>
            </div>
            <div className="p-4 flex gap-2 justify-end border-t">
              <button onClick={() => printAttestation(preview)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm">
                <Printer size={14} /> Imprimer / PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
