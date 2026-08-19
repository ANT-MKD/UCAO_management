import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  GraduationCap, ArrowRight, Play, Users, TrendingUp, Shield,
  BookOpen, DollarSign, CheckCircle2, Star, Twitter, Linkedin, Facebook, Menu, X
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
          <a href="#testimonials" className="hover:text-[#4f46e5] transition-colors">Témoignages</a>
          <a href="#integrations" className="hover:text-[#4f46e5] transition-colors">Intégrations</a>
        </div>
        <div className="hidden md:flex items-center gap-3 ml-auto">
          <Link href="/login" className="px-4 py-2 text-sm font-medium border border-[#e2e8f0] dark:border-[#2d3748] rounded-lg hover:bg-[#f8fafc] dark:hover:bg-[#1e293b] transition-colors" data-testid="nav-login">
            Se Connecter
          </Link>
          <Link href="/login" className="px-4 py-2 text-sm font-medium bg-[#4f46e5] text-white rounded-lg hover:bg-[#4338ca] transition-colors shadow-md shadow-indigo-200 dark:shadow-indigo-900" data-testid="nav-demo">
            Demander une Démo
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
              La plateforme tout-en-un pour les universités privées du Sénégal. Paiements Wave & Orange Money intégrés, système LMD, gestion complète des vacataires.
            </p>
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <Link href="/login" className="flex items-center gap-2 px-6 py-3 bg-[#4f46e5] text-white rounded-full font-medium hover:bg-[#4338ca] transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900" data-testid="hero-cta-primary">
                Commencer gratuitement <ArrowRight size={16} />
              </Link>
              <button className="flex items-center gap-2 px-6 py-3 border border-[#e2e8f0] rounded-full text-sm font-medium text-[#64748b] hover:bg-white transition-all" data-testid="hero-cta-demo">
                <Play size={14} fill="currentColor" /> Voir la démo
              </button>
            </div>
            <div className="flex items-center gap-6 pt-6 border-t border-[#e2e8f0]">
              {[
                { value: "847+", label: "étudiants gérés" },
                { value: "12", label: "universités" },
                { value: "99.9%", label: "uptime garanti" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="font-bold text-[#0f172a]" style={{ fontFamily: "Outfit, sans-serif" }}>{s.value}</div>
                  <div className="text-xs text-[#64748b]">{s.label}</div>
                </div>
              ))}
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

      {/* Trusted By */}
      <section className="py-12 bg-[#f8fafc] dark:bg-[#161b22] border-y border-[#e2e8f0] dark:border-[#2d3748]">
        <div className="text-center mb-6">
          <p className="text-sm font-medium text-[#64748b]">Ils nous font confiance</p>
        </div>
        <div className="overflow-hidden">
          <div className="flex gap-12 items-center animate-marquee whitespace-nowrap">
            {["UCAO", "SupDeco", "ISM Group", "BEM Dakar", "AFI L'Université", "Sup'Itech", "ISEG", "Esatic",
              "UCAO", "SupDeco", "ISM Group", "BEM Dakar", "AFI L'Université", "Sup'Itech", "ISEG", "Esatic"].map((name, i) => (
              <span key={i} className="text-sm font-semibold text-[#94a3b8] flex-shrink-0 hover:text-[#4f46e5] transition-colors cursor-default">
                {name}
              </span>
            ))}
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
            { icon: DollarSign, color: "#10b981", bg: "#ecfdf5", title: "Finance & Scolarités", desc: "Wave, Orange Money, espèces, virement. Suivi en temps réel des paiements, impayés et réconciliation automatique." },
            { icon: Users, color: "#f59e0b", bg: "#fffbeb", title: "Gestion des Vacataires", desc: "Calcul automatique des vacations, suivi des heures par enseignant, paiement par virement ou mobile money." },
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
              Paiements mobiles<br />
              <span style={{ color: "#10b981" }}>intégrés nativement</span>
            </h2>
            <div className="flex flex-col gap-4">
              {[
                "Intégration API Wave, Orange Money et Free Money",
                "Réconciliation automatique avec le dossier de l'étudiant",
                "Reçu PDF généré et envoyé par email instantanément",
                "SMS de rappel 48h avant chaque échéance de paiement",
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

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>Ce qu'ils en disent</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { quote: "Avant EduManage, on gérait 800 étudiants sous Excel. Maintenant, tout est centralisé et nos erreurs ont disparu.", author: "Moussa DIAGNE", role: "Directeur Administratif", school: "UCAO Dakar" },
            { quote: "Les parents paient maintenant par Wave sans se déplacer. Le taux de recouvrement est passé de 68% à 94% en 3 mois.", author: "Aminata SOW", role: "Directrice Financière", school: "SupDeco" },
            { quote: "La saisie des notes en ligne nous fait gagner 2 semaines par session. Les étudiants voient leurs résultats en temps réel.", author: "Dr. Cheikh MBAYE", role: "Chef Département Informatique", school: "ISM Group" },
          ].map((t) => (
            <div key={t.author} className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#2d3748] rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="text-3xl text-[#4f46e5] font-bold mb-3">"</div>
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill="#f59e0b" className="text-amber-400" />)}
              </div>
              <p className="text-sm text-[#64748b] leading-relaxed mb-4">{t.quote}</p>
              <div className="flex items-center gap-3 pt-4 border-t border-[#e2e8f0] dark:border-[#2d3748]">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                  {t.author.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">{t.author}</div>
                  <div className="text-[11px] text-[#64748b]">{t.role} · {t.school}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-16 bg-[#f8fafc] dark:bg-[#161b22]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>Connecté aux outils que vous utilisez déjà</h2>
          <p className="text-sm text-[#64748b] mb-10">Intégrations natives sans développement supplémentaire</p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { name: "Wave", color: "#2563eb", bg: "#eff6ff" },
              { name: "Orange Money", color: "#ea580c", bg: "#fff7ed" },
              { name: "Free Money", color: "#dc2626", bg: "#fef2f2" },
              { name: "Email SMTP", color: "#4f46e5", bg: "#eef2ff" },
              { name: "WhatsApp", color: "#16a34a", bg: "#f0fdf4" },
              { name: "Export PDF", color: "#7c3aed", bg: "#f5f3ff" },
            ].map((item) => (
              <div key={item.name} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-[#e2e8f0] dark:border-[#2d3748] bg-white dark:bg-[#1e293b]" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="w-5 h-5 rounded-full" style={{ background: item.color }} />
                <span className="text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Prêt à moderniser votre université ?</h2>
          <p className="text-indigo-200 mb-8">Rejoignez les 12 universités qui font confiance à EduManage pour leur gestion quotidienne.</p>
          <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#4f46e5] font-semibold rounded-full hover:bg-indigo-50 transition-colors shadow-lg" data-testid="cta-demo-btn">
            Programmer une Démo Gratuite <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-[#0f172a] text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-[#4f46e5] rounded-lg flex items-center justify-center">
                <GraduationCap size={14} className="text-white" />
              </div>
              <span className="font-bold" style={{ fontFamily: "Outfit, sans-serif" }}>EduManage</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">La plateforme de référence pour la gestion des universités privées en Afrique francophone.</p>
            <div className="flex gap-3">
              {[Twitter, Linkedin, Facebook].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-[#4f46e5] transition-colors">
                  <Icon size={14} className="text-slate-400" />
                </a>
              ))}
            </div>
          </div>
          {[
            { title: "Produit", links: ["Fonctionnalités", "Tarifs", "Solutions", "Démo"] },
            { title: "Ressources", links: ["Documentation", "Guide utilisateur", "API", "Blog"] },
            { title: "Entreprise", links: ["À propos", "Contact", "Mentions légales", "CGU"] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-sm mb-3">{col.title}</h4>
              <div className="flex flex-col gap-2">
                {col.links.map((link) => (
                  <a key={link} href="#" className="text-xs text-slate-400 hover:text-white transition-colors">{link}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 pt-6 px-6 lg:px-12 max-w-7xl mx-auto">
          <p className="text-xs text-slate-500 text-center">© 2026 EduManage Inc. Tous droits réservés. Conçu avec soin au Sénégal.</p>
        </div>
      </footer>
    </div>
  );
}
