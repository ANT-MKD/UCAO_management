import { useMemo } from "react";
import { useLocation } from "wouter";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, Column } from "@/components/admin/DataTable";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { ENSEIGNANTS, NIVEAUX } from "@/data/mockData";
import { useSeances } from "@/hooks/useStudentStore";
import { useClasses } from "@/hooks/useStructureStore";
import { formatShortDate } from "@/lib/utils";

type Enseignant = (typeof ENSEIGNANTS)[0];

interface CoursDispense {
  key: string;
  label: string;
}

interface TeacherCourseRow {
  id: string;
  matricule: string;
  prenom: string;
  nom: string;
  dateAjout: string;
  dateAjoutSort: string;
  cours: CoursDispense[];
  searchBlob: string;
}

function stripTitle(prenom: string): string {
  return prenom.replace(/^(Pr\.|Dr\.|M\.|Me\.)\s*/i, "").trim();
}

function matchesProf(enseignant: Enseignant, profLabel: string): boolean {
  const clean = stripTitle(enseignant.prenom);
  const full = `${clean} ${enseignant.nom}`.toLowerCase();
  const label = profLabel.trim().toLowerCase();
  if (label === full) return true;
  const first = clean.split(/\s+/)[0]?.toLowerCase() ?? "";
  return label.includes(enseignant.nom.toLowerCase()) && (!!first && label.includes(first));
}

/** Date d'ajout dérivée de l'année du matricule (ENS-YYYY-NNN) — pas de champ dédié en base. */
function dateAjoutFromMatricule(matricule: string): { display: string; sort: string } {
  const m = matricule.match(/ENS-(\d{4})/i);
  if (!m) return { display: "—", sort: "" };
  const year = m[1];
  const iso = `${year}-09-01`;
  return { display: formatShortDate(iso), sort: iso };
}

function niveauLabel(alias: string): string {
  const n = NIVEAUX.find((x) => x.alias === alias);
  if (n) return n.nom;
  if (/^L\d$/i.test(alias)) return `Licence ${alias.slice(1)}`;
  if (/^M\d$/i.test(alias)) return `Master ${alias.slice(1)}`;
  return alias;
}

function buildCoursLabel(parts: {
  filiere: string;
  annee: string;
  niveau: string;
  classe: string;
  cours: string;
}): string {
  return [parts.filiere, parts.annee, parts.niveau, parts.classe, parts.cours]
    .filter(Boolean)
    .join(" / ");
}

export default function TeacherCoursesPage() {
  const [, setLocation] = useLocation();
  const seances = useSeances();
  const classes = useClasses();

  const rows = useMemo((): TeacherCourseRow[] => {
    const classeById = new Map(classes.map((c) => [c.id, c]));

    return ENSEIGNANTS.map((ens) => {
      const dateInfo = dateAjoutFromMatricule(ens.matricule);
      const seen = new Set<string>();
      const cours: CoursDispense[] = [];

      for (const s of seances) {
        if (!matchesProf(ens, s.prof)) continue;
        const classe = classeById.get(s.classeId);
        const filiere = classe?.filiere ?? "";
        const annee = s.annee || classe?.annee || "";
        const niveau = niveauLabel(classe?.niveau ?? "");
        const label = buildCoursLabel({
          filiere,
          annee,
          niveau,
          classe: s.classe,
          cours: s.ec,
        });
        if (!label || seen.has(label)) continue;
        seen.add(label);
        cours.push({ key: `${s.ecId}-${s.classeId}-${annee}`, label });
      }

      return {
        id: ens.id,
        matricule: ens.matricule,
        prenom: ens.prenom,
        nom: ens.nom,
        dateAjout: dateInfo.display,
        dateAjoutSort: dateInfo.sort,
        cours,
        searchBlob: [ens.matricule, ens.prenom, ens.nom, ...cours.map((c) => c.label)].join(" ").toLowerCase(),
      };
    });
  }, [seances, classes]);

  const columns: Column<TeacherCourseRow>[] = [
    {
      key: "matricule",
      header: "Matricule",
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs font-bold text-muted-foreground" style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {r.matricule}
        </span>
      ),
    },
    {
      key: "nom",
      header: "Nom et prénom",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar name={`${r.prenom} ${r.nom}`} size="sm" />
          <div className="font-medium text-foreground text-sm">
            {r.prenom} {r.nom}
          </div>
        </div>
      ),
    },
    {
      key: "dateAjoutSort",
      header: "Date d'ajout",
      sortable: true,
      render: (r) => <span className="text-sm text-muted-foreground">{r.dateAjout}</span>,
    },
    {
      key: "cours",
      header: "Cours dispensés",
      render: (r) =>
        r.cours.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">Aucun cours programmé</span>
        ) : (
          <ul className="space-y-1.5 max-w-xl">
            {r.cours.map((c) => (
              <li key={c.key}>
                <span className="inline-block text-[11px] leading-snug px-2 py-1 rounded-lg bg-muted text-foreground font-medium">
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Professeurs" }, { label: "Cours programmés" }]}
        title="Cours programmés"
        subtitle="Professeurs et cours dispensés (filière / année / niveau / classe / cours)"
        actions={
          <button
            type="button"
            onClick={() => setLocation("/admin/teachers")}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
          >
            <BookOpen size={15} /> Liste professeurs
          </button>
        }
      />

      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={rows as unknown as Record<string, unknown>[]}
        searchable
        searchPlaceholder="Rechercher matricule, nom, cours…"
        pageSize={10}
        emptyMessage="Aucun professeur trouvé"
        onRowClick={(row) => setLocation(`/admin/teachers/${(row as unknown as TeacherCourseRow).id}`)}
      />
    </div>
  );
}
