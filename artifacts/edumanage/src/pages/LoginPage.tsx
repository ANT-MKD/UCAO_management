import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowLeft, AlertTriangle, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { findUserAccountByIdentifier, updateUserPassword, getUserAccounts, pushNotificationEtPersister, logAudit } from "@/data/studentStore";
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

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col" style={{ background: "#1e293b" }}>
        <img
          src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80"
          alt="Campus"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 flex flex-col h-full p-10">
          <Link href="/" className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm mb-auto">
            <ArrowLeft size={14} /> Retour à l'accueil
          </Link>
          <div className="mb-auto">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <GraduationCap size={22} className="text-white" />
              </div>
              <span className="text-white font-bold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>EduManage</span>
            </div>
            <h2 className="text-3xl font-bold text-white leading-tight mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
              Gérez votre université<br />avec excellence.
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Scolarité, finances et enseignement réunis dans un même espace. Connectez-vous à votre portail.
            </p>
          </div>
          <p className="text-white/30 text-xs">© {new Date().getFullYear()} EduManage</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-white dark:bg-[#0d1117]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#4f46e5] rounded-lg flex items-center justify-center">
              <GraduationCap size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>
              Edu<span style={{ color: "#4f46e5" }}>Manage</span>
            </span>
          </div>

          {mode === "login" && (
          <>
          <h1 className="text-2xl font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
            Content de vous revoir
          </h1>
          <p className="text-sm text-[#64748b] mb-8">Saisissez vos identifiants pour accéder à votre espace</p>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1.5">Email ou Matricule</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  {...form.register("identifier")}
                  type="text"
                  autoComplete="email"
                  placeholder="Email ou matricule"
                  className="w-full pl-10 pr-4 py-3 text-sm border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl bg-white dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition-all"
                  data-testid="input-email"
                />
              </div>
              {form.formState.errors.identifier && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.identifier.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  {...form.register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 text-sm border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl bg-white dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition-all"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Remember + forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-[#64748b] cursor-pointer">
                <input type="checkbox" className="rounded border-[#e2e8f0]" />
                Se souvenir de moi
              </label>
              <button
                type="button"
                onClick={() => { setMode("forgot-request"); setForgotError(""); setForgotIdentifier(""); }}
                className="text-xs text-[#4f46e5] hover:underline"
                data-testid="link-mot-de-passe-oublie"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
                <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-70 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900 flex items-center justify-center gap-2"
              data-testid="button-submit"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </form>
          </>
          )}

          {mode === "forgot-request" && (
            <>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#4f46e5] mb-6"
              >
                <ArrowLeft size={13} /> Retour à la connexion
              </button>
              <h1 className="text-2xl font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
                Mot de passe oublié
              </h1>
              <p className="text-sm text-[#64748b] mb-8">Saisissez votre email ou matricule : l'administration sera prévenue et vous remettra un code après vérification de votre identité.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1.5">Email ou Matricule</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                    <input
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      type="text"
                      placeholder="Email ou matricule"
                      className="w-full pl-10 pr-4 py-3 text-sm border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl bg-white dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition-all"
                      data-testid="input-forgot-identifier"
                    />
                  </div>
                </div>

                {forgotError && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
                    <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">{forgotError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleForgotRequest}
                  disabled={!forgotIdentifier.trim()}
                  className="w-full h-12 bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  data-testid="button-forgot-request"
                >
                  <KeyRound size={15} /> Demander un code
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("forgot-reset"); setForgotError(""); }}
                  className="w-full text-xs text-[#4f46e5] hover:underline"
                  data-testid="link-j-ai-un-code"
                >
                  J'ai déjà un code
                </button>
              </div>
            </>
          )}

          {mode === "forgot-sent" && (
            <>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#4f46e5] mb-6"
              >
                <ArrowLeft size={13} /> Retour à la connexion
              </button>
              <h1 className="text-2xl font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>
                Demande transmise
              </h1>
              <div className="space-y-3 text-sm text-[#64748b]" data-testid="forgot-sent-message">
                <p>Si un compte correspond à cet identifiant, l&apos;administration a été prévenue.</p>
                <p>
                  Présentez-vous au secrétariat avec une pièce d&apos;identité : un code à 6 chiffres vous sera remis.
                  Il est valable 24 heures.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMode("forgot-reset"); setForgotError(""); }}
                className="w-full h-12 mt-6 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                data-testid="button-saisir-code"
              >
                <KeyRound size={15} /> J&apos;ai reçu mon code
              </button>
            </>
          )}

          {mode === "forgot-reset" && (
            <>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#4f46e5] mb-6"
              >
                <ArrowLeft size={13} /> Retour à la connexion
              </button>
              <h1 className="text-2xl font-bold text-[#0f172a] dark:text-[#f1f5f9] mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>
                Nouveau mot de passe
              </h1>
              <p className="text-sm text-[#64748b] mb-6">Saisissez votre identifiant, le code remis par l&apos;administration et votre nouveau mot de passe.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1.5">Email ou Matricule</label>
                  <input
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    type="text"
                    placeholder="Email ou matricule"
                    className="w-full px-4 py-3 text-sm border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl bg-white dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition-all"
                    data-testid="input-reset-identifier"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1.5">Code remis par l&apos;administration</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                    <input
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value)}
                      type="text"
                      placeholder="000000"
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full pl-10 pr-4 py-3 text-sm font-mono border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl bg-white dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition-all"
                      data-testid="input-reset-pin"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1.5">Nouveau mot de passe</label>
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 text-sm border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl bg-white dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition-all"
                    data-testid="input-new-password"
                  />
                  <p className="text-[11px] text-[#94a3b8] mt-1">{PASSWORD_HINT}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1.5">Confirmer le mot de passe</label>
                  <input
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3 text-sm border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl bg-white dark:bg-[#1e293b] text-[#0f172a] dark:text-[#f1f5f9] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/30 focus:border-[#4f46e5] transition-all"
                    data-testid="input-confirm-password"
                  />
                </div>

                {forgotError && (
                  <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
                    <AlertTriangle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400">{forgotError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="w-full h-12 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  data-testid="button-reset-password"
                >
                  <CheckCircle2 size={15} /> Réinitialiser le mot de passe
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
