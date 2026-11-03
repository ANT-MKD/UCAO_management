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

echo "• salle réservée simultanément (4 connexions × 25 créneaux identiques)"
"${P[@]}" >/dev/null <<SQL
insert into public.niveaux (id, nom, alias, filiere_id) values ('niv-conc', 'Niveau d''essai', 'N1', 'fil-concurrence');
insert into public.classes (id, nom, filiere_id, niveau_id, niveau, max, annee)
  select 'cl-conc-' || i, 'Classe ' || i, 'fil-concurrence', 'niv-conc', 'N1', 40, '2030-2031' from generate_series(1, 4) i;
insert into public.ues (id, code, libelle, credits, filiere_id, niveau) values ('ue-conc', 'UEC', 'UE d''essai', 1, 'fil-concurrence', 'N1');
insert into public.ecs (id, code, libelle, ue_id, credits) values ('ec-conc', 'ECC', 'EC d''essai', 'ue-conc', 1);
insert into public.salles (id, nom) values ('salle-conc', 'Salle d''essai');
SQL
for i in 1 2 3 4; do
  ( echo "select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN\",\"role\":\"authenticated\"}', false);"
    echo "set role authenticated;"
    for jour in 1 2 3 4 5; do for h in 08 09 10 11 12; do
      echo "insert into public.seances (ec_id, classe_id, jour, semaine_du, heure_debut, heure_fin, salle_id, annee) values ('ec-conc', 'cl-conc-$i', $jour, '2030-10-07', '$h:00', '$h:45', 'salle-conc', '2030-2031');"
    done; done
  ) | psql -v ON_ERROR_STOP=0 -q -X -d "$BASE" >/dev/null 2>&1 &
done
wait
"${P[@]}" -c "select tests.verifier((select count(*) = 25 and count(distinct (jour, heure_debut)) = 25 from public.seances where salle_id = 'salle-conc'), 'salle réservée simultanément : 100 demandes, 25 créneaux, un seul cours par créneau')" 2>&1 | sed -n 's/^.*NOTICE:  /  /p; /ERROR/p'
test "${PIPESTATUS[0]}" -eq 0

echo "• encaissements simultanés (4 caisses × 50 versements sur la même quittance)"
"${P[@]}" >/dev/null <<SQL
insert into public.etudiants (id, matricule, prenom, nom, filiere_id, niveau, statut, annee)
  values ('et-conc', '2030-CONC-9999', 'Essai', 'CONCURRENCE', 'fil-concurrence', 'N1', 'inscrit', '2030-2031');
insert into public.quittances (id, numero_recu, date, etudiant_id, lignes, statut)
  values ('q-conc', 'RECU-2030-000', '2030-10-07', 'et-conc', '[{"label": "Scolarité", "montant": 1000000}]', 'paye');
SQL
for i in 1 2 3 4; do
  ( echo "select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN\",\"role\":\"authenticated\"}', false);"
    echo "set role authenticated;"
    for j in $(seq 1 50); do
      echo "insert into public.encaissements (id, reference, date, quittance_id, etudiant_id, montant) values ('enc-conc-$i-$j', 'OP-2030-000', '2030-10-07', 'q-conc', 'et-conc', 1000);"
      echo "insert into public.mouvements_solde (id, etudiant_id, quittance_id, delta_paye, delta_du) values ('mv-conc-$i-$j', 'et-conc', 'q-conc', 1000, 1000);"
    done
  ) | psql -v ON_ERROR_STOP=1 -q -X -d "$BASE" >/dev/null &
done
wait
"${P[@]}" -c "select tests.verifier((select count(*) = 200 and count(distinct reference) = 200 and max(split_part(reference, '-', 3)::int) = 200 from public.encaissements where quittance_id = 'q-conc') and (select montant = 200000 from public.quittances where id = 'q-conc') and (select solde_du = 200000 from public.soldes_etudiants where id = 'et-conc'), 'encaissements simultanés : 200 reçus OP-2030-001 à 200, sans doublon ni trou ; 200 000 F réglés, rien de perdu')" 2>&1 | sed -n 's/^.*NOTICE:  /  /p; /ERROR/p'
test "${PIPESTATUS[0]}" -eq 0

echo "Tous les tests de la base sont passés."
