/** Moteur de formules de calcul — écrites comme dans Excel en français :
 *   =SI(MOYENNE_UE >= 10 ; CREDITS_UE ; 0)
 * Le texte est analysé puis calculé par ce petit interpréteur : jamais exécuté comme du code, il
 * ne peut que combiner les valeurs qu'on lui donne (notes, crédits, absences). Une valeur absente
 * (note pas encore saisie) est « vide » : le résultat reste en attente au lieu de compter pour 0. */

export type Valeur = number | string | boolean | Valeur[] | undefined;

type Noeud =
  | { t: "nombre"; v: number }
  | { t: "texte"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "var"; nom: string; pos: number }
  | { t: "appel"; nom: string; args: Noeud[]; pos: number }
  | { t: "unaire"; op: "-" | "+"; x: Noeud; pos: number }
  | { t: "pourcent"; x: Noeud; pos: number }
  | { t: "bin"; op: Operateur; a: Noeud; b: Noeud; pos: number };

type Operateur = "+" | "-" | "*" | "/" | "^" | "&" | "=" | "<>" | "<" | "<=" | ">" | ">=";

export class ErreurFormule extends Error {
  constructor(message: string, public position?: number) {
    super(message);
  }
}

// ------------------------------------------------------------------ Lecture du texte

type Jeton =
  | { t: "nombre"; v: number; pos: number }
  | { t: "texte"; v: string; pos: number }
  | { t: "nom"; v: string; brut: string; pos: number }
  | { t: "op"; v: string; pos: number }
  | { t: "fin"; pos: number };

/** Nom normalisé : majuscules, sans accents (« Moyenne_UE » = « MOYENNE_UE »). */
export function normaliserNom(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

const GUILLEMETS: Record<string, string> = { '"': '"', "“": "”", "«": "»", "”": "”" };

function lire(texte: string): Jeton[] {
  const jetons: Jeton[] = [];
  let i = 0;
  // Le « = » du début (style Excel) est facultatif.
  while (i < texte.length && /\s/.test(texte[i])) i++;
  if (texte[i] === "=") i++;
  while (i < texte.length) {
    const c = texte[i];
    if (/\s/.test(c)) { i++; continue; }
    const debut = i;
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(texte[i + 1] ?? ""))) {
      let s = "";
      while (i < texte.length && /[0-9]/.test(texte[i])) s += texte[i++];
      if ((texte[i] === "," || texte[i] === ".") && /[0-9]/.test(texte[i + 1] ?? "")) {
        s += ".";
        i++;
        while (i < texte.length && /[0-9]/.test(texte[i])) s += texte[i++];
      }
      jetons.push({ t: "nombre", v: Number(s), pos: debut });
      continue;
    }
    if (GUILLEMETS[c]) {
      const fermant = GUILLEMETS[c];
      i++;
      let s = "";
      while (i < texte.length && texte[i] !== fermant && !(fermant === "”" && texte[i] === '"')) s += texte[i++];
      if (i >= texte.length) throw new ErreurFormule("Un texte n'est pas refermé : il manque le guillemet de fin", debut);
      i++;
      jetons.push({ t: "texte", v: s.trim(), pos: debut });
      continue;
    }
    if (/[A-Za-zÀ-ÖØ-öø-ÿ_]/.test(c)) {
      let s = "";
      while (i < texte.length && /[A-Za-zÀ-ÖØ-öø-ÿ0-9_.]/.test(texte[i])) s += texte[i++];
      jetons.push({ t: "nom", v: normaliserNom(s), brut: s, pos: debut });
      continue;
    }
    const deux = texte.slice(i, i + 2);
    if (deux === "<=" || deux === ">=" || deux === "<>") { jetons.push({ t: "op", v: deux, pos: debut }); i += 2; continue; }
    const equivalents: Record<string, string> = { "×": "*", "÷": "/", "≤": "<=", "≥": ">=", "≠": "<>" };
    if (equivalents[c]) { jetons.push({ t: "op", v: equivalents[c], pos: debut }); i++; continue; }
    if ("+-*/^&=<>();%".includes(c)) { jetons.push({ t: "op", v: c, pos: debut }); i++; continue; }
    if (c === ",") throw new ErreurFormule("Séparez les valeurs par « ; » (point-virgule). La virgule sert aux décimales, comme dans 0,3", debut);
    throw new ErreurFormule(`Le caractère « ${c} » n'est pas reconnu`, debut);
  }
  jetons.push({ t: "fin", pos: texte.length });
  return jetons;
}

