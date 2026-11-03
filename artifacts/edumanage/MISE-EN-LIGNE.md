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

Node 22 est fixé dans `package.json` (`engines`).

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

## À savoir

- **Offre Hobby** : les conditions de Vercel la réservent à un usage personnel et non commercial.
  Si l'université la juge hors de ce cadre, l'offre Pro est la voie conforme.
- L'ancienne configuration Replit (`.replit`) reste dans le dépôt mais ne sert plus à la mise en
  ligne.
