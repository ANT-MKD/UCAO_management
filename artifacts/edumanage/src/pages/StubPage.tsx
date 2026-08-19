import { Link } from "wouter";
import { GraduationCap, ArrowLeft, Construction } from "lucide-react";

interface StubPageProps {
  title: string;
  subtitle?: string;
}

export default function StubPage({ title, subtitle }: StubPageProps) {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0d1117] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-5">
        <Construction size={28} className="text-primary" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap size={20} className="text-primary" />
        <span className="font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>
          Edu<span className="text-primary">Manage</span>
        </span>
      </div>
      <h1 className="text-2xl font-extrabold text-foreground mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
        {title}
      </h1>
      <p className="text-muted-foreground max-w-xs mb-8">
        {subtitle ?? "Ce portail est en cours de développement et sera disponible prochainement."}
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <ArrowLeft size={15} /> Retour à l'accueil
      </Link>
    </div>
  );
}
