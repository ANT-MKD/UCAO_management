import { Link } from "wouter";
import { PageHeader } from "@/components/admin/PageHeader";

interface RecordNotFoundProps {
  breadcrumb: { label: string; href?: string }[];
  title: string;
  message: string;
  backHref: string;
  backLabel: string;
}

/** Bloc « introuvable » des formulaires de modification : même rendu que les pages de consultation,
 * pour qu'un identifiant inexistant (lien ancien, retour arrière après suppression) n'ouvre plus un
 * formulaire vide qui créerait un doublon ou afficherait un faux succès à l'enregistrement. */
export function RecordNotFound({ breadcrumb, title, message, backHref, backLabel }: RecordNotFoundProps) {
  return (
    <div>
      <PageHeader breadcrumb={breadcrumb} title={title} />
      <div className="bg-card border border-dashed border-border rounded-xl py-16 px-4 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
        <p>{message}</p>
        <Link href={backHref} className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted text-foreground">
          {backLabel}
        </Link>
      </div>
    </div>
  );
}
