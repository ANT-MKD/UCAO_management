import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Eye, CreditCard, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useSeances, useNotes, usePaiementsByEtudiant, useReleves, useCahiers } from "@/hooks/useStudentStore";
import { useUes, useEcs } from "@/hooks/useCurriculumStore";
import { useModesPaiementFinance } from "@/hooks/useFinanceSettingsStore";
import { formatCFA, formatDate, formatShortDate, moyenPaiementColor, cn } from "@/lib/utils";
import { DOCUMENTS_INSCRIPTION } from "@/lib/inscriptionConstants";
import { resolveBulletin, BulletinPreviewModal } from "@/pages/admin/RelevesPage";
import { montantQuittance } from "@/pages/admin/PaiementsPage";
import { useMentions } from "@/hooks/useMentionsStore";
import { useDeliberations } from "@/hooks/useDeliberationStore";
import { payerQuittance } from "@/data/studentStore";
import { enregistrerEncaissement } from "@/data/encaissementStore";
import { getAssiduiteRowsPourEtudiant, getTauxPresencePourEtudiant } from "@/data/assiduiteEngine";
import type { ReleveRecord } from "@/data/studentStore";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function StudentSchedulePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const seances = useSeances();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const mine = useMemo(
    () => seances.filter((s) => s.classeId === student?.classeId).sort((a, b) => a.jour - b.jour || a.heureDebut.localeCompare(b.heureDebut)),
    [seances, student?.classeId],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Emploi du temps</h2>
        <p className="text-sm text-muted-foreground mt-1">{student?.classe} · {student?.filiere}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucune séance pour votre classe.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Jour</th>
                <th className="px-4 py-3">Horaire</th>
                <th className="px-4 py-3">Module (EC)</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Salle</th>
                <th className="px-4 py-3">Professeur</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{JOURS[s.jour] ?? s.jour}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.heureDebut} – {s.heureFin}</td>
                  <td className="px-4 py-3">{s.ec}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-muted">{s.type}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{s.salle}</td>
                  <td className="px-4 py-3">{s.prof}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function StudentNotesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const notes = useNotes();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const published = notes.filter((n) => n.etudiantId === student?.id && n.statut === "publie");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes notes</h2>
        <p className="text-sm text-muted-foreground mt-1">Notes publiées, détail par module (EC)</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {published.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucune note publiée pour l'instant.</p>
        ) : (
          <div className="space-y-2">
            {published.map((n) => (
              <div key={n.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2.5">
                <p className="font-medium">{n.ec}</p>
                <span className={`font-bold ${n.note >= 10 ? "text-emerald-600" : "text-red-500"}`}>{n.note}/20</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StudentRelevesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const releves = useReleves();
  useMentions(); // s'abonne pour refléter la vraie mention si la configuration change
  useDeliberations(); // s'abonne pour refléter la vraie décision de jury si une délibération change
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const mesReleves = releves.filter((r) => r.etudiantId === student?.id);
  const [previewReleve, setPreviewReleve] = useState<ReleveRecord | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Relevés & bulletins</h2>
        <p className="text-sm text-muted-foreground mt-1">Même moteur de calcul que le bulletin officiel — aucune moyenne recalculée séparément.</p>
      </div>

      {mesReleves.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">
          Aucun bulletin officiel disponible pour l'instant.
        </p>
      ) : (
        mesReleves.map((releve) => {
          const resolved = resolveBulletin(releve, students);
          return (
            <div key={releve.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-bold text-sm">{releve.semestre}</h3>
                  {resolved && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Moyenne <span className="font-bold text-foreground">{resolved.moyenne.toFixed(2)}/20</span> · Mention {resolved.mention} · Décision : <span className="font-medium">{resolved.decisionLabel}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setPreviewReleve(releve)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors flex-shrink-0"
                  data-testid={`portal-bulletin-apercu-${releve.id}`}
                >
                  <Eye size={13} /> Aperçu bulletin
                </button>
              </div>
              {resolved && (
                <div className="space-y-1.5">
                  {resolved.ues.map((ue) => (
                    <div key={ue.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-1.5">
                      <span className="font-medium">{ue.code} — {ue.libelle}</span>
                      <span className={`font-bold ${ue.moyenne !== undefined && ue.moyenne >= 10 ? "text-emerald-600" : "text-red-500"}`}>
                        {ue.moyenne !== undefined ? `${ue.moyenne.toFixed(2)}/20` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}

      {previewReleve && (
        <BulletinPreviewModal entry={previewReleve} resolved={resolveBulletin(previewReleve, students)} onClose={() => setPreviewReleve(null)} />
      )}
    </div>
  );
}

function printRecu(p: import("@/data/studentStore").PaiementRecord) {
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  const lignesHtml =
    p.lignes && p.lignes.length > 0
      ? p.lignes
          .map(
            (l) =>
              `<tr><td style="padding-left:12px;color:#666">${l.label}</td><td>${l.montant.toLocaleString("fr-FR")} FCFA</td></tr>`,
          )
          .join("")
      : `<tr><td>Rubrique</td><td>${p.rubrique}</td></tr>`;
  w.document.write(`<!DOCTYPE html><html><head><title>${p.numeroRecu}</title>
    <style>body{font-family:system-ui;padding:24px}h1{font-size:18px}table{width:100%;margin-top:16px}td{padding:6px 0;border-bottom:1px solid #eee}</style>
    </head><body>
    <h1>EduManage — Reçu de paiement</h1>
    <p>N° ${p.numeroRecu || p.reference}</p>
    <table>
      <tr><td>Date</td><td>${p.date}</td></tr>
      <tr><td>Étudiant</td><td>${p.etudiant}</td></tr>
      <tr><td colspan="2"><strong>Détail facture</strong></td></tr>
      ${lignesHtml}
      <tr><td>Montant versé</td><td><strong>${p.montant.toLocaleString("fr-FR")} FCFA</strong></td></tr>
      <tr><td>Moyen</td><td>${p.moyen}</td></tr>
      <tr><td>Statut</td><td>${p.statut}</td></tr>
      <tr><td>Solde restant</td><td>${p.soldeRestant.toLocaleString("fr-FR")} FCFA</td></tr>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#666">Document généré automatiquement</p>
    <script>window.print()</script>
    </body></html>`);
  w.document.close();
}

export function StudentFraisPayePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const payes = paiements.filter((p) => p.statut !== "annule" && p.montant > 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Frais payés</h2>
          <p className="text-sm text-muted-foreground mt-1">Historique des règlements effectivement encaissés</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total réglé</p>
          <p className="text-xl font-bold text-emerald-600">{formatCFA(payes.reduce((s, p) => s + p.montant, 0))}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {payes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucun paiement enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Rubrique</th>
                <th className="px-4 py-3">Moyen</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Reçu</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payes.map((p) => {
                const c = moyenPaiementColor(p.moyen || "—");
                return (
                  <tr key={p.id} className="border-b border-border last:border-0" data-testid={`frais-paye-${p.id}`}>
                    <td className="px-4 py-3">{formatDate(p.date)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">{p.rubrique}</div>
                      {p.lignes && p.lignes.length > 1 && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">{p.lignes.map((l) => l.label).join(" · ")}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.moyen && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: c.color, background: c.bg }}>{p.moyen}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{formatCFA(p.montant)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.numeroRecu || p.reference}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => printRecu(p)} className="text-xs text-primary hover:underline">Imprimer</button>
                    </td>
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

export function StudentFraisImpayePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const impayes = paiements.filter((p) => p.statut !== "annule" && p.montant < montantQuittance(p));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Frais impayés</h2>
          <p className="text-sm text-muted-foreground mt-1">Factures en attente de règlement</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Solde dû</p>
          <p className={`text-xl font-bold ${(student?.soldeDu ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{formatCFA(student?.soldeDu ?? 0)}</p>
        </div>
      </div>
      {impayes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune facture impayée — vous êtes à jour.</p>
      ) : (
        <div className="space-y-2">
          {impayes.map((p) => {
            const reste = montantQuittance(p) - p.montant;
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-3" data-testid={`frais-impaye-${p.id}`}>
                <div>
                  <p className="text-sm font-medium text-foreground">{p.rubrique}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Émise le {formatDate(p.date)}{p.dateLimite && ` · échéance ${formatShortDate(p.dateLimite)}`}
                    {p.montant > 0 && ` · ${formatCFA(p.montant)} déjà réglé`}
                  </p>
                </div>
                <p className="text-lg font-bold text-red-500">{formatCFA(reste)}</p>
              </div>
            );
          })}
        </div>
      )}
      <Link
        href="/student/payer-factures"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <CreditCard size={15} /> Payer en ligne
      </Link>
    </div>
  );
}

const MOYENS_PAIEMENT_EN_LIGNE = ["wave", "orange"];

export function StudentPayerFacturesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const paiements = usePaiementsByEtudiant(student?.id ?? "");
  const modesPaiement = useModesPaiementFinance();
  const modesEnLigne = modesPaiement.filter((m) => MOYENS_PAIEMENT_EN_LIGNE.some((k) => m.intitule.toLowerCase().includes(k)));
  const impayes = paiements.filter((p) => p.statut !== "annule" && p.montant < montantQuittance(p));

  const [selectedId, setSelectedId] = useState<string>("");
  const [montant, setMontant] = useState<number>(0);
  const [moyen, setMoyen] = useState<string>("");
  const [numero, setNumero] = useState("");
  const [paying, setPaying] = useState(false);

  const selected = impayes.find((p) => p.id === selectedId);
  const resteSelected = selected ? montantQuittance(selected) - selected.montant : 0;

  const selectQuittance = (id: string) => {
    setSelectedId(id);
    const p = impayes.find((x) => x.id === id);
    setMontant(p ? montantQuittance(p) - p.montant : 0);
  };

  const handlePayer = () => {
    if (!student || !selected || !moyen || montant <= 0) return;
    if (montant > resteSelected) {
      toast.error("Le montant dépasse le reste dû sur cette facture.");
      return;
    }
    if (!numero.trim()) {
      toast.error("Indiquez le numéro utilisé pour la transaction (téléphone Wave/Orange Money).");
      return;
    }
    setPaying(true);
    const date = new Date().toISOString().slice(0, 10);
    const reference = `${moyen.toUpperCase().replace(/\s+/g, "-")}-${numero.trim()}`;
    const quittanceLignes = selected.lignes && selected.lignes.length > 0 ? selected.lignes : [{ label: selected.rubrique, montant: montantQuittance(selected) }];
    const dejaPayeAvant = selected.montant;
    payerQuittance({ id: selected.id, montant, moyen, reference, date });
    enregistrerEncaissement({
      quittanceId: selected.id,
      quittanceReference: selected.numeroRecu,
      quittanceDateEmission: selected.date,
      quittanceDateLimite: selected.dateLimite,
      montantQuittanceTotal: montantQuittance(selected),
      quittanceLignes,
      dejaPayeAvant,
      etudiantId: student.id,
      payeur: `${student.matricule} - ${student.prenom} ${student.nom}`,
      filiere: student.filiere,
      annee: student.annee,
      montant,
      moyen,
      referenceBancaire: reference,
      date,
      encaissePar: `${student.prenom} ${student.nom} (paiement en ligne)`,
    });
    toast.success("Paiement enregistré — merci !");
    setSelectedId("");
    setMontant(0);
    setMoyen("");
    setNumero("");
    setPaying(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Payer une facture en ligne</h2>
        <p className="text-sm text-muted-foreground mt-1">Solde dû : <span className={(student?.soldeDu ?? 0) > 0 ? "text-red-500 font-semibold" : "text-emerald-600 font-semibold"}>{formatCFA(student?.soldeDu ?? 0)}</span></p>
      </div>

      <div className="flex items-start gap-2.5 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
        <ShieldAlert size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Simulation de paiement en ligne — aucune passerelle Wave/Orange Money réelle n'est branchée (mode démo). Le règlement saisi ici est cependant enregistré comme un vrai paiement dans votre dossier, exactement comme s'il avait été encaissé par l'administration.
        </p>
      </div>

      {impayes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucune facture à régler — vous êtes à jour.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Facture à régler <span className="text-red-500">*</span></label>
            <select
              value={selectedId}
              onChange={(e) => selectQuittance(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="payer-facture-select"
            >
              <option value="">— Sélectionner —</option>
              {impayes.map((p) => (
                <option key={p.id} value={p.id}>{p.rubrique} — reste {formatCFA(montantQuittance(p) - p.montant)}</option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Montant à payer (max {formatCFA(resteSelected)}) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    max={resteSelected}
                    value={montant || ""}
                    onChange={(e) => setMontant(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="payer-facture-montant"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Moyen de paiement <span className="text-red-500">*</span></label>
                  <select
                    value={moyen}
                    onChange={(e) => setMoyen(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="payer-facture-moyen"
                  >
                    <option value="">— Sélectionner —</option>
                    {modesEnLigne.map((m) => (
                      <option key={m.id} value={m.intitule}>{m.intitule}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Numéro utilisé pour la transaction <span className="text-red-500">*</span></label>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="ex: 77 000 00 00"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  data-testid="payer-facture-numero"
                />
              </div>
              <button
                type="button"
                onClick={handlePayer}
                disabled={paying || !moyen || montant <= 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                data-testid="payer-facture-confirmer"
              >
                <CreditCard size={15} /> {paying ? "Paiement en cours…" : `Payer ${formatCFA(montant)}`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function StudentProfilePage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  if (!student) return <p className="text-sm text-muted-foreground">Profil introuvable.</p>;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4 max-w-2xl">
      <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mon profil</h2>
      <p className="text-xs text-muted-foreground">Le matricule est définitif dès la 1ère inscription.</p>
      {[
        ["Matricule", student.matricule],
        ["Nom", `${student.prenom} ${student.nom}`],
        ["Email", student.email],
        ["Téléphone", student.telephone || "—"],
        ["Filière", student.filiere],
        ["Niveau", student.niveau],
        ["Classe pédagogique", student.classe],
        ["Année", student.annee],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-border py-2 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value}</span>
        </div>
      ))}

      {(student.documentsFournis?.length ?? 0) > 0 && (
        <div className="pt-3 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
            Pièces justificatives déposées
          </h3>
          <ul className="space-y-1 text-sm">
            {student.documentsFournis!.map((docId) => {
              const label = DOCUMENTS_INSCRIPTION.find((d) => d.id === docId)?.label ?? docId;
              return (
                <li key={docId} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{docId}</span>
                  <span className="text-foreground font-medium">{label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function StudentCoursPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const ues = useUes();
  const ecs = useEcs();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const mesUes = useMemo(
    () => ues.filter((u) => u.filiereId === student?.filiereId && u.niveau === student?.niveau).sort((a, b) => a.semestre.localeCompare(b.semestre) || a.code.localeCompare(b.code)),
    [ues, student?.filiereId, student?.niveau],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Mes cours</h2>
        <p className="text-sm text-muted-foreground mt-1">{student?.filiere} · {student?.niveau} — maquette pédagogique</p>
      </div>
      {mesUes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 rounded-2xl border border-dashed border-border">Aucun cours configuré pour votre filière/niveau.</p>
      ) : (
        mesUes.map((ue) => {
          const mesEcs = ecs.filter((e) => e.ueId === ue.id);
          return (
            <div key={ue.id} className="rounded-2xl border border-border bg-card p-5" data-testid={`cours-ue-${ue.id}`}>
              <div className="flex items-center justify-between gap-3 mb-1">
                <h3 className="font-bold text-sm">{ue.code} — {ue.libelle}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">{ue.semestre}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{ue.credits} crédits · {ue.type}{ue.description && ` · ${ue.description}`}</p>
              {mesEcs.length > 0 && (
                <div className="space-y-1.5">
                  {mesEcs.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-1.5">
                      <div>
                        <span className="font-medium">{e.code} — {e.libelle}</span>
                        <p className="text-[11px] text-muted-foreground">{e.responsable || "Responsable non assigné"}</p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{e.credits} cr. · {e.vht}h</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export function StudentAbsencesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  useCahiers(); // s'abonne pour refléter les cahiers de séance réellement soumis
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const rows = student ? getAssiduiteRowsPourEtudiant(student.id) : [];
  const taux = student ? getTauxPresencePourEtudiant(student.id) : { present: 0, total: 0, pct: 100 };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Absences & retards</h2>
          <p className="text-sm text-muted-foreground mt-1">Constatés à partir des cahiers de séance réellement soumis</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Taux de présence</p>
          <p className={`text-xl font-bold ${taux.pct >= 80 ? "text-emerald-600" : "text-red-500"}`}>{taux.pct}%</p>
          <p className="text-[11px] text-muted-foreground">{taux.present}/{taux.total} séances</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucune absence ni retard constaté.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Module (EC)</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Justifié</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0" data-testid={`absence-ligne-${r.id}`}>
                  <td className="px-4 py-3">{formatDate(r.date)}</td>
                  <td className="px-4 py-3">{r.ec}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", r.type === "absence" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700")}>
                      {r.type === "absence" ? "Absence" : `Retard${r.retardMinutes ? ` (${r.retardMinutes} min)` : ""}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.justifie ? (
                      <span className="text-xs text-emerald-600 font-medium">Justifié{r.justification ? ` — ${r.justification}` : ""}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Non justifié</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