// ------------------------------------------------------------------ Analyse

interface DefFonction {
  min: number;
  max: number;
  aide: string;
}

/** Fonctions disponibles, avec leur aide (affichée dans l'écran Formules de calcul). */
export const FONCTIONS: Record<string, DefFonction> = {
  SI: { min: 2, max: 3, aide: "SI(condition ; valeur si vrai ; valeur si faux)" },
  ET: { min: 1, max: 30, aide: "ET(condition1 ; condition2 ; …) : vrai si toutes sont vraies" },
  OU: { min: 1, max: 30, aide: "OU(condition1 ; condition2 ; …) : vrai si l'une est vraie" },
  NON: { min: 1, max: 1, aide: "NON(condition) : l'inverse" },
  MOYENNE: { min: 1, max: 30, aide: "MOYENNE(valeurs) : moyenne simple (les valeurs vides sont ignorées)" },
  MOYENNE_PONDEREE: { min: 2, max: 2, aide: "MOYENNE_PONDEREE(valeurs ; poids) : ex. MOYENNE_PONDEREE(MATIERES ; CREDITS_MATIERES)" },
  SOMME: { min: 1, max: 30, aide: "SOMME(valeurs)" },
  MIN: { min: 1, max: 30, aide: "MIN(valeurs) : la plus petite (les valeurs vides sont ignorées)" },
  MAX: { min: 1, max: 30, aide: "MAX(valeurs) : la plus grande — ex. MAX(EXAMEN ; RATTRAPAGE)" },
  NB: { min: 1, max: 30, aide: "NB(valeurs) : nombre de valeurs renseignées" },
  ARRONDI: { min: 1, max: 2, aide: "ARRONDI(valeur ; décimales)" },
  TRONQUE: { min: 1, max: 2, aide: "TRONQUE(valeur ; décimales) : coupe sans arrondir" },
  ABS: { min: 1, max: 1, aide: "ABS(valeur) : valeur absolue" },
  ESTVIDE: { min: 1, max: 1, aide: "ESTVIDE(valeur) : vrai si la note n'est pas encore saisie" },
  SIVIDE: { min: 2, max: 2, aide: "SIVIDE(valeur ; remplacement) : la valeur, ou le remplacement si elle est vide" },
};

