import { useEffect, useState } from "react";
import { Link } from "wouter";
import { GraduationCap, ArrowRight, Menu, X, Plus, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page d'accueil des utilisateurs de l'UCAO : étudiants, professeurs et administration y trouvent
 * la porte d'entrée de leur portail, ce qu'ils peuvent y faire et les réponses aux questions
 * courantes (connexion, mot de passe, paiement, notes). Tous les exemples reprennent le
 * fonctionnement réel de l'application. */

const DISPLAY = { fontFamily: "Outfit, Inter, sans-serif" };
const MONO = { fontFamily: "var(--app-font-mono)" };

const LIENS = [
  { href: "#portails", label: "Portails" },
  { href: "#relie", label: "Fonctionnement" },
  { href: "#regles", label: "Règles UCAO" },
  { href: "#faq", label: "Questions" },
];

type CleePortail = "etudiant" | "professeur" | "administration";

const PORTAILS: Record<CleePortail, { label: string; titre: string; texte: string; connexion: string; actions: [string, string][] }> = {
  etudiant: {
    label: "Étudiant",
    titre: "Tout votre parcours, au même endroit.",
    texte: "Consultez vos cours, vos notes et vos relevés, suivez vos absences et réglez vos frais sans vous déplacer.",
    connexion: "Votre matricule, par exemple 2025-LQHSE-0001",
    actions: [
      ["Emploi du temps", "La semaine en cours, mise à jour dès qu'un cours est déplacé ou annulé."],
      ["Notes et relevés", "Vos notes dès leur publication, puis le relevé de chaque semestre."],
      ["Absences", "Justifiez une absence en joignant votre certificat."],
      ["Factures", "Payez par Wave ou Orange Money et suivez votre solde."],
      ["Demandes", "Attestation, réclamation sur une note, délai de paiement."],
    ],
  },
  professeur: {
    label: "Professeur",
    titre: "Enseignez. Le reste suit.",
    texte: "Votre planning, vos classes et vos notes au même endroit. Le cahier de séance fait l'appel et déclare vos heures.",
    connexion: "Votre matricule enseignant (ENS-…) ou votre identifiant",
    actions: [
      ["Emploi du temps", "Vos séances de la semaine, avec la classe et la salle."],
      ["Saisie des notes", "En brouillon, puis envoyées à l'administration pour validation."],
      ["Cahier de séance", "Sujet, résumé et appel : les absences arrivent chez les étudiants."],
      ["Heures et rémunération", "Pointage, volume horaire, décomptes et contrat."],
      ["Messagerie", "Les messages de l'administration, au même endroit."],
    ],
  },
  administration: {
    label: "Administration",
    titre: "Toute l'université, sous les yeux.",
    texte: "Inscriptions, maquette LMD, notes, délibérations, finances et sécurité, avec un centre « À traiter » qui rassemble ce qui attend une décision.",
    connexion: "Votre identifiant personnel de connexion",
    actions: [
      ["À traiter", "Paiements à vérifier, demandes d'étudiants, heures à confirmer."],
      ["Scolarité", "Inscriptions, évaluations, saisie et publication des notes, rattrapage."],
      ["Délibérations", "Jurys de semestre et d'année, repêchage motivé, relevés."],
      ["Finances", "Factures, encaissements, paiements en ligne, relances."],
      ["Sécurité", "Comptes, rôles, historique des règlements, journal d'audit."],
    ],
  },
};

const FLUX = [
  { etapes: ["Cahier de séance", "Validation", "Absences notifiées"], resultat: "2 h de cours ajoutées au pointage du professeur" },
  { etapes: ["Paiement Wave", "Vérifié par la caisse", "Facture réglée"], resultat: "Reçu disponible dans le portail de l'étudiant" },
  { etapes: ["Notes publiées", "Délibération", "Relevé du semestre"], resultat: "L'étudiant est prévenu dès la publication" },
];

const REGLES = [
  { valeur: "30", unite: "crédits", texte: "pour valider un semestre" },
  { valeur: "60", unite: "crédits", texte: "pour être admis dans l'année supérieure" },
  { valeur: "42", unite: "crédits", texte: "pour passer avec dette, les UE manquantes à rattraper" },
  { valeur: "30 / 70", unite: "%", texte: "devoir et examen dans la note d'une matière" },
  { valeur: "0", unite: "arrondi", texte: "les moyennes sont coupées au centième" },
  { valeur: "1", unite: "règle", texte: "au rattrapage, la meilleure des deux notes est retenue" },
];

const ANNEE = [
  { quand: "Rentrée", titre: "Inscription", texte: "Matricule attribué, factures émises, accès au portail remis." },
  { quand: "Chaque semaine", titre: "Cours", texte: "Emploi du temps, cahier de séance et appel, heures déclarées." },
  { quand: "Évaluations", titre: "Notes", texte: "Saisies, validées puis publiées : l'étudiant est notifié." },
  { quand: "Fin de semestre", titre: "Jury", texte: "Délibération, repêchage motivé, relevés générés." },
  { quand: "Fin d'année", titre: "Passage", texte: "Admis, admis avec dette ou redoublement, puis réinscription." },
];

const FAQ: [string, string][] = [
  ["Comment me connecter ?", "Étudiants : avec votre matricule (par exemple 2025-LQHSE-0001) et le mot de passe provisoire remis à l'inscription. Professeurs : avec votre matricule enseignant ou votre identifiant. À la première connexion, vous choisissez votre propre mot de passe."],
  ["J'ai oublié mon mot de passe.", "Cliquez sur « Mot de passe oublié ? » sur l'écran de connexion. L'administration vérifie votre identité et vous remet un code à usage unique, avec lequel vous choisissez un nouveau mot de passe. Aucun code n'est envoyé automatiquement."],
  ["Puis-je payer mes frais en ligne ?", "Oui, par Wave ou Orange Money, depuis « Payer factures ». Indiquez la référence de la transaction : la facture est réglée dès que la caisse a vérifié le paiement."],
  ["Quand mes notes apparaissent-elles ?", "Dès que l'administration les a validées et publiées. Vous recevez alors une notification dans votre portail."],
  ["Comment justifier une absence ?", "Dans « Absences/retards », cliquez sur « Justifier » et joignez votre justificatif. L'absence passe en « justifiée » après validation par l'administration."],
  ["Puis-je utiliser EduManage sur mon téléphone ?", "Oui. Les trois portails s'adaptent à l'écran du téléphone : le menu s'ouvre avec le bouton en haut de l'écran."],
  ["Qui voit mes informations ?", "Chaque étudiant et chaque professeur ne voit que ce qui le concerne. Au sein de l'administration, l'accès dépend du rôle de chacun et les actions sensibles sont enregistrées dans un journal."],
];

function Etiquette({ children, sombre }: { children: React.ReactNode; sombre?: boolean }) {
  return (
    <p className={cn("text-[11px] sm:text-xs uppercase tracking-[0.18em] font-medium mb-4", sombre ? "text-[#a5b4fc]" : "text-[#4f46e5] dark:text-[#a5b4fc]")} style={MONO}>
      {children}
    </p>
  );
}

function TitreSection({ children, sombre, className }: { children: React.ReactNode; sombre?: boolean; className?: string }) {
  return (
    <h2 className={cn("text-[34px] sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.035em] leading-[1.02]", sombre ? "text-white" : "text-[#17133a] dark:text-white", className)} style={DISPLAY}>
      {children}
    </h2>
  );
}

function BoutonConnexion({ children, testId, clair }: { children: React.ReactNode; testId: string; clair?: boolean }) {
  return (
    <Link
      href="/login"
      className={cn(
        "inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300",
        clair ? "bg-white text-[#17133a] hover:bg-indigo-50" : "bg-[#17133a] text-white hover:bg-[#2b2563] dark:bg-white dark:text-[#17133a] dark:hover:bg-indigo-50",
      )}
      style={{ boxShadow: "0 10px 30px -10px rgba(23, 19, 58, 0.45)" }}
      data-testid={testId}
    >
      {children} <ArrowRight size={16} />
    </Link>
  );
}

/** Fond pastel du haut de page et de l'appel final (version sombre en mode sombre). */
function FondPastel({ className }: { className?: string }) {
  return (
    <>
      <div
        aria-hidden
        className={cn("absolute inset-0 dark:hidden", className)}
        style={{
          background:
            "radial-gradient(45% 55% at 12% 35%, #f6c7e3 0%, transparent 70%), radial-gradient(45% 50% at 88% 18%, #c7c2ff 0%, transparent 70%), radial-gradient(50% 55% at 70% 85%, #a9c3ff 0%, transparent 70%), radial-gradient(40% 40% at 30% 90%, #d9ccff 0%, transparent 70%), #eef0fb",
        }}
      />
      <div
        aria-hidden
        className={cn("absolute inset-0 hidden dark:block", className)}
        style={{
          background:
            "radial-gradient(45% 55% at 12% 35%, #4a1f45 0%, transparent 70%), radial-gradient(45% 50% at 88% 18%, #2e2a6b 0%, transparent 70%), radial-gradient(50% 55% at 70% 85%, #1f3266 0%, transparent 70%), #0d1117",
        }}
      />
    </>
  );
}

/** Reproduction du relevé de semestre du portail étudiant (exemple d'Awa). */
function ApercuPortail() {
  const lignes = [
    { ue: "Prévention des Risques Majeurs", moyenne: "15,00", statut: "UE acquise", credits: "10 / 10", ok: true },
    { ue: "Développement Durable", moyenne: "15,00", statut: "UE acquise", credits: "10 / 10", ok: true },
    { ue: "Système de Management Intégré", moyenne: "9,95", statut: "Rattrapage", credits: "0 / 10", ok: false },
  ];
  const menu = ["Tableau de bord", "Emploi du temps", "Notes", "Relevés", "Absences", "Factures"];
  return (
    <div className="relative mx-auto max-w-5xl rounded-[28px] border border-white/70 dark:border-white/10 bg-white/80 dark:bg-[#161b2e]/90 backdrop-blur-xl overflow-hidden" style={{ boxShadow: "0 40px 80px -30px rgba(23, 19, 58, 0.35)" }} data-testid="landing-apercu">
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#ebeaf5] dark:border-white/10">
        <p className="text-sm font-semibold text-[#17133a] dark:text-white">Portail étudiant · Relevés</p>
        <p className="text-sm font-semibold text-[#17133a] dark:text-white">Awa S.</p>
      </div>
      <div className="grid md:grid-cols-[220px_1fr]">
        <ul className="hidden md:block border-r border-[#ebeaf5] dark:border-white/10 p-4 space-y-1.5 text-sm text-[#5d5a7a] dark:text-[#a3a6c2]">
          {menu.map((m) => (
            <li key={m} className={cn("px-3 py-2 rounded-xl", m === "Relevés" && "bg-[#e3ddff] dark:bg-[#4f46e5]/30 text-[#17133a] dark:text-white font-semibold")}>{m}</li>
          ))}
        </ul>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#17133a] dark:text-white" style={DISPLAY}>Semestre 5 · LQHSE3</p>
              <p className="text-xs text-[#6b6889] dark:text-[#a3a6c2] mt-1">Moyenne du semestre : <strong className="text-[#17133a] dark:text-white">13,31</strong></p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#d1fae5] text-[#047857]">Publié</span>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-[#6b6889] dark:text-[#a3a6c2] mb-1.5"><span>Crédits obtenus</span><span className="font-semibold text-[#17133a] dark:text-white">20 / 30</span></div>
            <div className="h-2 rounded-full bg-[#ebeaf5] dark:bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-[#17133a] dark:bg-[#a5b4fc]" style={{ width: "66.6%" }} /></div>
          </div>
          <ul className="mt-5 divide-y divide-[#ebeaf5] dark:divide-white/10">
            {lignes.map((l) => (
              <li key={l.ue} className="py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_70px_110px_70px] items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-medium text-[#17133a] dark:text-white">{l.ue}</span>
                <span className="text-right sm:text-left font-mono text-[#17133a] dark:text-white" style={MONO}>{l.moyenne}</span>
                <span className={cn("text-xs font-semibold", l.ok ? "text-[#047857] dark:text-emerald-400" : "text-[#b45309] dark:text-amber-400")}>{l.statut}</span>
                <span className="text-right text-xs text-[#6b6889] dark:text-[#a3a6c2]">{l.credits} cr.</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-[#6b6889] dark:text-[#a3a6c2]" style={MONO}>EXEMPLE · moyennes coupées au centième, jamais arrondies</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [portail, setPortail] = useState<CleePortail>("etudiant");
  const [defile, setDefile] = useState(false);

  useEffect(() => {
    const onScroll = () => setDefile(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const p = PORTAILS[portail];

  return (
    <div className="min-h-screen bg-[#f6f5f2] dark:bg-[#0d1117] text-[#17133a] dark:text-[#f1f5f9] overflow-x-hidden">
      {/* Menu en pilule */}
      <header className="fixed top-3 sm:top-5 inset-x-0 z-50 px-3 sm:px-6">
        <nav
          className={cn(
            "mx-auto max-w-5xl flex items-center gap-3 rounded-full border pl-4 pr-2 py-2 transition-all",
            defile || menuOuvert ? "bg-white/90 dark:bg-[#161b2e]/90 border-white dark:border-white/10 backdrop-blur-md" : "bg-white/70 dark:bg-[#161b2e]/60 border-white/70 dark:border-white/10 backdrop-blur",
          )}
          style={{ boxShadow: "0 12px 30px -18px rgba(23, 19, 58, 0.35)" }}
          aria-label="Navigation principale"
        >
          <a href="#haut" className="flex items-center gap-2 flex-shrink-0">
            <span className="w-8 h-8 rounded-full bg-[#17133a] dark:bg-white flex items-center justify-center"><GraduationCap size={16} className="text-white dark:text-[#17133a]" /></span>
            <span className="font-bold text-[15px]" style={DISPLAY}>EduManage</span>
            <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-[#e3ddff] dark:bg-[#4f46e5]/30 text-[#3730a3] dark:text-[#c7d2fe] font-semibold" style={MONO}>UCAO</span>
          </a>
          <div className="hidden md:flex items-center gap-7 mx-auto text-sm font-medium text-[#3d3a5c] dark:text-[#c3c6dd]">
            {LIENS.map((l) => <a key={l.href} href={l.href} className="hover:text-[#4f46e5] dark:hover:text-white transition-colors">{l.label}</a>)}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/login" className="px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold bg-[#17133a] text-white dark:bg-white dark:text-[#17133a] hover:bg-[#2b2563] dark:hover:bg-indigo-50 transition-colors" data-testid="nav-login">
              Se connecter
            </Link>
            <button className="md:hidden p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10" onClick={() => setMenuOuvert((o) => !o)} aria-label={menuOuvert ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOuvert} data-testid="landing-menu">
              {menuOuvert ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>
        {menuOuvert && (
          <div className="md:hidden mx-auto max-w-5xl mt-2 rounded-3xl bg-white/95 dark:bg-[#161b2e]/95 backdrop-blur-md border border-white dark:border-white/10 p-3" style={{ boxShadow: "0 20px 40px -20px rgba(23, 19, 58, 0.4)" }}>
            {LIENS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOuvert(false)} className="block px-4 py-3 rounded-2xl text-[15px] font-medium hover:bg-[#f1effa] dark:hover:bg-white/5">{l.label}</a>
            ))}
          </div>
        )}
      </header>

      <main>
        {/* Haut de page */}
        <section id="haut" className="relative pt-32 sm:pt-40 pb-16 sm:pb-24 px-4 sm:px-6">
          <FondPastel />
          <div className="relative max-w-5xl mx-auto text-center">
            <p className="inline-block text-[10.5px] sm:text-xs uppercase tracking-[0.14em] sm:tracking-[0.18em] font-medium px-4 py-2 rounded-full bg-white/70 dark:bg-white/10 border border-white dark:border-white/10 text-[#17133a] dark:text-white mb-7" style={MONO}>
              <span className="hidden sm:inline">UCAO · </span>Scolarité · Finances · Enseignement
            </p>
            <h1 className="text-[42px] leading-[0.95] sm:text-7xl lg:text-[92px] font-extrabold tracking-[-0.045em]" style={DISPLAY} data-testid="landing-titre">
              Toute l&apos;université.<br />
              <span className="text-[#4f46e5] dark:text-[#a5b4fc]">Un seul espace.</span>
            </h1>
            <p className="mt-6 sm:mt-8 text-[17px] sm:text-xl leading-relaxed text-[#3d3a5c] dark:text-[#c3c6dd] max-w-2xl mx-auto">
              Notes, emploi du temps, cahiers de séance, factures et délibérations : étudiants, professeurs et administration de l&apos;UCAO
              travaillent sur les mêmes informations, chacun dans son portail.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
              <BoutonConnexion testId="hero-cta-primary">Accéder à mon espace</BoutonConnexion>
              <a href="#portails" className="text-[15px] font-semibold underline underline-offset-4 decoration-2 decoration-[#17133a]/30 hover:decoration-[#17133a] dark:decoration-white/30 dark:hover:decoration-white">
                Découvrir les portails
              </a>
            </div>
            <p className="mt-6 text-sm text-[#5d5a7a] dark:text-[#a3a6c2] max-w-xl mx-auto">
              Étudiants : connectez-vous avec votre matricule. Mot de passe oublié ? L&apos;administration vous remet un code d&apos;activation.
            </p>
          </div>
          <div className="relative mt-14 sm:mt-20">
            <ApercuPortail />
          </div>
        </section>

        {/* 01 · Portails */}
        <section id="portails" className="scroll-mt-20 px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-5xl mx-auto">
            <Etiquette>01 · Trois portails</Etiquette>
            <TitreSection>Un portail pour chacun.<br />Les mêmes informations pour tous.</TitreSection>

            <div className="mt-10 grid grid-cols-3 sm:inline-flex gap-1 p-1.5 rounded-full bg-white dark:bg-[#161b2e] border border-[#e6e3f2] dark:border-white/10" role="tablist" aria-label="Portails">
              {(Object.keys(PORTAILS) as CleePortail[]).map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={portail === k}
                  aria-controls="panneau-portail"
                  onClick={() => setPortail(k)}
                  className={cn("px-2 sm:px-5 py-2.5 rounded-full text-[13px] sm:text-sm font-semibold transition-colors", portail === k ? "bg-[#17133a] text-white dark:bg-white dark:text-[#17133a]" : "text-[#3d3a5c] dark:text-[#c3c6dd] hover:bg-[#f1effa] dark:hover:bg-white/5")}
                  data-testid={`landing-portail-${k}`}
                >
                  {PORTAILS[k].label}
                </button>
              ))}
            </div>

            <div id="panneau-portail" role="tabpanel" className="mt-6 grid lg:grid-cols-[1fr_1.15fr] gap-5" data-testid="landing-portail-panneau">
              <div className="rounded-[28px] p-7 sm:p-9 bg-[#17133a] text-white flex flex-col">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#a5b4fc]" style={MONO}>Portail {p.label.toLowerCase()}</p>
                <p className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.05]" style={DISPLAY}>{p.titre}</p>
                <p className="mt-4 text-[15px] leading-relaxed text-[#d4d2ea]">{p.texte}</p>
                <div className="mt-auto pt-8">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#86efac]" style={MONO}>Connexion</p>
                  <p className="mt-1.5 text-sm text-white">{p.connexion}</p>
                </div>
              </div>
              <ul className="rounded-[28px] p-3 sm:p-4 bg-white dark:bg-[#161b2e] border border-[#e6e3f2] dark:border-white/10 divide-y divide-[#efedf7] dark:divide-white/10">
                {p.actions.map(([titre, texte], i) => (
                  <li key={titre} className="flex gap-4 px-3 sm:px-4 py-4">
                    <span className="text-xs text-[#4f46e5] dark:text-[#a5b4fc] pt-0.5 w-6 flex-shrink-0" style={MONO}>{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block font-semibold text-[#17133a] dark:text-white">{titre}</span>
                      <span className="block text-sm text-[#5d5a7a] dark:text-[#a3a6c2] mt-0.5">{texte}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 02 · Tout est relié */}
        <section id="relie" className="scroll-mt-20 px-4 sm:px-6 py-20 sm:py-28 bg-gradient-to-b from-[#1d1846] to-[#2c2566] text-white">
          <div className="max-w-5xl mx-auto">
            <Etiquette sombre>02 · Tout est relié</Etiquette>
            <TitreSection sombre>Saisi une fois.<br />À jour partout.</TitreSection>
            <p className="mt-6 text-[17px] leading-relaxed text-[#d4d2ea] max-w-2xl">
              Personne ne recopie rien : ce qu&apos;une personne enregistre arrive directement chez celles qui en ont besoin.
            </p>
            <div className="mt-10 grid gap-4">
              {FLUX.map((f) => (
                <div key={f.resultat} className="rounded-[24px] bg-white text-[#17133a] p-5 sm:p-6" data-testid="landing-flux">
                  <div className="flex flex-wrap items-center gap-2">
                    {f.etapes.map((e, i) => (
                      <span key={e} className="flex items-center gap-2">
                        <span className={cn("text-[13px] font-semibold px-3.5 py-2 rounded-xl", i === 0 ? "bg-[#ebe9fb]" : i === 1 ? "bg-[#d9d2ff]" : "bg-[#c8f7d8]")}>{e}</span>
                        {i < f.etapes.length - 1 && <ArrowRight size={14} className="text-[#8b88a8]" aria-hidden />}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-[13px] font-medium text-[#047857] bg-[#ecfdf3] rounded-xl px-3.5 py-2.5">
                    <CheckCircle2 size={15} className="flex-shrink-0" /> {f.resultat}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 03 · Règles UCAO */}
        <section id="regles" className="scroll-mt-20 px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-5xl mx-auto">
            <Etiquette>03 · Les règles de l&apos;UCAO</Etiquette>
            <TitreSection>Le système LMD de l&apos;UCAO.<br />Appliqué à la lettre.</TitreSection>
            <div className="mt-10 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {REGLES.map((r) => (
                <div key={r.texte} className="rounded-[24px] p-5 sm:p-7 bg-white dark:bg-[#161b2e] border border-[#e6e3f2] dark:border-white/10">
                  <p className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#17133a] dark:text-white" style={DISPLAY}>{r.valeur}</span>
                    <span className="text-sm font-semibold text-[#4f46e5] dark:text-[#a5b4fc]">{r.unite}</span>
                  </p>
                  <p className="mt-2 text-sm text-[#5d5a7a] dark:text-[#a3a6c2] leading-snug">{r.texte}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[24px] p-6 sm:p-8 bg-[#c8f7d8] dark:bg-[#123b28] text-[#0b3a22] dark:text-[#c8f7d8] grid sm:grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <p className="text-[11px] uppercase tracking-[0.18em] font-semibold pt-1" style={MONO}>Exemple</p>
              <p className="text-[15px] sm:text-base leading-relaxed">
                Awa obtient <strong>9,95</strong> dans une UE. Sans arrondi, l&apos;UE n&apos;est pas acquise : elle repasse les deux matières au rattrapage,
                et seule une meilleure note remplace son examen. Le jury, qui voit ses heures d&apos;absence, peut aussi repêcher l&apos;UE avec un motif écrit.
              </p>
            </div>
          </div>
        </section>

        {/* 04 · Une année */}
        <section id="annee" className="scroll-mt-20 px-4 sm:px-6 pb-20 sm:pb-28">
          <div className="max-w-5xl mx-auto">
            <Etiquette>04 · Une année avec EduManage</Etiquette>
            <TitreSection>De la rentrée au jury,<br />chaque étape au bon endroit.</TitreSection>
            <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {ANNEE.map((a, i) => (
                <li key={a.titre} className="rounded-[24px] p-5 bg-white dark:bg-[#161b2e] border border-[#e6e3f2] dark:border-white/10">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#4f46e5] dark:text-[#a5b4fc]" style={MONO}>{String(i + 1).padStart(2, "0")} · {a.quand}</p>
                  <p className="mt-3 text-xl font-extrabold tracking-tight" style={DISPLAY}>{a.titre}</p>
                  <p className="mt-1.5 text-sm text-[#5d5a7a] dark:text-[#a3a6c2] leading-snug">{a.texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Questions */}
        <section id="faq" className="scroll-mt-20 px-4 sm:px-6 pb-20 sm:pb-28">
          <div className="max-w-3xl mx-auto">
            <Etiquette>Questions fréquentes</Etiquette>
            <TitreSection className="text-[34px] sm:text-5xl lg:text-5xl">Avant de vous connecter.</TitreSection>
            <div className="mt-8 border-t border-[#dcd9ea] dark:border-white/10">
              {FAQ.map(([q, r]) => (
                <details key={q} className="group border-b border-[#dcd9ea] dark:border-white/10" data-testid="landing-faq">
                  <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-semibold text-[15px] sm:text-base">
                    {q}
                    <Plus size={18} className="flex-shrink-0 transition-transform group-open:rotate-45" aria-hidden />
                  </summary>
                  <p className="pb-5 -mt-1 text-[15px] leading-relaxed text-[#5d5a7a] dark:text-[#a3a6c2] pr-8">{r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Appel final */}
        <section className="px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="relative max-w-5xl mx-auto rounded-[32px] overflow-hidden px-6 py-16 sm:py-24 text-center">
            <FondPastel />
            <div className="relative">
              <h2 className="text-[40px] sm:text-6xl lg:text-7xl font-extrabold tracking-[-0.045em] leading-[0.98]" style={DISPLAY}>
                Votre espace<br />vous attend.
              </h2>
              <p className="mt-5 text-[15px] sm:text-base text-[#3d3a5c] dark:text-[#c3c6dd] max-w-md mx-auto">
                Munissez-vous de votre identifiant et de votre mot de passe. Première connexion : vous choisirez votre propre mot de passe.
              </p>
              <div className="mt-8"><BoutonConnexion testId="cta-login-btn">Se connecter</BoutonConnexion></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e3e0ee] dark:border-white/10 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[#17133a] dark:bg-white flex items-center justify-center"><GraduationCap size={14} className="text-white dark:text-[#17133a]" /></span>
            <span className="font-bold" style={DISPLAY}>EduManage</span>
            <span className="text-[#6b6889] dark:text-[#a3a6c2]">· Université Catholique de l&apos;Afrique de l&apos;Ouest</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-[#6b6889] dark:text-[#a3a6c2]" style={MONO}>
            <Link href="/login" className="underline underline-offset-4 hover:text-[#17133a] dark:hover:text-white">Connexion</Link>
            <a href="#faq" className="underline underline-offset-4 hover:text-[#17133a] dark:hover:text-white">Aide</a>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

