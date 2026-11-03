# Mise en ligne de l'application (Vercel)

L'application est un site statique : Vercel la construit à partir de GitHub et la sert ; toutes
les données passent par la base Supabase « UCAO_Kairos ». Les réglages de construction sont
dans `vercel.json`, à côté de ce fichier, et n'ont pas à être repris dans le tableau de bord.

## Ce que fixe `vercel.json`

| Réglage | Valeur | Pourquoi |
| --- | --- | --- |
| Installation | pnpm 10.28.0, versions figées, application seule | Mêmes versions que les vérifications GitHub |
| Construction | `vite build` → `dist/public` | Dossier publié |
| Renvois | toute adresse sauf `/assets/…` → `index.html` | Un lien direct ou une page rechargée ouvre l'application ; un fichier manquant reste introuvable |
| En-têtes | `nosniff`, page non encadrable, pas d'indexation, HTTPS imposé, caméra et micro coupés | Sécurité |
| Cache | fichiers de `/assets` gardés un an | Leur nom change à chaque version |

Node 22 est fixé dans `package.json` (`engines`). Les fonctions de `api/` (visite quotidienne) sont
compilées par Vercel avec leurs propres réglages, `api/tsconfig.json` : ceux de l'application les
empêcheraient de produire leur code, et toute la mise en ligne échouerait.

La construction **s'arrête** avec un message clair :

- si la clé secrète Supabase a été mise à la place de la clé publique (elle serait lisible par
  tous) ;
- si la production est construite sans les variables de la base (l'université travaillerait
  sans le savoir dans le navigateur de chaque poste) ;
- si une seule des deux variables est donnée, ou si l'adresse est mal recopiée.

## Créer le projet (une seule fois)

1. Sur vercel.com : **Add New… → Project**, puis importer le dépôt GitHub
   `ANT-MKD/UCAO_management`. Si Vercel ne le voit pas, l'autoriser dans l'application GitHub de
   Vercel (lien proposé sur la même page).
2. **Root Directory** : `artifacts/edumanage` (bouton *Edit*). Framework : Vite. Ne rien changer
   aux commandes : `vercel.json` les fixe.
3. **Environment Variables**, deux variables :
   - `VITE_SUPABASE_URL` = `https://mrexzmmkvcusfpqhpowk.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = la clé **publique** (`sb_publishable_…`), dans Supabase :
     *Project Settings → API Keys*. Jamais la clé secrète.
4. **Deploy**.
5. Après ce premier déploiement, dans *Settings → Environment Variables*, modifier chacune des deux
   variables pour ne cocher que **Production** (voir « Branches » ci-dessous).
6. *Settings → Git → Production Branch* : `main`.

## Branches

- **`main` = l'application en service** : Vercel met en ligne chaque fusion dans `main` dès
  qu'elle arrive. Ne fusionner que lorsque les vérifications GitHub sont vertes.
- **Les autres branches** donnent des aperçus (*preview*) **sans base** : l'application y tourne
  en mode navigateur, avec des données fictives propres à chaque poste. Elles ne touchent jamais
  aux données réelles. Vercel les réserve aux membres du compte (*Vercel Authentication*).

## Après la mise en ligne

- Adresse : `https://<nom-du-projet>.vercel.app`, en attendant un nom de domaine. C'est elle que
  portent les listes de codes PIN imprimées.
- Supabase : rien à régler pour l'adresse. Les fonctions serveur acceptent tout site (la
  connexion passe par un jeton, pas par un cookie). L'adresse du site dans Supabase
  (*Authentication → URL Configuration*) ne servira qu'aux e-mails avec un lien.
- Revenir à la version précédente : *Deployments* → la version voulue → *Promote* (ou
  *Instant Rollback*). La base n'est pas touchée.

## E-mails par Resend

Les mails de l'application sont toujours déposés dans la messagerie des portails. Resend les envoie
**en plus** par e-mail, à chaque adresse connue : fiches, comptes, contacts externes et adresses
ajoutées. Les alertes du service partent aussi par e-mail (sauvegarde en retard, espace presque
plein). Les codes PIN et les mots de passe ne partent **jamais** par e-mail.

### Régler l'envoi (une seule fois)

1. Dans le compte Resend de l'établissement : *API Keys → Create API Key*, nom « EduManage »,
   permission **Sending access** (pas *Full access*). La clé (`re_…`) ne s'affiche qu'une fois.
2. Dans Supabase, projet UCAO_Kairos : *Edge Functions → Secrets*, ajouter deux secrets :
   - `RESEND_API_KEY` = la clé ;
   - `EDUMANAGE_ALERTES` = l'adresse e-mail du compte Resend (la seule acceptée tant qu'aucun
     domaine n'est vérifié).

   La clé ne se colle **nulle part ailleurs** : ni dans Vercel, ni dans l'application, ni sur
   GitHub, ni dans un message.
3. Vérifier : *Sécurité → Données et sauvegarde*, encadré « E-mails (Resend) ». Il doit indiquer
   l'expéditeur d'essai `EduManage <onboarding@resend.dev>` et votre adresse d'alertes.

### Avec un nom de domaine (plus tard)

Sans domaine vérifié, Resend n'envoie qu'à l'adresse du titulaire du compte : seules les alertes
partent. Les mails de l'établissement sont alors mis de côté, avec ce motif dans « Mails envoyés ».

1. Resend : *Domains → Add domain*, de préférence un sous-domaine (`mail.<domaine>`), en région
   **Ireland (eu-west-1)**. Recopier chez le vendeur du domaine les enregistrements DNS indiqués
   (SPF, DKIM), puis attendre « Verified ».
2. Supabase, *Edge Functions → Secrets* : `EDUMANAGE_EXPEDITEUR` = `UCAO <noreply@mail.<domaine>>`.

Dès lors, chaque mail validé, chaque relance de paiement et chaque alerte partent par e-mail.

### Limites

- Offre gratuite de Resend : 100 e-mails par jour et 3 000 par mois. Au-delà, la file reprend le
  lendemain, sans rien perdre. Un mail à 300 étudiants met donc 3 jours à partir en entier.
  L'offre Pro (50 000 par mois) lève cette limite.
- Un mail qui attend depuis plus de 7 jours n'est plus envoyé (il serait périmé). Une adresse
  refusée par Resend est abandonnée, avec le motif. Une panne est réessayée de plus en plus
  tard, 6 fois au plus.
- L'application envoie juste après chaque mail ; la visite quotidienne reprend ce qui reste.

## À savoir

- **Offre Hobby** : les conditions de Vercel la réservent à un usage personnel et non commercial.
  Si l'université la juge hors de ce cadre, l'offre Pro est la voie conforme.
- L'ancienne configuration Replit (`.replit`) reste dans le dépôt mais ne sert plus à la mise en
  ligne.
