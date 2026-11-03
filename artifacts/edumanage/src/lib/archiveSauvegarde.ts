/** Fichier de sauvegarde chiffré d'EduManage (partie 10, lot 3).
 *
 * Sans dépendance : sert à l'application (navigateur) et à l'outil de restauration (Deno).
 *
 * Disposition du fichier :
 *   « EDUMANAGE-SAUVEGARDE-1\n », longueur de l'en-tête (4 octets), en-tête JSON (paramètres
 *   publics : itérations, sel, préfixe des nonces, taille des morceaux), puis des morceaux
 *   chiffrés, chacun précédé de sa longueur (4 octets).
 * Chiffrement : clé AES-256-GCM tirée de la phrase secrète (PBKDF2-SHA256, 600 000 itérations,
 * sel aléatoire) ; le contenu est découpé en morceaux d'1 Mo ; nonce = préfixe aléatoire (8 octets)
 * + rang du morceau ; données associées = en-tête + rang + « dernier morceau ». Un fichier
 * tronqué, réordonné ou modifié est refusé ; sans la phrase, il est illisible.
 * Contenu (une fois déchiffré) : une suite d'entrées « nom, taille, octets ». */

export const MAGIE = "EDUMANAGE-SAUVEGARDE-1\n";
export const ITERATIONS = 600_000;
export const TAILLE_MORCEAU = 1 << 20;
export const PHRASE_MINIMUM = 12;
const TAG = 16;
/** Octets sur un tampon ordinaire (Web Crypto refuse les tampons partagés). */
type Octets = Uint8Array<ArrayBuffer>;

export interface EnteteSauvegarde {
  format: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  sel: string;
  prefixe: string;
  morceau: number;
  cree_le: string;
}

export interface EntreeSauvegarde {
  nom: string;
  contenu: Uint8Array;
}

export class ErreurSauvegarde extends Error {}

const encodeur = new TextEncoder();
const decodeur = new TextDecoder("utf-8", { fatal: true });

function enBase64(octets: Uint8Array): string {
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire);
}

function deBase64(texte: string): Octets {
  return Uint8Array.from(atob(texte), (c) => c.charCodeAt(0));
}

