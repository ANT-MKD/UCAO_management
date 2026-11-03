import { describe, expect, it } from "vitest";
import { EcrivainSauvegarde, ErreurSauvegarde, lireEntete, lireSauvegarde, MAGIE, type EntreeSauvegarde } from "@/lib/archiveSauvegarde";

const PHRASE = "Awa SECK a choisi : baobab-lagune-2026";
/** Petits morceaux et peu d'itérations pour des tests rapides ; mêmes règles qu'en vrai. */
const ESSAI = { iterations: 1000, morceau: 64 };
const texte = (t: string) => new TextEncoder().encode(t);

const ENTREES: EntreeSauvegarde[] = [
  { nom: "manifeste.json", contenu: texte('{"format":1,"fichiers":1}') },
  { nom: "donnees.sql", contenu: texte("COPY public.etudiants (id, nom) FROM stdin;\net-awa\tSECK\n\\.\n") },
  { nom: "fichiers/pieces-etudiants/et-awa/photo.jpg", contenu: Uint8Array.from({ length: 300 }, (_, i) => (i * 7) % 256) },
  { nom: "fichiers/vide.txt", contenu: new Uint8Array(0) },
];

async function ecrire(entrees = ENTREES, phrase = PHRASE, options = ESSAI): Promise<Uint8Array> {
  const e = await EcrivainSauvegarde.ouvrir(phrase, options);
  for (const { nom, contenu } of entrees) await e.ajouter(nom, contenu);
  const parties = await e.terminer();
  const total = parties.reduce((s, p) => s + p.length, 0);
  const fichier = new Uint8Array(total);
  let i = 0;
  for (const p of parties) { fichier.set(p, i); i += p.length; }
  return fichier;
}

async function lire(fichier: Uint8Array, phrase = PHRASE): Promise<EntreeSauvegarde[]> {
  const sortie: EntreeSauvegarde[] = [];
  for await (const e of lireSauvegarde(fichier, phrase)) sortie.push(e);
  return sortie;
}

/** Positions des morceaux chiffrés (longueur + contenu) dans le fichier. */
function morceaux(fichier: Uint8Array): { debut: number; fin: number }[] {
  const { suite } = lireEntete(fichier);
  const vue = new DataView(fichier.buffer, fichier.byteOffset);
  const liste: { debut: number; fin: number }[] = [];
  for (let p = suite; p < fichier.length;) {
    const l = vue.getUint32(p);
    liste.push({ debut: p, fin: p + 4 + l });
    p += 4 + l;
  }
  return liste;
}

describe("fichier de sauvegarde chiffré", () => {
  it("se relit à l'identique avec la phrase secrète, entrées vides et morceaux multiples compris", async () => {
    const fichier = await ecrire();
    expect(morceaux(fichier).length).toBeGreaterThan(5);
    expect(await lire(fichier)).toEqual(ENTREES);
  });

  it("contenu d'une taille exactement multiple d'un morceau : la fin reste marquée", async () => {
    const pile = [{ nom: "a", contenu: new Uint8Array(64 - 13) }];
    expect(await lire(await ecrire(pile))).toEqual(pile);
  });

  it("rien n'est lisible sans la phrase : ni les noms, ni les données ; en-tête public seulement", async () => {
    const fichier = await ecrire();
    const brut = new TextDecoder("latin1").decode(fichier);
    expect(brut.startsWith(MAGIE)).toBe(true);
    for (const mot of ["SECK", "donnees.sql", "photo.jpg", "COPY"]) expect(brut).not.toContain(mot);
    const { entete } = lireEntete(fichier);
    expect(entete).toMatchObject({ format: 1, kdf: "PBKDF2-SHA256", iterations: 1000, morceau: 64 });
    expect(Object.keys(entete).sort()).toEqual(["cree_le", "format", "iterations", "kdf", "morceau", "prefixe", "sel"]);
  });

  it("la phrase par défaut coûte 600 000 itérations ; deux sauvegardes identiques ne se ressemblent pas", async () => {
    const e = await EcrivainSauvegarde.ouvrir(PHRASE, { morceau: 64 });
    await e.ajouter("a", texte("b"));
    expect(lireEntete(Uint8Array.from((await e.terminer()).flatMap((p) => [...p]))).entete.iterations).toBe(600_000);
    const [a, b] = [await ecrire(), await ecrire()];
    expect(lireEntete(a).entete.sel).not.toBe(lireEntete(b).entete.sel);
    expect(lireEntete(a).entete.prefixe).not.toBe(lireEntete(b).entete.prefixe);
  });

  it("phrase incorrecte : refus clair", async () => {
    await expect(lire(await ecrire(), "Awa SECK a choisi : baobab-lagune-2025")).rejects.toThrow("Phrase secrète incorrecte");
  });

  it("phrase trop courte : refusée avant toute écriture", async () => {
    await expect(EcrivainSauvegarde.ouvrir("court", ESSAI)).rejects.toThrow("au moins 12 caractères");
  });

  it("fichier tronqué, allongé, réordonné ou modifié : refusé", async () => {
    const fichier = await ecrire();
    const m = morceaux(fichier);
    await expect(lire(fichier.slice(0, m[m.length - 1].debut))).rejects.toThrow(ErreurSauvegarde);
    await expect(lire(fichier.slice(0, fichier.length - 3))).rejects.toThrow(ErreurSauvegarde);
    await expect(lire(Uint8Array.from([...fichier, 0, 0, 0, 0]))).rejects.toThrow(ErreurSauvegarde);
    const inverse = Uint8Array.from([
      ...fichier.slice(0, m[1].debut), ...fichier.slice(m[2].debut, m[2].fin), ...fichier.slice(m[1].debut, m[1].fin), ...fichier.slice(m[2].fin),
    ]);
    await expect(lire(inverse)).rejects.toThrow("abîmé");
    const altere = fichier.slice();
    altere[m[3].debut + 10] ^= 1;
    await expect(lire(altere)).rejects.toThrow("morceau 4");
  });

  it("en-tête modifié (même longueur) : refusé, car il est lié à chaque morceau", async () => {
    const fichier = await ecrire();
    const brut = new TextDecoder("latin1").decode(fichier);
    const position = brut.indexOf('"cree_le":"') + '"cree_le":"'.length;
    const modifie = fichier.slice();
    modifie.set(new TextEncoder().encode("1999"), position);
    expect(lireEntete(modifie).entete.cree_le.startsWith("1999")).toBe(true);
    await expect(lire(modifie)).rejects.toThrow("Phrase secrète incorrecte, ou fichier abîmé");
  });

  it("un autre fichier n'est pas pris pour une sauvegarde", async () => {
    await expect(lire(texte("%PDF-1.7 relevé de notes"))).rejects.toThrow("n'est pas une sauvegarde EduManage");
  });
});
