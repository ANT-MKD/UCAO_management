import type { CodeEtudiant } from "@/data/comptesAdmin";
import { getEtablissement } from "@/data/etablissementStore";

/** Liste imprimée des codes d'une classe (partie 10, lot 1) : à distribuer contre signature, puis à
 * détruire. Chaque étudiant y trouve son matricule, son code et la marche à suivre. */

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const date = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function htmlCodesClasse(classe: string, lignes: CodeEtudiant[], adresse: string): string {
  const etablissement = getEtablissement().nom || "Établissement";
  const fin = lignes.find((l) => l.expireLe)?.expireLe;
  const rangs = lignes.map((l, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="mono">${echapper(l.matricule)}</td>
        <td>${echapper(l.nomComplet)}</td>
        <td class="code">${l.code ? echapper(l.code) : `<em>${echapper(l.motif ?? "sans code")}</em>`}</td>
        <td></td>
        <td></td>
      </tr>`).join("");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Codes d'accès — ${echapper(classe)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
    h1 { font-size: 18px; margin: 0 0 2px; }
    .entete { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
    .confidentiel { font-weight: bold; color: #b42330; text-transform: uppercase; letter-spacing: .05em; font-size: 11px; }
    .marche { border: 1px solid #999; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
    .marche ol { margin: 4px 0 0; padding-left: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 5px 6px; text-align: left; vertical-align: middle; }
    th { background: #eee; font-size: 11px; }
    .num { width: 28px; text-align: right; }
    .mono { font-family: "Courier New", monospace; }
    .code { font-family: "Courier New", monospace; font-size: 15px; font-weight: bold; letter-spacing: .15em; width: 110px; }
    .code em { font-family: Arial, sans-serif; font-size: 11px; font-weight: normal; letter-spacing: 0; color: #555; }
    tr { page-break-inside: avoid; }
    .pied { margin-top: 10px; font-size: 10px; color: #555; }
  </style></head><body>
    <div class="entete">
      <div><h1>Codes d'accès à EduManage — ${echapper(classe)}</h1>${echapper(etablissement)}</div>
      <div class="confidentiel">Confidentiel — à détruire après distribution</div>
    </div>
    <div class="marche">
      <strong>Pour choisir votre mot de passe</strong>${fin ? ` (codes valables jusqu'au ${date(fin)})` : ""} :
      <ol>
        <li>Ouvrez la page de connexion : <strong>${echapper(adresse)}</strong></li>
        <li>Cliquez sur « Mot de passe oublié ? », puis sur « J'ai déjà un code ».</li>
        <li>Saisissez votre matricule, votre code et le mot de passe de votre choix. Le code ne sert qu'une fois ; après 5 essais erronés, il est annulé.</li>
      </ol>
    </div>
    <table>
      <thead><tr><th class="num">N°</th><th>Matricule</th><th>Nom et prénom</th><th>Code</th><th>Remis le</th><th>Signature</th></tr></thead>
      <tbody>${rangs}</tbody>
    </table>
    <p class="pied">Liste éditée le ${date(new Date().toISOString())}. Chaque code remplace celui que l'étudiant avait reçu auparavant.</p>
    <script>window.onload = function () { window.print(); };</script>
  </body></html>`;
}

/** Ouvre la liste dans une nouvelle fenêtre et lance l'impression ; faux si le navigateur a bloqué
 * la fenêtre. */
export function imprimerCodesClasse(classe: string, lignes: CodeEtudiant[]): boolean {
  const fenetre = window.open("", "_blank", "width=900,height=1100");
  if (!fenetre) return false;
  fenetre.document.write(htmlCodesClasse(classe, lignes, `${window.location.origin}/login`));
  fenetre.document.close();
  return true;
}