function u32(n: number): Octets {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

function concat(parties: Uint8Array[]): Octets {
  const total = parties.reduce((s, p) => s + p.length, 0);
  const sortie = new Uint8Array(total);
  let i = 0;
  for (const p of parties) {
    sortie.set(p, i);
    i += p.length;
  }
  return sortie;
}

/** Phrase secrète acceptable : assez longue pour résister à une recherche systématique. */
export function motifPhrase(phrase: string): string | null {
  if (phrase.normalize("NFC").length < PHRASE_MINIMUM) return `La phrase secrète doit contenir au moins ${PHRASE_MINIMUM} caractères.`;
  return null;
}

async function deriverCle(phrase: string, sel: Octets, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encodeur.encode(phrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: sel, iterations, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

function nonce(prefixe: Uint8Array, rang: number): Octets {
  return concat([prefixe, u32(rang)]);
}

function associees(entete: Uint8Array, rang: number, dernier: boolean): Octets {
  return concat([entete, u32(rang), new Uint8Array([dernier ? 1 : 0])]);
}

/** Écrit une sauvegarde chiffrée, entrée par entrée ; rend les morceaux du fichier (pour un Blob). */
export class EcrivainSauvegarde {
  private tampon: Uint8Array[] = [];
  private enAttente = 0;
  private rang = 0;
  private readonly sortie: Uint8Array[] = [];

  private constructor(private readonly cle: CryptoKey, private readonly entete: Uint8Array,
    private readonly prefixe: Uint8Array, private readonly morceau: number) {
    this.sortie.push(encodeur.encode(MAGIE), u32(entete.length), entete);
  }

  static async ouvrir(phrase: string, options: { iterations?: number; morceau?: number; maintenant?: Date } = {}): Promise<EcrivainSauvegarde> {
    const motif = motifPhrase(phrase);
    if (motif) throw new ErreurSauvegarde(motif);
    const sel = crypto.getRandomValues(new Uint8Array(16));
    const prefixe = crypto.getRandomValues(new Uint8Array(8));
    const iterations = options.iterations ?? ITERATIONS;
    const morceau = options.morceau ?? TAILLE_MORCEAU;
    const entete: EnteteSauvegarde = {
      format: 1, kdf: "PBKDF2-SHA256", iterations, sel: enBase64(sel), prefixe: enBase64(prefixe), morceau,
      cree_le: (options.maintenant ?? new Date()).toISOString(),
    };
    const cle = await deriverCle(phrase, sel, iterations);
    return new EcrivainSauvegarde(cle, encodeur.encode(JSON.stringify(entete)), prefixe, morceau);
  }

  /** Taille déjà écrite (chiffrée), en octets. */
  get octets(): number {
    return this.sortie.reduce((s, p) => s + p.length, 0);
  }

  async ajouter(nom: string, contenu: Uint8Array): Promise<void> {
    const n = encodeur.encode(nom);
    const taille = new Uint8Array(8);
    const vue = new DataView(taille.buffer);
    vue.setUint32(0, Math.floor(contenu.length / 2 ** 32));
    vue.setUint32(4, contenu.length >>> 0);
    await this.empiler(concat([u32(n.length), n, taille]));
    await this.empiler(contenu);
  }

  private async empiler(octets: Uint8Array): Promise<void> {
    let debut = 0;
    while (debut < octets.length) {
      const place = this.morceau - this.enAttente;
      const part = octets.subarray(debut, debut + place);
      this.tampon.push(part.slice());
      this.enAttente += part.length;
      debut += part.length;
      if (this.enAttente === this.morceau) await this.chiffrer(false);
    }
  }

  private async chiffrer(dernier: boolean): Promise<void> {
    const clair = concat(this.tampon);
    this.tampon = [];
    this.enAttente = 0;
    const chiffre = new Uint8Array(await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce(this.prefixe, this.rang), additionalData: associees(this.entete, this.rang, dernier) },
      this.cle, clair));
    this.sortie.push(u32(chiffre.length), chiffre);
    this.rang++;
  }

  /** Dernier morceau (éventuellement vide), qui marque la fin du fichier. */
  async terminer(): Promise<Uint8Array[]> {
    await this.chiffrer(true);
    return this.sortie;
  }
}

/** En-tête public d'un fichier de sauvegarde (sans la phrase secrète). */
export function lireEntete(fichier: Uint8Array): { entete: EnteteSauvegarde; octetsEntete: Uint8Array; suite: number } {
  const magie = encodeur.encode(MAGIE);
  if (fichier.length < magie.length + 4 || magie.some((o, i) => fichier[i] !== o)) {
    throw new ErreurSauvegarde("Ce fichier n'est pas une sauvegarde EduManage.");
  }
  const longueur = new DataView(fichier.buffer, fichier.byteOffset).getUint32(magie.length);
  const debut = magie.length + 4;
  if (longueur > 4096 || debut + longueur > fichier.length) throw new ErreurSauvegarde("Fichier de sauvegarde abîmé (en-tête).");
  const octetsEntete = fichier.slice(debut, debut + longueur);
  let entete: EnteteSauvegarde;
  try {
    entete = JSON.parse(decodeur.decode(octetsEntete)) as EnteteSauvegarde;
  } catch {
    throw new ErreurSauvegarde("Fichier de sauvegarde abîmé (en-tête).");
  }
  if (entete.format !== 1 || entete.kdf !== "PBKDF2-SHA256" || !(entete.iterations >= 1) || !(entete.morceau >= 1)) {
    throw new ErreurSauvegarde("Format de sauvegarde inconnu : utilisez une version plus récente de l'outil.");
  }
  return { entete, octetsEntete, suite: debut + longueur };
}

/** Déchiffre une sauvegarde et rend ses entrées dans l'ordre. */
export async function* lireSauvegarde(fichier: Uint8Array, phrase: string): AsyncGenerator<EntreeSauvegarde> {
  const { entete, octetsEntete, suite } = lireEntete(fichier);
  const cle = await deriverCle(phrase, deBase64(entete.sel), entete.iterations);
  const prefixe = deBase64(entete.prefixe);
  const vue = new DataView(fichier.buffer, fichier.byteOffset, fichier.byteLength);
  let position = suite;
  let rang = 0;
  let clair: Octets = new Uint8Array(0);
  let fini = false;
  while (!fini) {
    if (position + 4 > fichier.length) throw new ErreurSauvegarde("Fichier de sauvegarde incomplet : la fin manque.");
    const longueur = vue.getUint32(position);
    position += 4;
    if (longueur < TAG || longueur > entete.morceau + TAG || position + longueur > fichier.length) {
      throw new ErreurSauvegarde("Fichier de sauvegarde incomplet ou abîmé.");
    }
    const chiffre = fichier.slice(position, position + longueur);
    position += longueur;
    const dernier = position === fichier.length;
    let morceau: Octets;
    try {
      morceau = new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce(prefixe, rang), additionalData: associees(octetsEntete, rang, dernier) }, cle, chiffre));
    } catch {
      throw new ErreurSauvegarde(rang === 0
        ? "Phrase secrète incorrecte, ou fichier abîmé."
        : `Fichier de sauvegarde abîmé ou incomplet (morceau ${rang + 1}).`);
    }
    rang++;
    fini = dernier;
    clair = concat([clair, morceau]);
    // Entrées complètes déjà disponibles.
    for (;;) {
      if (clair.length < 4) break;
      const v = new DataView(clair.buffer, clair.byteOffset, clair.byteLength);
      const lnom = v.getUint32(0);
      if (clair.length < 4 + lnom + 8) break;
      const taille = v.getUint32(4 + lnom) * 2 ** 32 + v.getUint32(8 + lnom);
      const debut = 12 + lnom;
      if (clair.length < debut + taille) break;
      yield { nom: decodeur.decode(clair.subarray(4, 4 + lnom)), contenu: clair.slice(debut, debut + taille) };
      clair = clair.slice(debut + taille);
    }
  }
  if (clair.length > 0) throw new ErreurSauvegarde("Fichier de sauvegarde abîmé : dernière entrée incomplète.");
}
