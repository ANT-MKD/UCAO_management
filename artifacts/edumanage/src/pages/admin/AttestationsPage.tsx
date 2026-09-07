import { useMemo, useState } from "react";
import { Eye, Printer, FileText, X, Search, AlertTriangle, CheckCircle2, Send, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { NIVEAUX, SEMESTRES } from "@/data/mockData";
import { useStudentStore } from "@/hooks/useStudentStore";
import { useAttestations } from "@/hooks/useAttestationStore";
import { useDeliberations } from "@/hooks/useDeliberationStore";
import {
  genererAttestation,
  marquerEnvoyee,
  verifierEligibiliteReussite,
  TYPE_LABELS,
  type AttestationRecord,
  type AttestationType,
} from "@/data/attestationStore";
import { buildPrintDocumentHtml } from "@/lib/printDocument";
import { getEtablissement } from "@/data/etablissementStore";
import { getSignatureConfig } from "@/data/signatureConfigStore";
import { estActionInterdite } from "@/data/motifBlocageStore";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate, formatCFA, cn } from "@/lib/utils";

const ACTION_IMPRESSION: Record<AttestationType, string> = {
  scolarite: "impression_certificat_scolarite",
  inscription: "impression_attestation_inscription",
  reussite: "impression_attestation_reussite",
};

const TYPE_OPTIONS: { value: AttestationType; label: string }[] = [
  { value: "scolarite", label: "Certificat de scolarité" },
  { value: "inscription", label: "Attestation d'inscription" },
  { value: "reussite", label: "Attestation de réussite" },
];

