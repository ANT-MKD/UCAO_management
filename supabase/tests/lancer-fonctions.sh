#!/usr/bin/env bash
# Teste les fonctions serveur qui joignent la base (reprise, sauvegarde) sur un PostgreSQL ordinaire : base
# neuve, imitation de Supabase, migrations, puis les tests Deno. Connexion par les variables PG*.
set -euo pipefail
cd "$(dirname "$0")/.."

# Base neuve : imitation de Supabase, puis toutes les migrations.
base_neuve() {
  psql -v ON_ERROR_STOP=1 -q -X -d postgres -c "drop database if exists $1" -c "create database $1" >/dev/null
  local P=(psql -v ON_ERROR_STOP=1 -q -X -d "$1")
  "${P[@]}" -f tests/supabase-local.sql >/dev/null
  for f in migrations/*.sql; do
    "${P[@]}" -f "$f" >/dev/null
  done
}

export BASE_FONCTIONS="${BASE_FONCTIONS:-edumanage_fonctions}"
export BASE_SOURCE="${BASE_SOURCE:-edumanage_sauvegarde}" BASE_CIBLE="${BASE_CIBLE:-edumanage_restauration}"
base_neuve "$BASE_FONCTIONS"
base_neuve "$BASE_SOURCE"
base_neuve "$BASE_CIBLE"

deno test --config tests/deno.json --allow-env --allow-net --allow-read --allow-write --allow-run=psql \
  tests/fonction_reprise.test.ts tests/fonction_sauvegarde.test.ts
