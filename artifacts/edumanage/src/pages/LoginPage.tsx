import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ArrowLeft, ArrowRight, AlertTriangle, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { findUserAccountByIdentifier, updateUserPassword, getUserAccounts, pushNotificationEtPersister, logAudit, installationRequise } from "@/data/studentStore";
import { PremiereInstallation } from "@/components/PremiereInstallation";
import { CadreConnexion, EtapesAide, champConnexion, etiquetteChamp, boutonPrincipal } from "@/components/site/CadreConnexion";
import { DISPLAY, MONO } from "@/components/site/Decor";
import { cn } from "@/lib/utils";
import { signalerDemandeReinitialisation, verifierEtConsommerPin } from "@/data/pinActivationStore";
import { isPasswordValid, PASSWORD_HINT } from "@/lib/passwordPolicy";

const loginSchema = z.object({
  identifier: z.string().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginForm = z.infer<typeof loginSchema>;

type Mode = "login" | "forgot-request" | "forgot-sent" | "forgot-reset";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<Mode>("login");
  // Aucun administrateur encore : première ouverture, on installe au lieu de se connecter.
  const [installation] = useState(() => installationRequise());
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  /** Aucun code n'est envoyé ni affiché ici : la demande prévient l'administration, qui vérifie
   * l'identité et remet un code en main propre. La réponse est la même que le compte existe ou non,
   * pour ne pas révéler quels identifiants sont valides. */
  const handleForgotRequest = () => {
    setForgotError("");
    const compte = findUserAccountByIdentifier(forgotIdentifier);
    if (compte && compte.actif !== false) {
      const nouvelle = signalerDemandeReinitialisation(compte.id, compte.displayName, compte.identifier);
      if (nouvelle) {
        logAudit(compte.id, "demande_reinitialisation_mdp", "user_account", compte.id);
        for (const admin of getUserAccounts().filter((u) => u.role === "admin" && u.actif !== false)) {
          pushNotificationEtPersister(admin.id, `Mot de passe oublié : ${compte.displayName} (${compte.identifier}) demande un code — Sécurité → Code pin activation.`);
        }
      }
    }
    setMode("forgot-sent");
  };

  const handleResetPassword = () => {
    setForgotError("");
    if (!forgotIdentifier.trim()) { setForgotError("Saisissez votre email ou matricule."); return; }
    if (!pinInput.trim()) { setForgotError("Saisissez le code remis par l'administration."); return; }
    if (!isPasswordValid(newPassword)) { setForgotError(`Le mot de passe doit contenir ${PASSWORD_HINT.toLowerCase()}.`); return; }
    if (newPassword !== confirmPassword) { setForgotError("Les deux mots de passe ne correspondent pas."); return; }
    const compte = findUserAccountByIdentifier(forgotIdentifier);
    // Même message que le compte existe ou non, et que le code soit faux ou expiré.
    if (!compte || !verifierEtConsommerPin(compte.id, pinInput.trim())) {
      setForgotError("Identifiant ou code invalide, déjà utilisé ou expiré. Après 5 essais erronés, le code est annulé.");
      return;
    }
    updateUserPassword(compte.id, newPassword);
    toast.success("Mot de passe réinitialisé — vous pouvez vous connecter.");
    setMode("login");
    setForgotIdentifier("");
    setPinInput("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    try {
      const user = login(data.identifier, data.password);
      setLoading(false);
      if (!user) {
        setError("Identifiants incorrects.");
        return;
      }
      if (user.doitChangerMotDePasse) setLocation("/changer-mot-de-passe");
      else if (user.role === "admin") setLocation("/admin/dashboard");
      else if (user.role === "teacher") setLocation("/teacher/dashboard");
      else setLocation("/student/dashboard");
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    }
  };

  const retourConnexion = (
    <button type="button" onClick={() => setMode("login")} className="flex items-center gap-1.5 text-[13px] font-semibold text-[#5d5a7a] dark:text-[#a3a6c2] hover:text-[#17133a] dark:hover:text-white mb-5">
      <ArrowLeft size={14} /> Retour à la connexion
    </button>
  );
  const messageErreur = (texte: string) => (
    <div className="flex items-start gap-2.5 p-3.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-2xl" role="alert">
      <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-[13px] text-red-700 dark:text-red-300">{texte}</p>
    </div>
  );

  const etapesOubli = [
    { titre: "Demandez un code", texte: "Saisissez votre matricule ou votre e-mail : l'administration est prévenue." },
    { titre: "Passez au secrétariat", texte: "Avec une pièce d'identité. Un code à 6 chiffres vous est remis, valable 24 heures." },
    { titre: "Choisissez un nouveau mot de passe", texte: "Saisissez le code reçu et votre nouveau mot de passe." },
  ];
  const etapeOubli = mode === "forgot-request" ? 0 : mode === "forgot-sent" ? 1 : 2;

  if (installation) {
    return (
      <CadreConnexion
        etiquette="Première ouverture"
        titre={<>Bienvenue dans<br /><span className="text-[#4f46e5] dark:text-[#a5b4fc]">EduManage.</span></>}
        intro="Cet écran n'apparaît qu'une seule fois : il crée le premier compte et l'année académique en cours."
        aide={(
          <EtapesAide
            active={0}
            etapes={[
              { titre: "Administrateur principal", texte: "Votre compte, avec un mot de passe que vous choisissez vous-même." },
              { titre: "Année académique en cours", texte: "Son libellé et ses dates réelles de rentrée et de fin." },
              { titre: "Ensuite", texte: "Créez le second administrateur, puis la structure : filières, niveaux, classes, maquette." },
            ]}
          />
        )}
      >
        <PremiereInstallation
          onInstalled={async (identifiant, motDePasse) => {
            try {
              await login(identifiant, motDePasse);
              toast.success("EduManage est installé. Bienvenue !");
              setLocation("/admin/dashboard");
            } catch {
              window.location.reload();
            }
          }}
        />
      </CadreConnexion>
    );
  }

  if (mode !== "login") {
    return (
      <CadreConnexion
        etiquette="Mot de passe oublié"
        titre={<>Retrouvez l&apos;accès<br /><span className="text-[#4f46e5] dark:text-[#a5b4fc]">à votre espace.</span></>}
        intro="Pour votre sécurité, aucun code n'est affiché ni envoyé automatiquement : l'administration vous le remet après avoir vérifié votre identité."
        aide={<EtapesAide etapes={etapesOubli} active={etapeOubli} />}
      >
        {mode === "forgot-request" && (
          <>
            {retourConnexion}
            <h2 className="text-2xl font-extrabold tracking-tight mb-1.5" style={DISPLAY}>Demander un code</h2>
            <p className="text-sm text-[#5d5a7a] dark:text-[#a3a6c2] mb-6">L&apos;administration sera prévenue de votre demande.</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="oubli-identifiant" className={etiquetteChamp}>Matricule, identifiant ou e-mail</label>
                <input
                  id="oubli-identifiant"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  type="text"
                  autoComplete="username"
                  placeholder="ex. 2025-LQHSE-0001"
                  className={champConnexion}
                  data-testid="input-forgot-identifier"
                />
              </div>
              {forgotError && messageErreur(forgotError)}
              <button type="button" onClick={handleForgotRequest} disabled={!forgotIdentifier.trim()} className={boutonPrincipal} data-testid="button-forgot-request">
                <KeyRound size={16} /> Demander un code
              </button>
              <button type="button" onClick={() => { setMode("forgot-reset"); setForgotError(""); }} className="w-full text-[13px] font-semibold text-[#4f46e5] dark:text-[#a5b4fc] hover:underline" data-testid="link-j-ai-un-code">
                J&apos;ai déjà un code
              </button>
            </div>
          </>
        )}

        {mode === "forgot-sent" && (
          <>
            {retourConnexion}
            <div className="w-12 h-12 rounded-full bg-[#c8f7d8] dark:bg-[#123b28] flex items-center justify-center mb-4"><CheckCircle2 size={22} className="text-[#047857] dark:text-[#86efac]" /></div>
            <h2 className="text-2xl font-extrabold tracking-tight mb-3" style={DISPLAY}>Demande transmise</h2>
            <div className="space-y-3 text-[15px] leading-relaxed text-[#3d3a5c] dark:text-[#c3c6dd]" data-testid="forgot-sent-message">
              <p>Si un compte correspond à cet identifiant, l&apos;administration a été prévenue.</p>
              <p>Présentez-vous au secrétariat avec une pièce d&apos;identité : un code à 6 chiffres vous sera remis. Il est valable 24 heures.</p>
            </div>
            <button type="button" onClick={() => { setMode("forgot-reset"); setForgotError(""); }} className={cn(boutonPrincipal, "mt-6")} data-testid="button-saisir-code">
              <KeyRound size={16} /> J&apos;ai reçu mon code
            </button>
          </>
        )}

        {mode === "forgot-reset" && (
          <>
            {retourConnexion}
            <h2 className="text-2xl font-extrabold tracking-tight mb-1.5" style={DISPLAY}>Nouveau mot de passe</h2>
            <p className="text-sm text-[#5d5a7a] dark:text-[#a3a6c2] mb-6">Saisissez votre identifiant, le code remis par l&apos;administration et votre nouveau mot de passe.</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="reset-identifiant" className={etiquetteChamp}>Matricule, identifiant ou e-mail</label>
                <input id="reset-identifiant" value={forgotIdentifier} onChange={(e) => setForgotIdentifier(e.target.value)} type="text" autoComplete="username" placeholder="ex. 2025-LQHSE-0001" className={champConnexion} data-testid="input-reset-identifier" />
              </div>
              <div>
                <label htmlFor="reset-code" className={etiquetteChamp}>Code remis par l&apos;administration</label>
                <input
                  id="reset-code"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  type="text"
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className={cn(champConnexion, "tracking-[0.4em] text-center text-lg")}
                  style={MONO}
                  data-testid="input-reset-pin"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reset-mdp" className={etiquetteChamp}>Nouveau mot de passe</label>
                  <input id="reset-mdp" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="••••••••" className={champConnexion} data-testid="input-new-password" />
                </div>
                <div>
                  <label htmlFor="reset-mdp2" className={etiquetteChamp}>Confirmation</label>
                  <input id="reset-mdp2" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="••••••••" className={champConnexion} data-testid="input-confirm-password" />
                </div>
              </div>
              <p className="text-xs text-[#6b6889] dark:text-[#a3a6c2] -mt-2">{PASSWORD_HINT}</p>
              {forgotError && messageErreur(forgotError)}
              <button type="button" onClick={handleResetPassword} className={boutonPrincipal} data-testid="button-reset-password">
                <CheckCircle2 size={16} /> Réinitialiser le mot de passe
              </button>
            </div>
          </>
        )}
      </CadreConnexion>
    );
  }

  return (
    <CadreConnexion
      etiquette="Connexion"
      titre={<>Accédez à<br /><span className="text-[#4f46e5] dark:text-[#a5b4fc]">votre espace.</span></>}
      intro="Étudiants, professeurs et administration de l'UCAO se connectent ici. Le bon portail s'ouvre automatiquement."
      aide={(
        <div className="max-w-md space-y-2.5" data-testid="connexion-aide">
          {[
            { qui: "Étudiant", comment: "Votre matricule", exemple: "2025-LQHSE-0001" },
            { qui: "Professeur", comment: "Votre matricule enseignant ou votre identifiant", exemple: "ENS-2026-100" },
            { qui: "Administration", comment: "Votre identifiant personnel", exemple: "ADM-SCOLARITE" },
          ].map((x) => (
            <div key={x.qui} className="flex items-center justify-between gap-4 rounded-[20px] px-5 py-4 bg-white/70 dark:bg-white/5 border border-white dark:border-white/10">
              <span>
                <span className="block text-[11px] uppercase tracking-[0.16em] text-[#4f46e5] dark:text-[#a5b4fc]" style={MONO}>{x.qui}</span>
                <span className="block text-sm font-semibold mt-0.5">{x.comment}</span>
              </span>
              <code className="hidden sm:block text-xs text-[#5d5a7a] dark:text-[#a3a6c2] whitespace-nowrap" style={MONO}>{x.exemple}</code>
            </div>
          ))}
          <p className="text-sm text-[#5d5a7a] dark:text-[#a3a6c2] pt-2">
            Première connexion : utilisez le mot de passe provisoire qui vous a été remis, puis choisissez le vôtre.
          </p>
        </div>
      )}
    >
      <h2 className="text-2xl font-extrabold tracking-tight mb-1.5" style={DISPLAY}>Content de vous revoir</h2>
      <p className="text-sm text-[#5d5a7a] dark:text-[#a3a6c2] mb-6">Saisissez vos identifiants pour accéder à votre espace.</p>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label htmlFor="connexion-identifiant" className={etiquetteChamp}>Matricule, identifiant ou e-mail</label>
          <input
            id="connexion-identifiant"
            {...form.register("identifier")}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ex. 2025-LQHSE-0001"
            className={champConnexion}
            aria-invalid={!!form.formState.errors.identifier}
            data-testid="input-email"
          />
          {form.formState.errors.identifier && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{form.formState.errors.identifier.message}</p>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="connexion-mdp" className={cn(etiquetteChamp, "mb-0")}>Mot de passe</label>
            <button
              type="button"
              onClick={() => { setMode("forgot-request"); setForgotError(""); setForgotIdentifier(""); }}
              className="text-[13px] font-semibold text-[#4f46e5] dark:text-[#a5b4fc] hover:underline"
              data-testid="link-mot-de-passe-oublie"
            >
              Mot de passe oublié ?
            </button>
          </div>
          <div className="relative">
            <input
              id="connexion-mdp"
              {...form.register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className={cn(champConnexion, "pr-12")}
              aria-invalid={!!form.formState.errors.password}
              data-testid="input-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-[#6b6889] hover:text-[#17133a] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {form.formState.errors.password && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{form.formState.errors.password.message}</p>}
        </div>

        {error && messageErreur(error)}

        <button type="submit" disabled={loading} className={cn(boutonPrincipal, "mt-2")} data-testid="button-submit">
          {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-[#17133a]/30 dark:border-t-[#17133a] rounded-full animate-spin" /> : null}
          {loading ? "Connexion en cours…" : <>Se connecter <ArrowRight size={16} /></>}
        </button>
      </form>
    </CadreConnexion>
  );
}
