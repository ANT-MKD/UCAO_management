import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Check, Search, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useStudentStore } from "@/hooks/useStudentStore";
import { registerPaiement } from "@/data/studentStore";
import type { EtudiantRecord, PaiementLigne } from "@/data/studentStore";
import { FRAIS_CONFIG } from "@/data/mockData";
import { MODES_PAIEMENT, STATUTS_PAIEMENT } from "@/lib/inscriptionConstants";
import { useClasses } from "@/hooks/useStructureStore";
import { formatCFA, cn } from "@/lib/utils";

const MOYEN_COLORS: Record<string, { color: string; bg: string }> = {
  Wave: { color: "#2563eb", bg: "#eff6ff" },
  OrangeMoney: { color: "#ea580c", bg: "#fff7ed" },
  Virement: { color: "#4f46e5", bg: "#eef2ff" },
  Especes: { color: "#16a34a", bg: "#f0fdf4" },
  Cheque: { color: "#64748b", bg: "#f8fafc" },
};

type RubriqueOpt = { value: string; label: string; montant: number };

function getRubriquesForStudent(student: EtudiantRecord): RubriqueOpt[] {
  const frais = FRAIS_CONFIG.find((f) => f.filiereId === student.filiereId && f.niveau === student.niveau);
  if (!frais) {
    return [
      { value: "inscription", label: "Inscription unique", montant: 150000 },
      { value: "scolarite_mensuelle", label: "Scolarité (mensualité)", montant: 70000 },
      { value: "scolarite_annuelle", label: "Scolarité (annuelle)", montant: 700000 },
      { value: "mutuelle", label: "Mutuelle santé", montant: 15000 },
      { value: "tenue", label: "Tenue / frais divers", montant: 50000 },
      { value: "pack_complet", label: "Pack complet (inscription + tenue)", montant: 200000 },
    ];
  }
  return [
    { value: "inscription", label: "Inscription unique", montant: frais.inscription },
    { value: "scolarite_mensuelle", label: "Scolarité (mensualité)", montant: Math.round(frais.scolariteAnnuelle / 10) },
    { value: "scolarite_annuelle", label: "Scolarité (annuelle)", montant: frais.scolariteAnnuelle },
    { value: "mutuelle", label: "Mutuelle santé", montant: 15000 },
    { value: "tenue", label: "Tenue / frais divers", montant: frais.fraisDivers + 25000 },
    { value: "pack_complet", label: "Pack complet (inscription + tenue)", montant: frais.inscription + frais.fraisDivers + 25000 },
  ];
}

const STEP_LABELS = ["Sélectionner l'étudiant", "Facture unique", "Confirmation"];

