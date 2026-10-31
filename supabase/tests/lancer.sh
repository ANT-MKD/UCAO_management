#!/usr/bin/env bash
# Teste les migrations sur un PostgreSQL ordinaire (en local ou dans les vérifications GitHub) :
# base neuve, imitation de Supabase, migrations dans l'ordre, chaque fichier *.test.sql, puis un
# essai de numérotation simultanée. Connexion par les variables PG* habituelles (PGHOST, PGPORT,
# PGUSER…), avec un superutilisateur nommé « postgres » comme sur Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${BASE_TEST:-edumanage_test}"
psql -v ON_ERROR_STOP=1 -q -X -d postgres -c "drop database if exists $BASE" -c "create database $BASE" >/dev/null
P=(psql -v ON_ERROR_STOP=1 -q -X -d "$BASE")

"${P[@]}" -f tests/supabase-local.sql >/dev/null
for f in migrations/*.sql; do
  echo "• migration $(basename "$f")"
  "${P[@]}" -f "$f" >/dev/null
done
"${P[@]}" -f tests/outils.sql >/dev/null

for f in tests/*.test.sql; do
  echo "• tests $(basename "$f")"
  "${P[@]}" -f "$f" 2>&1 >/dev/null | sed -n 's/^.*NOTICE:  /  /p; /ERROR/p'
  test "${PIPESTATUS[0]}" -eq 0
done

echo "• numérotation simultanée (4 connexions × 250 numéros)"
"${P[@]}" -c "create table tests.numeros (n bigint)"
for i in 1 2 3 4; do
  ( for j in $(seq 1 250); do echo "insert into tests.numeros select private.prochain_numero('essai:simultane');"; done | "${P[@]}" ) &
done
wait
"${P[@]}" -c "select tests.verifier((select count(*) = 1000 and count(distinct n) = 1000 and max(n) = 1000 from tests.numeros), 'numérotation simultanée : 1000 numéros, aucun doublon')" 2>&1 | sed -n 's/^.*NOTICE:  /  /p; /ERROR/p'

echo "• matricules simultanés (4 connexions × 50 inscriptions)"
ADMIN="00000000-0000-4000-8000-0000000000aa"
"${P[@]}" >/dev/null <<SQL
insert into auth.users (id, email) values ('$ADMIN', 'adm.concurrence@comptes.edumanage.invalid');
insert into public.comptes (id, type_compte, identifiant, nom_affiche, doit_changer_mot_de_passe)
  values ('$ADMIN', 'administration', 'ADM-CONCURRENCE', 'Essai de concurrence', false);
insert into public.annees_academiques (libelle, date_debut, date_fin) values ('2030-2031', '2030-10-01', '2031-07-31');
insert into public.filieres (id, code, nom) values ('fil-concurrence', 'CONC', 'Filière d''essai');
SQL
SORTIES="$(mktemp -d)"
for i in 1 2 3 4; do
  ( echo "select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN\",\"role\":\"authenticated\"}', false);"
    echo "set role authenticated;"
    for j in $(seq 1 50); do echo "select public.attribuer_matricule('fil-concurrence', '2030-2031');"; done
  ) | psql -v ON_ERROR_STOP=1 -q -X -tA -d "$BASE" > "$SORTIES/matricules-$i.txt" &
done
wait
TOTAL=$(cat "$SORTIES"/matricules-*.txt | grep -c '^2030-CONC-')
DIFFERENTS=$(cat "$SORTIES"/matricules-*.txt | grep '^2030-CONC-' | sort -u | wc -l)
rm -rf "$SORTIES"
"${P[@]}" -c "select tests.verifier($TOTAL = 200 and $DIFFERENTS = 200, 'matricules simultanés : 200 inscriptions, 200 matricules différents')" 2>&1 | sed -n 's/^.*NOTICE:  /  /p; /ERROR/p'
test "${PIPESTATUS[0]}" -eq 0

echo "Tous les tests de la base sont passés."
