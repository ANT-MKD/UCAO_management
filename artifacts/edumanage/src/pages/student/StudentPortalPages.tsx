import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentStore, useSeances, useNotes, usePaiements } from "@/hooks/useStudentStore";
import { useUes, useEcs } from "@/hooks/useCurriculumStore";
import { formatCFA, formatDate } from "@/lib/utils";

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

export function StudentGradesPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const notes = useNotes();
  const ecs = useEcs();
  const ues = useUes();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const published = notes.filter((n) => n.etudiantId === student?.id && n.statut === "publie");

  const byUe = useMemo(() => {
    const map = new Map<string, { ueLabel: string; credits: number; rows: typeof published; moyenne?: number }>();
    for (const n of published) {
      const ec = ecs.find((e) => e.id === n.ecId);
      const ue = ues.find((u) => u.id === ec?.ueId);
      const key = ue?.id ?? "autre";
      if (!map.has(key)) map.set(key, { ueLabel: ue ? `${ue.code} — ${ue.libelle}` : "Hors maquette", credits: ue?.credits ?? 0, rows: [] });
      map.get(key)!.rows.push(n);
    }
    for (const block of map.values()) {
      const byEc = new Map<string, { cc?: number; ef?: number }>();
      for (const n of block.rows) {
        const cur = byEc.get(n.ecId) ?? {};
        if (n.type === "CC") cur.cc = n.note;
        else cur.ef = n.note;
        byEc.set(n.ecId, cur);
      }
      const moyennes = [...byEc.values()].map((v) => {
        if (v.cc !== undefined && v.ef !== undefined) return v.cc * 0.3 + v.ef * 0.7;
        return v.cc ?? v.ef ?? 0;
      });
      if (moyennes.length) block.moyenne = moyennes.reduce((a, b) => a + b, 0) / moyennes.length;
    }
    return [...map.values()];
  }, [published, ecs, ues]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Notes & maquette</h2>
        <p className="text-sm text-muted-foreground mt-1">Notes publiées — structure UE → EC (CC 30% / Examen 70%)</p>
      </div>
      {byUe.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Aucune note publiée.</p>
      ) : byUe.map((block) => (
        <div key={block.ueLabel} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex justify-between mb-3">
            <h3 className="font-bold text-sm">{block.ueLabel}</h3>
            <span className="text-xs text-muted-foreground">
              {block.credits} ECTS
              {block.moyenne !== undefined && ` · Moy. ${block.moyenne.toFixed(2)}`}
            </span>
          </div>
          <div className="space-y-2">
            {block.rows.map((n) => (
              <div key={n.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 py-2">
                <div>
                  <p className="font-medium">{n.ec}</p>
                  <p className="text-xs text-muted-foreground">{n.type === "EF" ? "Examen (70%)" : n.type === "CC" ? "CC (30%)" : n.type}</p>
                </div>
                <span className={`font-bold ${n.note >= 10 ? "text-emerald-600" : "text-red-500"}`}>{n.note}/20</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StudentPaymentsPage() {
  const { currentUser } = useAuth();
  const students = useStudentStore();
  const paiements = usePaiements();
  const student = students.find((s) => s.id === currentUser?.linkedId) ?? students[0];
  const mine = paiements.filter((p) => p.etudiantId === student?.id);

  function printReceipt(p: (typeof mine)[0]) {
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Paiements & reçus</h2>
          <p className="text-sm text-muted-foreground mt-1">Historique des règlements</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Solde dû</p>
          <p className={`text-xl font-bold ${(student?.soldeDu ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>
            {formatCFA(student?.soldeDu ?? 0)}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Aucun paiement.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Rubrique</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Reçu</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {mine.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{formatDate(p.date)}</td>
                  <td className="px-4 py-3">{p.rubrique}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{formatCFA(p.montant)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.numeroRecu || p.reference}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{p.statut}</span></td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => printReceipt(p)} className="text-xs text-primary hover:underline">Imprimer</button>
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
    </div>
  );
}
