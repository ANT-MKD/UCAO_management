# Base de données EduManage (Supabase)

Ce dossier décrit la base de données partagée par les trois portails. Le plan de migration se trouve
dans le document « Plan de migration EduManage ».

## Contenu

- `migrations/` : la structure de la base, dans l'ordre. Ces fichiers font foi ; ils créent à
  l'identique les bases de développement, de test et de production.
- `tests/` : les tests de la base (règles d'accès, garde-fous, numérotation), et `lancer.sh` qui
  les exécute.
- `functions/` : les fonctions serveur, seules à détenir la clé secrète :
  - `connexion` (sans session) : connexion par matricule ou identifiant, installation, « mot de
    passe oublié », réinitialisation par code PIN ;
  - `comptes` (avec session) : création d'un compte par l'administration, changement de mot de
    passe.
- `config.toml` : réglages de l'outil `supabase` (développement local).

## Projets Supabase

| Environnement | Projet | Région |
| --- | --- | --- |
| Développement | `UCAO_Kairos` (organisation `UCAO_ISAE`) | Paris (`eu-west-3`) |

## Réglages du projet dans le tableau de bord Supabase

Ces réglages ne passent pas par les migrations ; ils sont à vérifier sur chaque projet :

- **Data API activée**, schéma `public` exposé (Integrations → Data API) : sans elle,
  l'application ne peut ni lire ni écrire (erreur PGRST002).
- **Inscriptions libres désactivées** (Authentication → Sign In / Providers → « Allow new users to
  sign up » décoché) : seuls l'installation et l'administration créent des comptes.
- **IP Address Forwarding activé** (Authentication → Rate Limits) : les limites de connexion de
  Supabase comptent par élève, et non pour la fonction serveur, partagée par tous.

## Connexion

On se connecte avec son matricule (étudiants) ou son identifiant (administration, professeurs).
Chaque compte a une adresse de connexion technique (`…@comptes.edumanage.invalid`), jamais
montrée : la fonction `connexion` la retrouve, compte les échecs (15 minutes de verrouillage après
5 échecs) et contrôle le compte et son portail. L'application n'utilise la base que si
`artifacts/edumanage/.env.local` donne l'adresse du projet (voir `.env.example`).

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

Les fonctions serveur se vérifient avec Deno (hors du dépôt, qui a son propre `package.json`) :
`npx deno@2.5.6 check functions/connexion/index.ts functions/comptes/index.ts`.

## Règles communes

- Chaque table a ses règles d'accès ; un étudiant ne lit que son dossier, un enseignant que ses
  classes, un compte d'administration limité que les pages de son rôle.
- Le type de compte, le rôle, le rattachement et le blocage ne sont jamais modifiables par
  l'utilisateur lui-même.
- Les fonctions qui contournent les règles d'accès sont dans le schéma `private` (non exposé) et
  ne parlent que du compte connecté.
- L'application n'utilise que la clé publique ; la clé secrète ne quitte jamais le serveur.
