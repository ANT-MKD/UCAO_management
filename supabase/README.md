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
    passe ;
  - `reprise` (avec session, administrateur principal) : reprise, une fois, des données d'un poste
    d'avant la base (essai avec rapport de contrôle, comptes, fichiers, puis reprise réelle) ;
  - `sauvegarde` (avec session, accès complet) : données et liens des fichiers pour la sauvegarde
    chiffrée, liens de dépôt pour la restauration.
- `restauration/` : l'outil qui restaure une sauvegarde sur un projet neuf (voir plus bas).
- `config.toml` : réglages de l'outil `supabase` (développement local).

## Projets Supabase

| Environnement | Projet | Région | Marque |
| --- | --- | --- | --- |
| Production (en service) | `UCAO_Kairos` (organisation `UCAO_ISAE`, offre gratuite) | Paris (`eu-west-3`) | `production` |
| Test | aucun pour l'instant : un projet gratuit se crée au besoin, puis se supprime | Paris (`eu-west-3`) | `test` |

L'application en ligne (Vercel) lit cette base : réglages et procédure dans
[`artifacts/edumanage/MISE-EN-LIGNE.md`](../artifacts/edumanage/MISE-EN-LIGNE.md).

**Sur la base en service, aucun script de test ne se lance**, même annulé à la fin : les changements
sont vérifiés en local (`tests/lancer.sh`, `tests/lancer-fonctions.sh`) et dans les vérifications
GitHub, puis appliqués ; sur la production, seules des lectures de contrôle.

La marque (`private.environnement`) se pose à la main, jamais par une migration :

```sql
insert into private.environnement (nom) values ('test');
```

Seul un projet marqué `test` peut être remis à zéro (voir plus bas).

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

## Campagne de recette (environnement de test)

1. **Installer** : ouvrir l'application branchée sur le projet de test ; l'écran d'installation
   crée l'administrateur principal, l'établissement et l'année en cours.
2. **Reprendre les données** d'un poste qui servait avant la base : sur ce poste, se connecter avec
   l'administrateur principal, puis Sécurité → Réinitialisation des données → « Préparer la
   reprise ». L'essai donne le rapport de contrôle (rien n'est enregistré) ; la reprise réelle ne se
   fait qu'une fois. Seule l'année en cours est reprise ; les comptes repris choisissent un nouveau
   mot de passe avec un code remis par l'administration (Sécurité → Codes PIN).
3. **Rejouer les scénarios** du cahier de recette
   (https://claude.ai/artifact/KVW75vCdG5QK5meio33ZiB, à partager avec les testeurs en accès
   « Contributeur ») et y noter, pour chacun, « validé » ou l'anomalie constatée.

### Remise à zéro du projet de test

Entre deux campagnes (par exemple après une correction de la reprise), dans l'éditeur SQL du
projet de test :

```sql
select private.remettre_a_zero_test('REMETTRE A ZERO');
```

Toutes les données, identités, compteurs et la trace de la reprise sont effacés ; les portails
sont rouverts. Le compte rendu indique les fichiers restants (`fichiers_a_retirer`) : Supabase
interdit de les effacer par SQL, ils se retirent depuis le tableau de bord (Storage → chaque
espace → tout sélectionner → supprimer). Sur un projet sans la marque `test`, la fonction refuse.

## Sauvegarder et restaurer

L'offre gratuite de Supabase ne garde **aucune** sauvegarde. La veille quotidienne (Vercel,
`/api/veille`) empêche la mise en pause et mesure l'espace occupé ; les sauvegardes sont faites
par l'établissement lui-même.

### Sauvegarder (chaque semaine)

L'administrateur à accès complet ouvre *Sécurité → Données et sauvegarde → Préparer une
sauvegarde*. Il choisit une phrase secrète (12 caractères au moins) et télécharge un fichier
`edumanage-sauvegarde-AAAA-MM-JJ-HHhMM.edumanage`. Ce fichier contient :

- toutes les données, y compris les identités et les mots de passe chiffrés ;
- tous les fichiers (photos, pièces, documents) ;
- mais pas la marque d'environnement, la veille ni les tentatives de connexion.

Il est chiffré dans le navigateur avec la phrase secrète : sans elle, il est illisible, y compris
pour l'établissement. Le tableau de bord rappelle la sauvegarde après 7 jours (critique après 30).

- Ranger le fichier sur un ordinateur ou un disque de l'université, si possible à deux endroits.
  **Jamais sur GitHub** (le dépôt est public), ni par e-mail.
- Garder la phrase à part du fichier (coffre, enveloppe scellée). Une phrase perdue rend la
  sauvegarde inutilisable.

### Restaurer (projet perdu ou données détruites)

La restauration se fait toujours sur un projet Supabase **neuf** : l'outil refuse une base où des
comptes existent. Tout ce qui a été saisi après la sauvegarde est à ressaisir.

1. **Préparer le projet neuf** (région Paris) :
   - appliquer les migrations : `supabase link --project-ref <ref>` puis `supabase db push` ;
   - déployer les fonctions : `supabase functions deploy connexion comptes reprise sauvegarde` ;
   - faire les réglages du tableau de bord (section plus haut) ;
   - poser la marque : `insert into private.environnement (nom) values ('production');`.
2. **Installer Deno** ([deno.com](https://deno.com)), puis, depuis la racine du dépôt, vérifier la
   sauvegarde (la phrase secrète est demandée) :
   ```sh
   deno run --config supabase/restauration/deno.json --allow-read --allow-write --allow-net --allow-env \
     supabase/restauration/restaurer.ts lire edumanage-sauvegarde-….edumanage
   ```
3. **Restaurer les données**, d'un bloc : rien n'est gardé en cas d'erreur. Le mot de passe de la
   base est demandé. L'adresse est celle du *Session pooler* (*Connect* dans le tableau de bord).
   ```sh
   deno run … supabase/restauration/restaurer.ts base edumanage-sauvegarde-….edumanage \
     --base "postgresql://postgres.<ref>@aws-0-eu-west-3.pooler.supabase.com:5432/postgres"
   ```
4. **Restaurer les fichiers**, sans jamais remplacer un fichier présent. L'outil se connecte comme
   l'administrateur principal, avec son mot de passe d'avant (restauré avec les données) ; il le
   demande sans l'afficher.
   ```sh
   deno run … supabase/restauration/restaurer.ts fichiers edumanage-sauvegarde-….edumanage \
     --projet https://<ref>.supabase.co --cle sb_publishable_… --identifiant <identifiant>
   ```
5. **Rebrancher l'application** : dans Vercel, remplacer `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_PUBLISHABLE_KEY` (Production seulement), puis *Redeploy*. Chacun se reconnecte
   avec son mot de passe habituel.

La commande `lire … --extraire <dossier>` écrit une copie **en clair**, à effacer après usage.
L'outil a été vérifié de bout en bout sur PostgreSQL (`tests/restauration.test.ts`). Un exercice
sur un projet gratuit temporaire, une fois par semestre, confirme qu'il marche aussi chez Supabase.
Supprimer ensuite ce projet : il contient les données réelles.

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

La fonction serveur `reprise`, qui se connecte directement à la base, se teste avec Deno sur une
base neuve (Supabase Auth et l'espace de fichiers imités) :

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres supabase/tests/lancer-fonctions.sh
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
