import type { RapportReprise } from "@/lib/reprise";

/** Rapport de contrôle d'une reprise (essai ou reprise réelle) : table par table, ce qui est reçu,
 * écarté (autre année, lien manquant, règle de la base, compte inconnu) et repris. */
export function VueRapportReprise({ rapport }: { rapport: RapportReprise }) {
  const tables = Object.entries(rapport.tables).filter(([, d]) => d.recues > 0).sort(([a], [b]) => a.localeCompare(b));
  const liens = Object.entries(rapport.liens ?? {}).sort(([, a], [, b]) => b - a);
  const ecartes = rapport.comptes?.ecartes ?? [];
  const nombre = (n: number) => n.toLocaleString("fr-FR");
  return (
    <div className="space-y-4 text-sm" data-testid="rapport-reprise">
      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre titre="Lignes reprises" valeur={nombre(rapport.lignes_reprises)} />
        <Chiffre titre="Comptes créés" valeur={`${nombre(rapport.comptes?.crees ?? 0)} (+ ${nombre(rapport.comptes?.existants ?? 0)} existants)`} />
        <Chiffre titre="Année reprise" valeur={rapport.annee} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Table</th>
              <th className="px-3 py-2 text-right font-medium">Reçues</th>
              <th className="px-3 py-2 text-right font-medium">Autre année</th>
              <th className="px-3 py-2 text-right font-medium">Lien manquant</th>
              <th className="px-3 py-2 text-right font-medium">Refusées</th>
              <th className="px-3 py-2 text-right font-medium">Compte inconnu</th>
              <th className="px-3 py-2 text-right font-medium">Reprises</th>
            </tr>
          </thead>
          <tbody>
            {tables.map(([table, d]) => (
              <tr key={table} className="border-t border-border" data-testid={`rapport-table-${table}`}>
                <td className="px-3 py-1.5 font-medium text-foreground">{table.replace(/_/g, " ")}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{nombre(d.recues)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{d.autre_annee ? nombre(d.autre_annee) : "—"}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${d.liens_manquants ? "text-amber-600" : ""}`}>{d.liens_manquants ? nombre(d.liens_manquants) : "—"}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${d.refusees ? "text-red-600" : ""}`}>{d.refusees ? nombre(d.refusees) : "—"}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums ${d.comptes_inconnus ? "text-amber-600" : ""}`}>{d.comptes_inconnus ? nombre(d.comptes_inconnus) : "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{nombre(d.reprises)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rapport.refus?.length > 0 && (
        <Bloc titre={`Lignes refusées par une règle de la base (${rapport.refus.length})`} ton="rouge">
          {rapport.refus.slice(0, 100).map((r, i) => (
            <li key={i}><span className="font-medium">{r.table.replace(/_/g, " ")}</span> {r.id ? `« ${r.id} »` : ""} : {r.motif}</li>
          ))}
        </Bloc>
      )}
      {liens.length > 0 && (
        <Bloc titre="Lignes écartées faute de lien (autre année, fiche absente du poste)" ton="ambre">
          {liens.map(([lien, n]) => <li key={lien}>{lien} : {nombre(n)}</li>)}
        </Bloc>
      )}
      {ecartes.length > 0 && (
        <Bloc titre={`Comptes non repris (${ecartes.length})`} ton="ambre">
          {ecartes.map((c, i) => <li key={i}>{c.identifiant || c.ancien} : {c.motif}</li>)}
        </Bloc>
      )}
      {(rapport.comptes_non_crees?.length ?? 0) > 0 && (
        <Bloc titre="Comptes dont l'identité n'a pu être créée" ton="rouge">
          {rapport.comptes_non_crees!.map((c, i) => <li key={i}>{c.ancien} : {c.motif}</li>)}
        </Bloc>
      )}
      {(rapport.fichiers_refuses?.length ?? 0) > 0 && (
        <Bloc titre="Fichiers non déposés (la ligne est reprise sans son fichier)" ton="ambre">
          {rapport.fichiers_refuses!.map((f, i) => <li key={i}>{f.espace}/{f.chemin} : {f.motif}</li>)}
        </Bloc>
      )}
      {Object.keys(rapport.compteurs ?? {}).length > 0 && (
        <Bloc titre="Numérotation : les prochains numéros suivront" ton="neutre">
          {Object.entries(rapport.compteurs).map(([cle, valeur]) => <li key={cle}>{cle} : dernier numéro repris {valeur}</li>)}
        </Bloc>
      )}
    </div>
  );
}

function Chiffre({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{titre}</p>
      <p className="text-base font-semibold text-foreground">{valeur}</p>
    </div>
  );
}

function Bloc({ titre, ton, children }: { titre: string; ton: "rouge" | "ambre" | "neutre"; children: React.ReactNode }) {
  const couleurs = { rouge: "border-red-200 dark:border-red-900", ambre: "border-amber-200 dark:border-amber-900", neutre: "border-border" }[ton];
  return (
    <div className={`rounded-xl border ${couleurs} p-3`}>
      <p className="mb-1.5 text-xs font-semibold text-foreground">{titre}</p>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">{children}</ul>
    </div>
  );
}