function analyser(jetons: Jeton[]): Noeud {
  let k = 0;
  const courant = () => jetons[k];
  const estOp = (v: string) => { const j = courant(); return j.t === "op" && j.v === v; };
  const apres = (j: Jeton) => (j.t === "fin" ? "la fin" : j.t === "op" ? `« ${j.v} »` : j.t === "nom" ? `« ${j.brut} »` : j.t === "texte" ? `le texte « ${j.v} »` : `« ${j.v} »`);

  function comparaison(): Noeud {
    let a = concat();
    for (;;) {
      const j = courant();
      if (j.t === "op" && ["=", "<>", "<", "<=", ">", ">="].includes(j.v)) {
        k++;
        a = { t: "bin", op: j.v as Operateur, a, b: concat(), pos: j.pos };
      } else return a;
    }
  }
  function concat(): Noeud {
    let a = addition();
    while (estOp("&")) { const pos = courant().pos; k++; a = { t: "bin", op: "&", a, b: addition(), pos }; }
    return a;
  }
  function addition(): Noeud {
    let a = multiplication();
    for (;;) {
      const j = courant();
      if (j.t === "op" && (j.v === "+" || j.v === "-")) { k++; a = { t: "bin", op: j.v, a, b: multiplication(), pos: j.pos }; } else return a;
    }
  }
  function multiplication(): Noeud {
    let a = puissance();
    for (;;) {
      const j = courant();
      if (j.t === "op" && (j.v === "*" || j.v === "/")) { k++; a = { t: "bin", op: j.v, a, b: puissance(), pos: j.pos }; } else return a;
    }
  }
  function puissance(): Noeud {
    const a = unaire();
    if (estOp("^")) { const pos = courant().pos; k++; return { t: "bin", op: "^", a, b: puissance(), pos }; }
    return a;
  }
  function unaire(): Noeud {
    const j = courant();
    if (j.t === "op" && (j.v === "-" || j.v === "+")) { k++; return { t: "unaire", op: j.v, x: unaire(), pos: j.pos }; }
    let x = primaire();
    while (estOp("%")) { const pos = courant().pos; k++; x = { t: "pourcent", x, pos }; }
    return x;
  }
  function primaire(): Noeud {
    const j = courant();
    if (j.t === "nombre") { k++; return { t: "nombre", v: j.v }; }
    if (j.t === "texte") { k++; return { t: "texte", v: j.v }; }
    if (j.t === "nom") {
      k++;
      if (estOp("(")) {
        k++;
        const args: Noeud[] = [];
        if (!estOp(")")) {
          for (;;) {
            if (courant().t === "fin") throw new ErreurFormule(`Parenthèse fermante « ) » manquante après ${j.brut}(`, courant().pos);
            args.push(comparaison());
            if (estOp(";")) { k++; continue; }
            break;
          }
        }
        if (!estOp(")")) {
          const c = courant();
          throw new ErreurFormule(c.t === "fin" ? `Parenthèse fermante « ) » manquante pour ${j.brut}(` : `${apres(c)} est inattendu : séparez les valeurs de ${j.brut} par « ; »`, c.pos);
        }
        k++;
        return { t: "appel", nom: j.v, args, pos: j.pos };
      }
      if (j.v === "VRAI") return { t: "bool", v: true };
      if (j.v === "FAUX") return { t: "bool", v: false };
      return { t: "var", nom: j.v, pos: j.pos };
    }
    if (j.t === "op" && j.v === "(") {
      k++;
      const x = comparaison();
      if (!estOp(")")) throw new ErreurFormule("Parenthèse fermante « ) » manquante", courant().pos);
      k++;
      return x;
    }
    if (j.t === "fin") throw new ErreurFormule(k === 0 ? "La formule est vide" : "La formule s'arrête trop tôt : il manque une valeur à la fin", j.pos);
    throw new ErreurFormule(`${apres(j)} est inattendu à cet endroit`, j.pos);
  }

  const racine = comparaison();
  const reste = courant();
  if (reste.t !== "fin") {
    if (reste.t === "op" && reste.v === ")") throw new ErreurFormule("Parenthèse « ) » en trop", reste.pos);
    if (reste.t === "op" && reste.v === ";") throw new ErreurFormule("« ; » inattendu : il ne sert qu'entre les valeurs d'une fonction, ex. SI(… ; … ; …)", reste.pos);
    throw new ErreurFormule(`${apres(reste)} est inattendu : il manque sans doute un opérateur (+, -, ×…)`, reste.pos);
  }
  return racine;
}

/** Distance d'édition — pour proposer « Vouliez-vous dire RATTRAPAGE ? ». */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

function suggestion(nom: string, possibles: string[]): string {
  const meilleur = possibles.map((p) => ({ p, d: distance(nom, p) })).sort((x, y) => x.d - y.d)[0];
  return meilleur && meilleur.d <= Math.max(2, Math.floor(nom.length / 3)) ? ` Vouliez-vous dire ${meilleur.p} ?` : "";
}

function verifierNoms(n: Noeud, variables: string[]): void {
  switch (n.t) {
    case "var":
      if (!variables.includes(n.nom)) {
        throw new ErreurFormule(`« ${n.nom} » est inconnu ici.${suggestion(n.nom, variables) || ` Valeurs possibles : ${variables.join(", ")}.`}`, n.pos);
      }
      return;
    case "appel": {
      const def = FONCTIONS[n.nom];
      if (!def) {
        if (variables.includes(n.nom)) throw new ErreurFormule(`${n.nom} est une valeur, pas une fonction : retirez la parenthèse qui suit`, n.pos);
        throw new ErreurFormule(`La fonction « ${n.nom} » n'existe pas.${suggestion(n.nom, Object.keys(FONCTIONS))}`, n.pos);
      }
      if (n.args.length < def.min || n.args.length > def.max) {
        throw new ErreurFormule(`${n.nom} attend ${def.min === def.max ? def.min : `${def.min} à ${def.max}`} valeur(s) : ${def.aide}`, n.pos);
      }
      n.args.forEach((a) => verifierNoms(a, variables));
      return;
    }
    case "unaire": case "pourcent": verifierNoms(n.x, variables); return;
    case "bin": verifierNoms(n.a, variables); verifierNoms(n.b, variables); return;
    default: return;
  }
}

