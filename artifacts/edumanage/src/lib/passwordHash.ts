import { hashSync, compareSync } from "bcryptjs";

const ROUNDS = 10;
const BCRYPT_PREFIX = /^\$2[aby]?\$/;

/** Hache un mot de passe avant stockage dans UserAccountRecord.password — jamais de mot de passe
 * en clair persisté. L'app n'a pas de backend (tout tourne dans le navigateur), donc bcrypt reste
 * calculable par quiconque lit ce fichier ; ça n'est pas une garantie contre un attaquant qui
 * contrôle le client, mais ça empêche l'exposition triviale du mot de passe réel dans
 * localStorage, un export JSON, ou une capture d'écran admin — et prépare le terrain pour un vrai
 * hachage serveur le jour où l'app aura un backend. */
export function hashPassword(password: string): string {
  return hashSync(password, ROUNDS);
}

export function isPasswordHashed(stored: string): boolean {
  return BCRYPT_PREFIX.test(stored);
}

/** Vérifie un mot de passe contre la valeur stockée. Accepte aussi un ancien mot de passe encore
 * en clair (comptes créés avant l'introduction du hachage) — l'appelant est responsable de
 * réécrire le mot de passe haché dans ce cas pour migrer le compte au premier login réussi,
 * plutôt que d'invalider silencieusement tous les comptes existants. */
export function verifyPassword(password: string, stored: string): boolean {
  if (isPasswordHashed(stored)) return compareSync(password, stored);
  return password === stored;
}
