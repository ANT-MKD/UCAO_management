import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { LogOut, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { definirMotDePasseDefinitif } from "@/data/studentStore";
import { isPasswordValid, PASSWORD_HINT } from "@/lib/passwordPolicy";
import { CadreConnexion, EtapesAide, champConnexion, etiquetteChamp, boutonPrincipal } from "@/components/site/CadreConnexion";
import { DISPLAY } from "@/components/site/Decor";

function accueil(role: string): string {
  if (role === "admin") return "/admin/dashboard";
  if (role === "teacher") return "/teacher/dashboard";
  return "/student/dashboard";
}

/** Étape obligatoire après une connexion avec un mot de passe provisoire (remis par
 * l'administration, ou mot de passe initial du compte d'origine) : aucun portail n'est accessible
 * tant qu'un mot de passe personnel n'a pas été choisi. */
export default function ChangerMotDePassePage() {
  const { currentUser, logout, confirmerMotDePasseChange } = useAuth();
  const [, setLocation] = useLocation();
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");

  if (!currentUser) return <Redirect to="/login" />;
  if (!currentUser.doitChangerMotDePasse) return <Redirect to={accueil(currentUser.role)} />;

  const valider = () => {
    setErreur("");
    if (!isPasswordValid(nouveau)) { setErreur(`Le mot de passe doit contenir ${PASSWORD_HINT.toLowerCase()}.`); return; }
    if (nouveau !== confirmation) { setErreur("Les deux mots de passe ne correspondent pas."); return; }
    const res = definirMotDePasseDefinitif(currentUser.id, nouveau);
    if (!res.ok) { setErreur(res.reason ?? "Mot de passe refusé."); return; }
    confirmerMotDePasseChange();
    toast.success("Mot de passe enregistré.");
    setLocation(accueil(currentUser.role));
  };

  return (
    <CadreConnexion
      etiquette="Première connexion"
      titre={<>Choisissez votre<br /><span className="text-[#4f46e5] dark:text-[#a5b4fc]">mot de passe.</span></>}
      intro={<>{currentUser.name}, vous vous êtes connecté avec un mot de passe provisoire. Choisissez-en un personnel pour accéder à votre espace.</>}
      retourAccueil={false}
      aide={(
        <EtapesAide
          etapes={[
            { titre: "Au moins 6 caractères", texte: "Plus il est long, plus il est sûr : une courte phrase se retient facilement." },
            { titre: "Gardez-le pour vous", texte: "L'administration ne vous le demandera jamais." },
            { titre: "Oublié plus tard ?", texte: "« Mot de passe oublié ? » sur l'écran de connexion : un code vous sera remis au secrétariat." },
          ]}
        />
      )}
    >
      <h2 className="text-2xl font-extrabold tracking-tight mb-1.5" style={DISPLAY}>Nouveau mot de passe</h2>
      <p className="text-sm text-[#5d5a7a] dark:text-[#a3a6c2] mb-6">Il remplacera le mot de passe provisoire.</p>
      <div className="space-y-4">
        <div>
          <label htmlFor="nouveau-mdp" className={etiquetteChamp}>Nouveau mot de passe</label>
          <input id="nouveau-mdp" type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className={champConnexion} placeholder="••••••••" data-testid="input-nouveau-mdp" />
          <p className="text-xs text-[#6b6889] dark:text-[#a3a6c2] mt-1.5">{PASSWORD_HINT}</p>
        </div>
        <div>
          <label htmlFor="confirmation-mdp" className={etiquetteChamp}>Confirmer le mot de passe</label>
          <input id="confirmation-mdp" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={champConnexion} placeholder="••••••••" data-testid="input-confirmation-mdp" />
        </div>
        {erreur && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-2xl" role="alert">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-700 dark:text-red-300">{erreur}</p>
          </div>
        )}
        <button type="button" onClick={valider} className={boutonPrincipal} data-testid="button-valider-mdp">
          <CheckCircle2 size={16} /> Enregistrer et continuer
        </button>
        <button
          type="button"
          onClick={() => { logout(); setLocation("/login"); }}
          className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#5d5a7a] dark:text-[#a3a6c2] hover:text-[#17133a] dark:hover:text-white"
        >
          <LogOut size={14} /> Se déconnecter
        </button>
      </div>
    </CadreConnexion>
  );
}