export interface FormuleCompilee {
  racine: Noeud;
  texte: string;
}

const cache = new Map<string, FormuleCompilee | ErreurFormule>();

/** Analyse une formule et vérifie qu'elle n'utilise que les valeurs autorisées pour cette étape.
 * Lève ErreurFormule (message en français + position) si elle est incorrecte. */
export function compilerFormule(texte: string, variables: string[]): FormuleCompilee {
  const cle = `${variables.join(",")}\u0000${texte}`;
  const enCache = cache.get(cle);
  if (enCache instanceof ErreurFormule) throw enCache;
  if (enCache) return enCache;
  try {
    const racine = analyser(lire(texte));
    verifierNoms(racine, variables);
    const f = { racine, texte };
    cache.set(cle, f);
    return f;
  } catch (e) {
    if (e instanceof ErreurFormule) cache.set(cle, e);
    throw e;
  }
}

// ------------------------------------------------------------------ Calcul

function aplatir(valeurs: Valeur[]): Valeur[] {
  return valeurs.flatMap((v) => (Array.isArray(v) ? aplatir(v) : [v]));
}

function nombres(valeurs: Valeur[], fonction: string): number[] {
  return aplatir(valeurs).filter((v) => v !== undefined).map((v) => {
    if (typeof v !== "number") throw new ErreurFormule(`${fonction} attend des nombres (reçu « ${String(v)} »)`);
    return v;
  });
}

function decrire(v: Valeur): string {
  if (Array.isArray(v)) return "une liste";
  if (typeof v === "string") return `le texte « ${v} »`;
  if (typeof v === "boolean") return v ? "VRAI" : "FAUX";
  return String(v);
}

function nombre(v: Valeur, quoi: string): number | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) throw new ErreurFormule(`${quoi} : une liste ne peut pas être calculée directement — utilisez MOYENNE(), SOMME(), MIN() ou MAX()`);
  if (typeof v !== "number") throw new ErreurFormule(`${quoi} : ${decrire(v)} n'est pas un nombre`);
  return v;
}

function vraiFaux(v: Valeur): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  throw new ErreurFormule(`La condition doit être VRAI ou FAUX (reçu ${decrire(v)})`);
}

const texteComparable = (s: string) => normaliserNom(s).replace(/\s+/g, " ").trim();

function evaluer(n: Noeud, ctx: Record<string, Valeur>): Valeur {
  switch (n.t) {
    case "nombre": case "texte": case "bool": return n.v;
    case "var": return ctx[n.nom];
    case "unaire": {
      const x = nombre(evaluer(n.x, ctx), `« ${n.op} »`);
      return x === undefined ? undefined : n.op === "-" ? -x : x;
    }
    case "pourcent": {
      const x = nombre(evaluer(n.x, ctx), "« % »");
      return x === undefined ? undefined : x / 100;
    }
    case "bin": {
      const a = evaluer(n.a, ctx), b = evaluer(n.b, ctx);
      if (n.op === "&") return a === undefined || b === undefined ? undefined : `${decrireTexte(a)}${decrireTexte(b)}`;
      if (a === undefined || b === undefined) return undefined;
      if (n.op === "=" || n.op === "<>") {
        let egal: boolean;
        if (typeof a === "string" && typeof b === "string") egal = texteComparable(a) === texteComparable(b);
        else if (typeof a === typeof b && !Array.isArray(a)) egal = Math.abs(Number(a) - Number(b)) < 1e-9 || a === b;
        else throw new ErreurFormule(`Comparaison impossible entre ${decrire(a)} et ${decrire(b)}`, n.pos);
        return n.op === "=" ? egal : !egal;
      }
      const x = nombre(a, `« ${n.op} »`)!, y = nombre(b, `« ${n.op} »`)!;
      switch (n.op) {
        case "+": return x + y;
        case "-": return x - y;
        case "*": return x * y;
        case "/": if (y === 0) throw new ErreurFormule("Division par zéro", n.pos); return x / y;
        case "^": return x ** y;
        case "<": return x < y - 1e-9;
        case "<=": return x <= y + 1e-9;
        case ">": return x > y + 1e-9;
        case ">=": return x >= y - 1e-9;
      }
      return undefined;
    }
    case "appel": return appeler(n, ctx);
  }
}

