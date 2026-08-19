import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowLeft, AlertTriangle, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const loginSchema = z.object({
  identifier: z.string().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginForm = z.infer<typeof loginSchema>;

const DEMO_CREDS = [
  { role: "Admin", email: "admin@edumanage.com", color: "#4f46e5", bg: "#eef2ff" },
  { role: "Enseignant", email: "prof@edumanage.com", color: "#8b5cf6", bg: "#f5f3ff" },
  { role: "Étudiant", email: "etu@edumanage.com", hint: "ou matricule 2025-LPIG-0001", color: "#10b981", bg: "#ecfdf5" },
];

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const handleCopy = (email: string) => {
    form.setValue("identifier", email);
    form.setValue("password", "demo123");
    setError("");

    void (async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(email);
        }
      } catch {
        /* Presse-papiers indisponible (HTTP, permissions…) — le formulaire est déjà rempli */
      }
    })();

    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  };

  const onSubmit = async (data: LoginForm) => {
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const user = login(data.identifier, data.password);
    setLoading(false);
    if (!user) {
      setError("Identifiants incorrects. Utilisez un des comptes de démo ci-dessous.");
      return;
    }
    if (user.role === "admin") setLocation("/admin/dashboard");
    else if (user.role === "teacher") setLocation("/teacher/dashboard");
    else setLocation("/student/dashboard");
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
              La plateforme de référence pour les universités privées en Afrique francophone. Accédez à votre espace sécurisé.
            </p>
          </div>
          <p className="text-white/30 text-xs">© 2026 EduManage Inc.</p>
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
              <a href="#" className="text-xs text-[#4f46e5] hover:underline">Mot de passe oublié ?</a>
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

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-950 border border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl">
            <p className="text-xs font-semibold text-[#4f46e5] mb-3">Comptes de démo — mot de passe : demo123</p>
            <div className="flex flex-col gap-2">
              {DEMO_CREDS.map((c) => (
                <div key={c.email} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>
                      {c.role}
                    </span>
                    <span className="text-xs text-[#64748b] font-mono">{c.email}</span>
                    {"hint" in c && c.hint && (
                      <span className="text-[10px] text-[#94a3b8]">{c.hint}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(c.email)}
                    className="flex items-center gap-1 text-[10px] text-[#4f46e5] hover:bg-indigo-100 dark:hover:bg-indigo-900 px-2 py-1 rounded-lg transition-colors"
                    data-testid={`copy-${c.role}`}
                  >
                    {copied === c.email ? <Check size={11} /> : <Copy size={11} />}
                    {copied === c.email ? "Rempli" : "Utiliser"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