const STATUT_CONFIG = {
  genere: { label: "Générée", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  envoyee: { label: "Envoyée", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

/** Réutilisée telle quelle par le portail étudiant (StudentDocumentsPage.tsx) pour imprimer une
 * attestation déjà générée — jamais un second gabarit qui risquerait de diverger de celui-ci. */
export function buildAttestationHtml(entry: AttestationRecord) {
  const nomEtablissement = getEtablissement().nom;
  let corps = "";
  if (entry.type === "reussite") {
    corps = `
      <p>Je soussigné(e), le Directeur de ${nomEtablissement}, certifie par la présente que :</p>
      <p style="text-align:center;font-size:16px;font-weight:bold;margin:20px 0">${entry.etudiant}</p>
      <p>A subi avec succès les épreuves du <strong>${entry.semestreLabel ?? ""}</strong> (${entry.filiere} — ${entry.classe}), avec une moyenne de <strong>${entry.moyenneConstatee?.toFixed(2) ?? "—"}/20</strong> et la décision de jury <strong>${entry.decisionConstatee === "admis" ? "Admis" : entry.decisionConstatee}</strong>, délibérée le ${formatDate(entry.dateGeneration)}.</p>
      <p>En foi de quoi, la présente attestation de réussite est délivrée pour servir et valoir ce que de droit.</p>
    `;
  } else if (entry.type === "inscription") {
    corps = `
      <p>Je soussigné(e), le Directeur de ${nomEtablissement}, certifie par la présente que :</p>
      <p style="text-align:center;font-size:16px;font-weight:bold;margin:20px 0">${entry.etudiant}</p>
      <p>Est régulièrement inscrit(e) dans notre établissement pour l'année académique ${entry.annee}, en ${entry.filiere} — ${entry.classe}.</p>
      <p>En foi de quoi, la présente attestation d'inscription est délivrée pour servir et valoir ce que de droit.</p>
    `;
  } else {
    corps = `
      <p>Je soussigné(e), le Directeur de ${nomEtablissement}, certifie par la présente que :</p>
      <p style="text-align:center;font-size:16px;font-weight:bold;margin:20px 0">${entry.etudiant}</p>
      <p>Est régulièrement inscrit(e) dans notre établissement pour l'année universitaire en cours et suit assidûment les cours dispensés.</p>
      <p>En foi de quoi, la présente attestation est délivrée pour servir et valoir ce que de droit.</p>
    `;
  }
  const sig = getSignatureConfig(entry.type);
  return buildPrintDocumentHtml({
    badge: entry.typeLabel.toUpperCase(),
    numeroLabel: "Réf.",
    numero: entry.numero,
    date: formatDate(entry.dateGeneration),
    destinataireLabel: "Concerne",
    destinataireNom: entry.etudiant,
    destinataireLignes: [`Matricule : ${entry.matricule}`, `${entry.filiere} — Classe ${entry.classe}`, `Année académique : ${entry.annee}`],
    corps,
    messageMerci: "",
    signatureLabel: sig.actif && sig.signataireNom ? sig.signataireNom : "Le Directeur",
    signatureImageDataUrl: sig.actif ? sig.imageDataUrl : undefined,
  });
}

export default function AttestationsPage() {
  const etudiants = useStudentStore();
  const attestations = useAttestations();
  useDeliberations(); // souscription pour re-rendre l'éligibilité réussite quand une délibération change
  const { currentUser } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedEtudiantId, setSelectedEtudiantId] = useState("");
  const [type, setType] = useState<AttestationType>("scolarite");
  const [semestreId, setSemestreId] = useState("");
  const [preview, setPreview] = useState<AttestationRecord | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");

  const selectedEtudiant = etudiants.find((e) => e.id === selectedEtudiantId);

  const filteredStudents = useMemo(() => {
    if (search.length < 2) return [];
    const q = search.toLowerCase();
    return etudiants.filter((e) => `${e.prenom} ${e.nom}`.toLowerCase().includes(q) || e.matricule.toLowerCase().includes(q)).slice(0, 8);
  }, [etudiants, search]);

  const semestresDisponibles = useMemo(() => {
    if (!selectedEtudiant) return [];
    const niveau = NIVEAUX.find((n) => n.alias === selectedEtudiant.niveau && n.filiereId === selectedEtudiant.filiereId);
    if (!niveau) return [];
    return SEMESTRES.filter((s) => s.niveauId === niveau.id);
  }, [selectedEtudiant]);

  const eligibiliteReussite = useMemo(() => {
    if (type !== "reussite" || !selectedEtudiant || !semestreId) return undefined;
    return verifierEligibiliteReussite(selectedEtudiant.id, selectedEtudiant.classeId, semestreId);
  }, [type, selectedEtudiant, semestreId, attestations]);

  const peutGenerer = !!selectedEtudiant && (type !== "reussite" || (!!semestreId && eligibiliteReussite?.eligible === true));

  const filtered = attestations.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false;
    if (statutFilter && a.statut !== statutFilter) return false;
    return true;
  });

  const handleGenerer = () => {
    if (!selectedEtudiant) return;
    const semestre = semestresDisponibles.find((s) => s.id === semestreId);
    try {
      genererAttestation({
        etudiantId: selectedEtudiant.id,
        etudiant: `${selectedEtudiant.prenom} ${selectedEtudiant.nom}`,
        matricule: selectedEtudiant.matricule,
        classeId: selectedEtudiant.classeId,
        classe: selectedEtudiant.classe,
        filiereId: selectedEtudiant.filiereId,
        filiere: selectedEtudiant.filiere,
        annee: selectedEtudiant.annee,
        soldeDu: selectedEtudiant.soldeDu,
        type,
        semestreId: type === "reussite" ? semestreId : undefined,
        semestreLabel: type === "reussite" ? `${semestre?.nom} (${semestre?.alias})` : undefined,
        effectuePar: currentUser?.name ?? "Administration",
      });
      toast.success(`${TYPE_LABELS[type]} générée pour ${selectedEtudiant.prenom} ${selectedEtudiant.nom}`);
      setSelectedEtudiantId("");
      setSearch("");
      setSemestreId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible");
    }
  };

  const printAttestation = (entry: AttestationRecord) => {
    if (estActionInterdite(entry.etudiantId, ACTION_IMPRESSION[entry.type])) {
      toast.error(`Impression bloquée pour ${entry.etudiant} — un motif de blocage l'interdit (voir Paramètres → Motifs de blocage).`);
      return;
    }
    const win = window.open("", "_blank");
    if (win) { win.document.write(buildAttestationHtml(entry)); win.document.close(); win.print(); }
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Bulletins" }, { label: "Attestations & Certificats" }]}
        title="Attestations & Certificats"
        subtitle="Génération de certificats de scolarité, d'inscription et de réussite — la réussite est vérifiée contre une vraie délibération"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
          <h3 className="font-bold text-foreground mb-4">Générer une attestation</h3>

          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedEtudiantId(""); }}
              placeholder="Nom, prénom ou matricule..."
              className={inputClass + " pl-9"}
              data-testid="attestation-recherche-etudiant"
            />
          </div>

          {!selectedEtudiant && search.length >= 2 && (
            <div className="space-y-1.5 mb-3 max-h-56 overflow-auto">
              {filteredStudents.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Aucun étudiant trouvé</p>}
              {filteredStudents.map((e) => (
                <div
                  key={e.id}
                  onClick={() => { setSelectedEtudiantId(e.id); setSemestreId(""); }}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                  data-testid={`attestation-etudiant-option-${e.id}`}
                >
                  <UserAvatar name={`${e.prenom} ${e.nom}`} size="xs" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{e.prenom} {e.nom}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{e.matricule} · {e.classe}</div>
                  </div>
                  {e.soldeDu > 0 && <span className="text-[10px] text-red-500 font-medium">Doit {formatCFA(e.soldeDu)}</span>}
                </div>
              ))}
            </div>
          )}

          {selectedEtudiant && (
            <div className="border border-primary/30 bg-primary/5 rounded-xl p-3 mb-3" data-testid="attestation-etudiant-selectionne">
              <div className="flex items-center gap-2">
                <UserAvatar name={`${selectedEtudiant.prenom} ${selectedEtudiant.nom}`} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{selectedEtudiant.prenom} {selectedEtudiant.nom}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{selectedEtudiant.matricule} · {selectedEtudiant.filiere} — {selectedEtudiant.classe}</div>
                </div>
                <button onClick={() => { setSelectedEtudiantId(""); setSearch(""); }} className="p-1 rounded-lg hover:bg-muted"><X size={14} /></button>
              </div>
              {selectedEtudiant.soldeDu > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-amber-700 dark:text-amber-400" data-testid="attestation-avertissement-solde">
                  <AlertTriangle size={12} /> Solde dû : {formatCFA(selectedEtudiant.soldeDu)} — la génération reste possible, à titre informatif.
                </div>
              )}
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type de document</label>
            <select value={type} onChange={(e) => { setType(e.target.value as AttestationType); setSemestreId(""); }} className={inputClass} data-testid="attestation-type">
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {type === "reussite" && selectedEtudiant && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Semestre à certifier</label>
              <select value={semestreId} onChange={(e) => setSemestreId(e.target.value)} className={inputClass} data-testid="attestation-semestre">
                <option value="">Sélectionner</option>
                {semestresDisponibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.alias})</option>)}
              </select>
            </div>
          )}

          {type === "reussite" && semestreId && eligibiliteReussite && (
            <div
              className={cn(
                "flex items-start gap-2 p-3 rounded-xl text-xs mb-3",
                eligibiliteReussite.eligible ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
              )}
              data-testid="attestation-eligibilite-reussite"
            >
              {eligibiliteReussite.eligible ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
              <span>{eligibiliteReussite.eligible ? `Éligible — Admis, moyenne ${eligibiliteReussite.moyenne?.toFixed(2)}/20.` : eligibiliteReussite.motif}</span>
            </div>
          )}

          <button
            onClick={handleGenerer}
            disabled={!peutGenerer}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="attestation-generer"
          >
            <FileText size={14} /> Générer
          </button>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex flex-wrap gap-3 p-4 border-b border-border">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputClass + " max-w-[220px]"}>
              <option value="">Tous les types</option>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className={inputClass + " max-w-[160px]"}>
              <option value="">Tous les statuts</option>
              <option value="genere">Générée</option>
              <option value="envoyee">Envoyée</option>
            </select>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                {["N°", "Étudiant", "Type", "Statut", "Date", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Aucune attestation générée pour l'instant.</td></tr>
              )}
              {filtered.map((a) => {
                const st = STATUT_CONFIG[a.statut];
                return (
                  <tr key={a.id} className="border-b border-border/60 hover:bg-muted/20" data-testid={`attestation-ligne-${a.id}`}>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{a.numero}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{a.etudiant}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{a.matricule}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {a.typeLabel}
                      {a.type === "reussite" && a.semestreLabel && <div className="text-[10px] text-muted-foreground flex items-center gap-1"><GraduationCap size={10} /> {a.semestreLabel} · {a.moyenneConstatee?.toFixed(2)}/20</div>}
                    </td>
                    <td className="px-4 py-3"><span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", st.cls)}>{st.label}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(a.dateGeneration)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setPreview(a)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" title="Aperçu" data-testid={`attestation-apercu-${a.id}`}><Eye size={14} /></button>
                        <button onClick={() => printAttestation(a)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" title="Imprimer" data-testid={`attestation-imprimer-${a.id}`}><Printer size={14} /></button>
                        {a.statut === "genere" && (
                          <button onClick={() => { marquerEnvoyee(a.id); toast.success("Marquée comme envoyée"); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-600" title="Marquer comme envoyée" data-testid={`attestation-envoyer-${a.id}`}><Send size={14} /></button>
                        )}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b shrink-0">
              <h3 className="font-bold flex items-center gap-2 text-gray-900"><FileText size={18} /> Aperçu — {preview.typeLabel}</h3>
              <button onClick={() => setPreview(null)}><X size={18} className="text-gray-500" /></button>
            </div>
            <iframe title="Aperçu attestation" srcDoc={buildAttestationHtml(preview)} className="flex-1 w-full" data-testid="attestation-preview-iframe" />
            <div className="p-4 flex gap-2 justify-end border-t shrink-0">
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