export default function AddPaiementPage() {
  const [, setLocation] = useLocation();
  const etudiants = useStudentStore();
  const classes = useClasses();
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);
  const [selectedMoyen, setSelectedMoyen] = useState("Wave");
  const [selectedRubriques, setSelectedRubriques] = useState<string[]>(["inscription"]);
  const [montantVerse, setMontantVerse] = useState("");
  const [dateOperation, setDateOperation] = useState(new Date().toISOString().split("T")[0]);
  const [statutPaiement, setStatutPaiement] = useState("paye");
  const [reference, setReference] = useState("");
  const [classeId, setClasseId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const rubriques = selectedStudent ? getRubriquesForStudent(selectedStudent) : [];

  const lignes: PaiementLigne[] = useMemo(
    () =>
      rubriques
        .filter((r) => selectedRubriques.includes(r.value))
        .map((r) => ({ label: r.label, montant: r.montant })),
    [rubriques, selectedRubriques],
  );

  const totalFacture = useMemo(() => lignes.reduce((s, l) => s + l.montant, 0), [lignes]);

  const needsClasse = statutPaiement === "paye" && !selectedStudent?.classeId;

  const filteredStudents = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleSubmit = () => {
    if (!selectedStudent || lignes.length === 0) return;
    const verse = Number(montantVerse) || totalFacture;
    registerPaiement({
      etudiantId: selectedStudent.id,
      rubrique: "Facture unique",
      montant: verse,
      moyen: selectedMoyen,
      reference,
      date: dateOperation,
      statut: statutPaiement,
      lignes,
      classeId: classeId || undefined,
    });
    setSubmitted(true);
    setTimeout(() => setLocation(`/admin/students/${selectedStudent.id}`), 1500);
  };

  const canConfirmStep2 = lignes.length > 0 && (!needsClasse || !!classeId);

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Paiements", href: "/admin/paiements" }, { label: "Enregistrer" }]}
        title="Enregistrer un Paiement"
        subtitle="Facture unique multi-rubriques — un seul reçu détaillé"
        actions={
          <button onClick={() => setLocation("/admin/paiements")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />

      <div className="flex items-center justify-center mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                step === i + 1 ? "bg-primary text-white shadow-lg shadow-primary/30" :
                step > i + 1 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              )}>
                {step > i + 1 ? <Check size={14} /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium mt-1.5 whitespace-nowrap max-w-24 text-center", step === i + 1 ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn("h-0.5 w-14 mx-2 mb-5 rounded-full transition-all", step > i + 1 ? "bg-emerald-500" : "bg-muted")} />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-xl mx-auto">
        {step === 1 && (
          <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h3 className="font-bold text-foreground text-lg mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Rechercher l&apos;étudiant</h3>
            <div className="relative mb-4">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="search"
                placeholder="Nom, prénom ou matricule..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                data-testid="search-student"
              />
            </div>
            {filteredStudents.map((stu) => (
              <div
                key={stu.id}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all mb-2",
                  selectedStudent?.id === stu.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
                onClick={() => setSelectedStudent(stu)}
                data-testid={`student-option-${stu.id}`}
              >
                <UserAvatar name={`${stu.prenom} ${stu.nom}`} size="sm" />
                <div className="flex-1">
                  <div className="font-medium text-foreground text-sm">{stu.prenom} {stu.nom}</div>
                  <div className="text-xs text-muted-foreground font-mono" style={{ fontFamily: "JetBrains Mono, monospace" }}>{stu.matricule}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-foreground">{stu.classe}</div>
                  {stu.soldeDu > 0 && <div className="text-xs text-red-500">Doit {formatCFA(stu.soldeDu)}</div>}
                </div>
              </div>
            ))}
            {searchQuery.length > 1 && filteredStudents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun étudiant trouvé</p>
            )}
            <button
              onClick={() => {
                if (selectedStudent) {
                  const rubs = getRubriquesForStudent(selectedStudent);
                  setSelectedRubriques([rubs[0]?.value ?? "inscription"]);
                  setMontantVerse(String(rubs[0]?.montant ?? ""));
                  setClasseId(selectedStudent.classeId && !selectedStudent.classe.includes("attente") ? "" : "");
                  setStep(2);
                }
              }}
              disabled={!selectedStudent}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors mt-4 flex items-center justify-center gap-2"
              data-testid="btn-next-step1"
            >
              Suivant <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 2 && selectedStudent && (
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
              <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="sm" />
              <div>
                <div className="font-semibold text-foreground text-sm">{selectedStudent.prenom} {selectedStudent.nom}</div>
                <div className="text-xs text-muted-foreground">{selectedStudent.classe} · Solde dû : <span className="text-red-500 font-medium">{formatCFA(selectedStudent.soldeDu)}</span></div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Rubriques de la facture *</label>
              <div className="space-y-2">
                {rubriques.map((r) => {
                  const checked = selectedRubriques.includes(r.value);
                  return (
                    <label
                      key={r.value}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? selectedRubriques.filter((v) => v !== r.value)
                              : [...selectedRubriques, r.value];
                            if (next.length === 0) return;
                            setSelectedRubriques(next);
                            const total = rubriques
                              .filter((x) => next.includes(x.value))
                              .reduce((s, x) => s + x.montant, 0);
                            setMontantVerse(String(total));
                          }}
                          className="w-4 h-4 rounded border-border text-primary"
                        />
                        <span className="text-sm font-medium text-foreground">{r.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{formatCFA(r.montant)}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between mt-3 pt-3 border-t border-border text-sm font-bold">
                <span>Total facture</span>
                <span className="text-primary">{formatCFA(totalFacture)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant versé (FCFA) *</label>
                <input
                  type="number"
                  value={montantVerse}
                  onChange={(e) => setMontantVerse(e.target.value)}
                  placeholder={String(totalFacture)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                  data-testid="input-montant"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date d&apos;opération *</label>
                <input type="date" value={dateOperation} onChange={(e) => setDateOperation(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut du paiement *</label>
              <select value={statutPaiement} onChange={(e) => setStatutPaiement(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                {STATUTS_PAIEMENT.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-3">Mode de paiement *</label>
              <div className="grid grid-cols-3 gap-2">
                {MODES_PAIEMENT.map((m) => {
                  const colors = MOYEN_COLORS[m.key] ?? { color: "#64748b", bg: "#f8fafc" };
                  return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSelectedMoyen(m.key)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-semibold",
                      selectedMoyen === m.key ? "border-current" : "border-border hover:border-muted-foreground"
                    )}
                    style={selectedMoyen === m.key ? { background: colors.bg, color: colors.color, borderColor: colors.color } : {}}
                    data-testid={`moyen-${m.key}`}
                  >
                    <div className="w-5 h-5 rounded-full" style={{ background: colors.color }} />
                    {m.label}
                  </button>
                );})}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">N° reçu / Référence</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Auto si vide"
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
              />
            </div>

            {statutPaiement === "paye" && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Affecter à une classe {needsClasse ? "*" : "(optionnel)"}
                </label>
                <select
                  value={classeId}
                  onChange={(e) => setClasseId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">
                    {selectedStudent.classeId && !selectedStudent.classe.includes("attente")
                      ? `Conserver ${selectedStudent.classe}`
                      : "Choisir la classe pédagogique"}
                  </option>
                  {classes
                    .filter((c) => c.filiereId === selectedStudent.filiereId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.nom} · {c.niveau} ({c.inscrits}/{c.max})</option>
                    ))}
                </select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  L&apos;affectation en classe pédagogique se fait après validation du paiement.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                <ArrowLeft size={16} /> Retour
              </button>
              <button
                onClick={() => canConfirmStep2 && setStep(3)}
                disabled={!canConfirmStep2 || !montantVerse}
                className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                Confirmer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && selectedStudent && (
          <div className="bg-card border border-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Paiement enregistré</h3>
                <p className="text-sm text-muted-foreground mt-1">Reçu généré — redirection...</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ClipboardCheck size={24} className="text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Confirmation — facture unique</h3>
                </div>
                <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3 mb-6">
                  <div className="flex justify-between text-sm border-b border-border pb-2">
                    <span className="text-muted-foreground">Étudiant</span>
                    <span className="font-medium">{selectedStudent.prenom} {selectedStudent.nom}</span>
                  </div>
                  <div className="space-y-1.5 border-b border-border pb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Détail</p>
                    {lignes.map((l) => (
                      <div key={l.label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{l.label}</span>
                        <span>{formatCFA(l.montant)}</span>
                      </div>
                    ))}
                  </div>
                  {[
                    { label: "Montant versé", value: formatCFA(parseInt(montantVerse || "0", 10)), primary: true },
                    { label: "Date", value: dateOperation },
                    { label: "Statut", value: STATUTS_PAIEMENT.find((s) => s.value === statutPaiement)?.label },
                    { label: "Moyen", value: MODES_PAIEMENT.find((m) => m.key === selectedMoyen)?.label },
                    ...(classeId
                      ? [{ label: "Classe", value: classes.find((c) => c.id === classeId)?.nom }]
                      : []),
                    ...(reference ? [{ label: "Référence", value: reference, mono: true }] : []),
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={cn("font-medium text-foreground", "mono" in row && row.mono && "font-mono text-xs", row.primary && "text-primary font-bold text-base")}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex items-center gap-2 flex-1 justify-center py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
                    <ArrowLeft size={16} /> Retour
                  </button>
                  <button onClick={handleSubmit} className="flex items-center gap-2 flex-1 justify-center py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors">
                    <Check size={16} /> Valider et Générer Reçu
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
