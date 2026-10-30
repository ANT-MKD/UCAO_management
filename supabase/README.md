# Base de données EduManage (Supabase)

Ce dossier décrit la base de données partagée par les trois portails. Le plan de migration se trouve
dans le document « Plan de migration EduManage ».

## Contenu

- `migrations/` : la structure de la base, dans l'ordre. Ces fichiers font foi ; ils créent à
  l'identique les bases de développement, de test et de production.
- `tests/` : les tests de la base (règles d'accès, garde-fous, numérotation), et `lancer.sh` qui
  les exécute.
- `config.toml` : réglages de l'outil `supabase` (développement local).

## Projets Supabase

| Environnement | Projet | Région |
| --- | --- | --- |
| Développement | `UCAO_Kairos` (organisation `UCAO_ISAE`) | Paris (`eu-west-3`) |

## Ajouter une migration

1. `npx supabase@2.122.0 migration new <nom>` crée le fichier daté dans `migrations/`.
2. Écrire les tables avec, dans le même fichier, leurs droits (`grant`) et leurs règles d'accès
   (RLS) : rien n'est ouvert par défaut.
3. Ajouter les tests dans `tests/<nom>.test.sql` et lancer `supabase/tests/lancer.sh`.
4. Appliquer sur le projet de développement, puis renommer le fichier avec la version enregistrée
   par Supabase pour que l'historique corresponde.

## Lancer les tests

Les tests tournent sur un PostgreSQL ordinaire (17, comme Supabase), avec une imitation minimale de
Supabase (`tests/supabase-local.sql`). Le script prend les variables de connexion habituelles :

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres supabase/tests/lancer.sh
```

Ils sont aussi joués par les vérifications GitHub à chaque envoi.

## Règles communes

- Chaque table a ses règles d'accès ; un étudiant ne lit que son dossier, un enseignant que ses
  classes, un compte d'administration limité que les pages de son rôle.
- Le type de compte, le rôle, le rattachement et le blocage ne sont jamais modifiables par
  l'utilisateur lui-même.
- Les fonctions qui contournent les règles d'accès sont dans le schéma `private` (non exposé) et
  ne parlent que du compte connecté.
- L'application n'utilise que la clé publique ; la clé secrète ne quitte jamais le serveur.