function decrireTexte(v: Valeur): string {
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "boolean") return v ? "VRAI" : "FAUX";
  return Array.isArray(v) ? "" : String(v ?? "");
}

function appeler(n: Extract<Noeud, { t: "appel" }>, ctx: Record<string, Valeur>): Valeur {
  const arg = (i: number) => evaluer(n.args[i], ctx);
  const tous = () => n.args.map((a) => evaluer(a, ctx));
  switch (n.nom) {
    case "SI": {
      const c = vraiFaux(arg(0));
      if (c === undefined) return undefined;
      return c ? arg(1) : n.args.length > 2 ? arg(2) : false;
    }
    case "ET": case "OU": {
      const v = aplatir(tous()).map(vraiFaux);
      if (v.some((x) => x === undefined)) return undefined;
      return n.nom === "ET" ? v.every(Boolean) : v.some(Boolean);
    }
    case "NON": { const c = vraiFaux(arg(0)); return c === undefined ? undefined : !c; }
    case "MOYENNE": { const v = nombres(tous(), "MOYENNE"); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : undefined; }
    case "SOMME": { const v = nombres(tous(), "SOMME"); return v.length ? v.reduce((s, x) => s + x, 0) : undefined; }
    case "MIN": { const v = nombres(tous(), "MIN"); return v.length ? Math.min(...v) : undefined; }
    case "MAX": { const v = nombres(tous(), "MAX"); return v.length ? Math.max(...v) : undefined; }
    case "NB": return aplatir(tous()).filter((v) => v !== undefined).length;
    case "MOYENNE_PONDEREE": {
      const valeurs = aplatir([arg(0)]), poids = aplatir([arg(1)]);
      if (valeurs.length !== poids.length) throw new ErreurFormule("MOYENNE_PONDEREE : il faut autant de poids que de valeurs", n.pos);
      let total = 0, somme = 0;
      valeurs.forEach((v, i) => {
        if (v === undefined) return;
        const x = nombre(v, "MOYENNE_PONDEREE")!, p = nombre(poids[i], "MOYENNE_PONDEREE") ?? 0;
        total += p; somme += x * p;
      });
      return total > 0 ? somme / total : undefined;
    }
    case "ARRONDI": case "TRONQUE": {
      const x = nombre(arg(0), n.nom);
      const d = n.args.length > 1 ? nombre(arg(1), n.nom) ?? 0 : 0;
      if (x === undefined) return undefined;
      const f = 10 ** d;
      return n.nom === "ARRONDI" ? Math.round(x * f + 1e-9 * Math.sign(x)) / f : Math.trunc(x * f + 1e-9 * Math.sign(x)) / f;
    }
    case "ABS": { const x = nombre(arg(0), "ABS"); return x === undefined ? undefined : Math.abs(x); }
    case "ESTVIDE": { const v = arg(0); return v === undefined || (Array.isArray(v) && aplatir(v).every((x) => x === undefined)); }
    case "SIVIDE": { const v = arg(0); return v === undefined ? arg(1) : v; }
  }
  throw new ErreurFormule(`La fonction « ${n.nom} » n'existe pas`, n.pos);
}

/** Calcule une formule déjà compilée avec les valeurs de l'étudiant. Une note absente rend le
 * résultat vide (undefined) ; une vraie incohérence (texte au lieu d'un nombre…) lève ErreurFormule. */
export function calculerFormule(f: FormuleCompilee, valeurs: Record<string, Valeur>): Valeur {
  return evaluer(f.racine, valeurs);
}
