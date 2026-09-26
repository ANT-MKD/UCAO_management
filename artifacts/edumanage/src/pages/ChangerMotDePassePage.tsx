import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { GraduationCap, KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { definirMotDePasseDefinitif } from "@/data/studentStore";
import { isPasswordValid, PASSWORD_HINT } from "@/lib/passwordPolicy";

const inputClass =
  "w-full px-4 py-3 text-sm border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl bg-white dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition-all";

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
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-white dark:bg-[#0d1117]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 bg-[#4f46e5] rounded-lg flex items-center justify-center">
            <GraduationCap size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>
            Edu<span style={{ color: "#4f46e5" }}>Manage</span>
          </span>
        </div>
        <h1 className="text-2xl font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
          Choisissez votre mot de passe
        </h1>
        <p className="text-sm text-[#64748b] mb-6">
          {currentUser.name}, vous vous êtes connecté avec un mot de passe provisoire. Choisissez un mot de passe personnel
          pour accéder à votre espace.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="nouveau-mdp" className="block text-xs font-medium text-[#64748b] mb-1.5">Nouveau mot de passe</label>
            <input id="nouveau-mdp" type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className={inputClass} placeholder="••••••••" data-testid="input-nouveau-mdp" />
            <p className="text-[11px] text-[#94a3b8] mt-1">{PASSWORD_HINT}</p>
          </div>
          <div>
            <label htmlFor="confirmation-mdp" className="block text-xs font-medium text-[#64748b] mb-1.5">Confirmer le mot de passe</label>
            <input id="confirmation-mdp" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={inputClass} placeholder="••••••••" data-testid="input-confirmation-mdp" />
          </div>

          {erreur && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl" role="alert">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">{erreur}</p>
            </div>
          )}

          <button
            type="button"
            onClick={valider}
            className="w-full h-12 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            data-testid="button-valider-mdp"
          >
            <CheckCircle2 size={15} /> Enregistrer et continuer
          </button>
          <button
            type="button"
            onClick={() => { logout(); setLocation("/login"); }}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-[#64748b] hover:text-[#4f46e5]"
          >
            <KeyRound size={12} /> Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
