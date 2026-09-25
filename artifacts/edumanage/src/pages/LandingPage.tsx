import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  GraduationCap, ArrowRight, Users,
  BookOpen, DollarSign, CheckCircle2, Menu, X
} from "lucide-react";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0d1117] text-[#0f172a] dark:text-[#f1f5f9]">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 h-[70px] flex items-center px-6 lg:px-12 transition-all duration-300 ${scrolled ? "bg-white/95 dark:bg-[#0d1117]/95 backdrop-blur-md shadow-sm border-b border-[#e2e8f0] dark:border-[#2d3748]" : "bg-transparent"}`}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-[#4f46e5] rounded-lg flex items-center justify-center">
            <GraduationCap size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>
            Edu<span style={{ color: "#4f46e5" }}>Manage</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 mx-auto text-sm font-medium text-[#64748b]">
          <a href="#features" className="hover:text-[#4f46e5] transition-colors">Fonctionnalités</a>
          <a href="#payments" className="hover:text-[#4f46e5] transition-colors">Paiements</a>
        </div>
        <div className="hidden md:flex items-center gap-3 ml-auto">
          <Link href="/login" className="px-4 py-2 text-sm font-medium bg-[#4f46e5] text-white rounded-lg hover:bg-[#4338ca] transition-colors shadow-md shadow-indigo-200 dark:shadow-indigo-900" data-testid="nav-login">
            Se Connecter
          </Link>
        </div>
        <button className="md:hidden ml-auto p-2" onClick={() => setMobileOpen((o) => !o)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-white dark:bg-[#0d1117] pt-[70px] px-6 flex flex-col gap-4 md:hidden">
          <a href="#features" className="py-3 border-b border-[#e2e8f0] dark:border-[#2d3748] text-sm font-medium" onClick={() => setMobileOpen(false)}>Fonctionnalités</a>
          <a href="#payments" className="py-3 border-b border-[#e2e8f0] dark:border-[#2d3748] text-sm font-medium" onClick={() => setMobileOpen(false)}>Paiements</a>
          <Link href="/login" className="py-3 text-center bg-[#4f46e5] text-white rounded-xl font-medium mt-4" onClick={() => setMobileOpen(false)}>Se Connecter</Link>
        </div>
      )}

      {/* Hero */}
      <section className="min-h-screen flex items-center relative overflow-hidden pt-[70px]" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdf4 100%)" }}>
        {/* Blobs */}
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: "#4f46e5" }} />
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background: "#10b981" }} />

        <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full grid lg:grid-cols-2 gap-12 lg:gap-20 items-center py-16">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6" style={{ background: "#eef2ff", color: "#4f46e5", border: "1px solid #c7d2fe" }}>
              🇸🇳 Conçu pour l'Afrique francophone
            </div>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-extrabold leading-tight mb-5" style={{ fontFamily: "Outfit, sans-serif" }}>
              Gérez votre université privée{" "}
              <span style={{ background: "linear-gradient(135deg, #4f46e5, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                avec excellence.
              </span>
            </h1>
            <p className="text-lg text-[#64748b] leading-relaxed mb-8 max-w-xl">
              La plateforme tout-en-un pour les universités privées du Sénégal : scolarité LMD, suivi des frais et des encaissements, gestion des vacataires.
            </p>
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <Link href="/login" className="flex items-center gap-2 px-6 py-3 bg-[#4f46e5] text-white rounded-full font-medium hover:bg-[#4338ca] transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900" data-testid="hero-cta-primary">
                Accéder à mon espace <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Right — Dashboard mockup */}
          <div className="relative flex justify-center">
            <div
              className="w-full max-w-md bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl border border-[#e2e8f0] dark:border-[#2d3748] p-5"
              style={{ transform: "perspective(1000px) rotateY(-6deg) rotateX(3deg)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-medium text-[#64748b]">Tableau de bord</div>
                  <div className="font-bold text-sm text-[#0f172a] dark:text-[#f1f5f9]" style={{ fontFamily: "Outfit, sans-serif" }}>Revenus — Mai 2026</div>
                </div>
                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+8%</div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Étudiants", value: "847", color: "#4f46e5", pct: "85%" },
                  { label: "Revenus", value: "14.2M", color: "#10b981", pct: "72%" },
                  { label: "Impayés", value: "38", color: "#ef4444", pct: "25%" },
                  { label: "Réussite", value: "76%", color: "#f59e0b", pct: "76%" },
                ].map((k) => (
                  <div key={k.label} className="bg-[#f8fafc] dark:bg-[#0d1117] rounded-xl p-3">
                    <div className="text-xs text-[#64748b] mb-1">{k.label}</div>
                    <div className="font-bold text-sm text-[#0f172a] dark:text-[#f1f5f9]" style={{ fontFamily: "Outfit, sans-serif" }}>{k.value}</div>
                    <div className="mt-2 h-1.5 bg-[#e2e8f0] dark:bg-[#2d3748] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: k.pct, background: k.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-1 h-20">
                {[40, 65, 55, 80, 45, 70, 90, 60, 75, 85].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i === 8 ? "#4f46e5" : "#e0e7ff" }} />
                ))}
              </div>
            </div>

            {/* Floating cards */}
            <div className="absolute -bottom-4 -left-8 bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl p-3 shadow-lg animate-bounce-slow flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign size={14} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-[10px] text-[#64748b]">Paiement reçu</div>
                <div className="text-xs font-bold text-[#0f172a] dark:text-[#f1f5f9]">+150 000 FCFA</div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#2d3748] rounded-xl p-3 shadow-lg animate-float flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <GraduationCap size={14} className="text-indigo-600" />
              </div>
              <div>
                <div className="text-[10px] text-[#64748b]">Inscrit L1 Info</div>
                <div className="text-xs font-bold text-[#0f172a] dark:text-[#f1f5f9]">Moussa SY</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Tout ce dont votre université a besoin</h2>
          <p className="text-[#64748b] max-w-xl mx-auto">Une solution complète, pensée pour les réalités des universités privées en Afrique francophone.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: BookOpen, color: "#4f46e5", bg: "#eef2ff", title: "Gestion Académique LMD", desc: "Filières, niveaux, semestres, UE, EC, emplois du temps. Tout le système LMD dans une seule interface intuitive." },
            { icon: DollarSign, color: "#10b981", bg: "#ecfdf5", title: "Finance & Scolarités", desc: "Espèces, Wave, Orange Money, virement : chaque règlement est enregistré sur la quittance de l'étudiant, avec le suivi des impayés." },
            { icon: Users, color: "#f59e0b", bg: "#fffbeb", title: "Gestion des Vacataires", desc: "Calcul automatique des vacations et des décomptes, suivi des heures et des contrats de chaque enseignant." },
          ].map((f) => (
            <div key={f.title} className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#2d3748] rounded-2xl p-6 hover:-translate-y-1 hover:border-[#4f46e5] hover:shadow-xl transition-all duration-200 cursor-default" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: f.bg }}>
                <f.icon size={22} style={{ color: f.color }} />
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{f.title}</h3>
              <p className="text-sm text-[#64748b] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Highlight */}
      <section id="payments" className="py-20 bg-[#f8fafc] dark:bg-[#161b22]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-12 items-center">
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80"
            alt="Étudiants"
            className="rounded-2xl shadow-xl w-full object-cover h-80 lg:h-96"
          />
          <div>
            <h2 className="text-3xl font-bold mb-5" style={{ fontFamily: "Outfit, sans-serif" }}>
              Frais de scolarité<br />
              <span style={{ color: "#10b981" }}>suivis au franc près</span>
            </h2>
            <div className="flex flex-col gap-4">
              {[
                "Tous les modes de règlement : espèces, Wave, Orange Money, virement, chèque",
                "Quittances, reçus et encaissements rattachés au dossier de l'étudiant",
                "Prises en charge, dérogations, réductions et avoirs",
                "Relance des impayés et blocage automatique du portail étudiant",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#64748b]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Prêt à moderniser votre université ?</h2>
          <p className="text-indigo-200 mb-8">Étudiants, enseignants et administration : chacun retrouve son espace avec ses identifiants.</p>
          <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#4f46e5] font-semibold rounded-full hover:bg-indigo-50 transition-colors shadow-lg" data-testid="cta-login-btn">
            Se connecter <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-[#0f172a] text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#4f46e5] rounded-lg flex items-center justify-center">
              <GraduationCap size={14} className="text-white" />
            </div>
            <span className="font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>EduManage</span>
            <span className="text-xs text-slate-400 ml-2">Gestion universitaire</span>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} EduManage. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
