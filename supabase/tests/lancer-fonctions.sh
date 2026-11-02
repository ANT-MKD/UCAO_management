#!/usr/bin/env bash
# Teste les fonctions serveur qui joignent la base (reprise) sur un PostgreSQL ordinaire : base
# neuve, imitation de Supabase, migrations, puis les tests Deno. Connexion par les variables PG*.
set -euo pipefail
cd "$(dirname "$0")/.."

export BASE_FONCTIONS="${BASE_FONCTIONS:-edumanage_fonctions}"
psql -v ON_ERROR_STOP=1 -q -X -d postgres -c "drop database if exists $BASE_FONCTIONS" -c "create database $BASE_FONCTIONS" >/dev/null
P=(psql -v ON_ERROR_STOP=1 -q -X -d "$BASE_FONCTIONS")
"${P[@]}" -f tests/supabase-local.sql >/dev/null
for f in migrations/*.sql; do
  "${P[@]}" -f "$f" >/dev/null
done

deno test --config tests/deno.json --allow-env --allow-net --allow-read --allow-write tests/fonction_reprise.test.ts
