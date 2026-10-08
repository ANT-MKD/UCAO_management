import { useState } from "react";
import { ShieldCheck, CalendarRange, AlertTriangle, CheckCircle2 } from "lucide-react";
import { champConnexion, etiquetteChamp, boutonPrincipal } from "@/components/site/CadreConnexion";
import { DISPLAY, MONO } from "@/components/site/Decor";
import { installerEtablissement } from "@/data/studentStore";

const inputClass = champConnexion;
const labelClass = etiquetteChamp;

/** Année académique la plus probable à la date du jour : à partir d'août, l'année qui commence. */
function anneeProposee(): string {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

/** Écran de toute première ouverture : aucun compte n'existe encore. On crée ici le premier super
 * administrateur (qui choisit lui-même son mot de passe) et l'année académique en cours avec ses
 * dates réelles — il n'y a plus ni compte ni mot de passe livrés par défaut. */
export function PremiereInstallation({ onInstalled }: { onInstalled: (identifier: string, password: string) => void }) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [libelle, setLibelle] = useState(anneeProposee());
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [erreur, setErreur] = useState("");

  const valider = () => {
    setErreur("");
    if (password !== confirmation) { setErreur("Les deux mots de passe ne correspondent pas."); return; }
    try {
      installerEtablissement({ prenom, nom, identifier, email, password, annee: { libelle: libelle.trim(), dateDebut, dateFin } });
      onInstalled(identifier.trim().toUpperCase(), password);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Installation impossible.");
    }
  };

  return (
    <div data-testid="installation">
      <h2 className="text-2xl font-extrabold tracking-tight mb-1.5" style={DISPLAY}>Installation d&apos;EduManage</h2>
      <p className="text-sm text-[#5d5a7a] dark:text-[#a3a6c2] mb-6">
        Créez le compte de l&apos;administrateur principal et l&apos;année académique en cours.
      </p>

      <div className="space-y-6">
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold text-[#4f46e5] dark:text-[#a5b4fc]" style={MONO}><ShieldCheck size={15} className="text-[#4f46e5]" /> Administrateur principal</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label htmlFor="inst-prenom" className={labelClass}>Prénom</label><input id="inst-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} className={inputClass} data-testid="inst-prenom" /></div>
            <div><label htmlFor="inst-nom" className={labelClass}>Nom</label><input id="inst-nom" value={nom} onChange={(e) => setNom(e.target.value)} className={inputClass} data-testid="inst-nom" /></div>
          </div>
          <div><label htmlFor="inst-identifiant" className={labelClass}>Identifiant de connexion</label><input id="inst-identifiant" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="ex : ADM-SCOLARITE" className={inputClass} data-testid="inst-identifiant" /></div>
          <div><label htmlFor="inst-email" className={labelClass}>E-mail professionnel</label><input id="inst-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="scolarite@ucao.sn" className={inputClass} data-testid="inst-email" /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label htmlFor="inst-mdp" className={labelClass}>Mot de passe (8 caractères min.)</label><input id="inst-mdp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} data-testid="inst-mdp" /></div>
            <div><label htmlFor="inst-mdp2" className={labelClass}>Confirmation</label><input id="inst-mdp2" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} data-testid="inst-mdp2" /></div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold text-[#4f46e5] dark:text-[#a5b4fc]" style={MONO}><CalendarRange size={15} className="text-[#4f46e5]" /> Année académique en cours</h3>
          <div><label htmlFor="inst-annee" className={labelClass}>Année (format 2026-2027)</label><input id="inst-annee" value={libelle} onChange={(e) => setLibelle(e.target.value)} className={inputClass} data-testid="inst-annee" /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label htmlFor="inst-debut" className={labelClass}>Date de rentrée</label><input id="inst-debut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} data-testid="inst-debut" /></div>
            <div><label htmlFor="inst-fin" className={labelClass}>Date de fin</label><input id="inst-fin" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} data-testid="inst-fin" /></div>
          </div>
        </section>

        {erreur && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-2xl" role="alert">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-700 dark:text-red-300">{erreur}</p>
          </div>
        )}

        <button type="button" onClick={valider} className={boutonPrincipal} data-testid="inst-valider">
          <CheckCircle2 size={15} /> Installer et me connecter
        </button>
      </div>
    </div>
  );
}
