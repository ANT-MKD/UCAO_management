import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useEtablissement } from "@/hooks/useEtablissementStore";
import { getEtablissement, updateEtablissement, villeEtablissement, type EtablissementInfo, type FormeEntete, type LigneEntete } from "@/data/etablissementStore";
import {
  COULEURS_ENTETE, ENTETE_LIGNES_MAX, ENTETE_TEXTE_MAX, LIGNE_ENTETE_VIDE, LIGNES_ENTETE_EXEMPLE, PIED_LIGNES_MAX, PIED_TEXTE_MAX,
  STYLES_ENTETE, TAILLES_ENTETE, VILLE_MAX, enteteScolaireHtml, erreursReglagesDocuments, lireImageDocument, piedScolaireHtml,
} from "@/lib/enteteDocuments";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Reglages = Pick<EtablissementInfo, "enteteForme" | "banniereDataUrl" | "logoDroitDataUrl" | "enteteLignes" | "enteteCadre" | "piedLignes" | "ville">;

const FORMES: { valeur: FormeEntete; titre: string; detail: string }[] = [
  { valeur: "standard", titre: "Présentation actuelle", detail: "Les documents gardent l'en-tête livré avec l'application." },
  { valeur: "banniere", titre: "Bannière", detail: "Une seule image qui contient tout l'en-tête : logos, textes et cadre." },
  { valeur: "compose", titre: "En-tête composé", detail: "Logo de l'établissement à gauche, logo de droite et lignes de texte au centre." },
];

const reglagesDe = (e: EtablissementInfo): Reglages => ({
  enteteForme: e.enteteForme,
  banniereDataUrl: e.banniereDataUrl,
  logoDroitDataUrl: e.logoDroitDataUrl,
  enteteLignes: e.enteteLignes.map((l) => ({ ...l })),
  enteteCadre: e.enteteCadre,
  piedLignes: Array.from({ length: PIED_LIGNES_MAX }, (_, i) => e.piedLignes[i] ?? ""),
  ville: e.ville,
});

/** Ce qui part vers la base : lignes vides retirées, textes sans espaces en trop. */
const nettoyes = (r: Reglages): Reglages => ({
  ...r,
  enteteLignes: r.enteteLignes.map((l) => ({ ...l, texte: l.texte.trim() })).filter((l) => l.texte),
  piedLignes: r.piedLignes.map((l) => l.trim()).filter(Boolean),
  ville: r.ville.trim(),
});

/** Paramètres généraux → Documents officiels : en-tête (bannière ou composé), pied de page et ville
 * de « Fait à » des documents scolaires (attestations, relevés et bulletins, procès-verbaux).
 * Enregistré dans la fiche de l'établissement ; les images vont dans l'espace de fichiers privé. */
export function DocumentsOfficielsPanel() {
  const { currentUser } = useAuth();
  const etablissement = useEtablissement();
  const [form, setForm] = useState<Reglages>(() => reglagesDe(etablissement));
  const [erreurs, setErreurs] = useState<string[]>([]);

  const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";
  const selectClass = "px-2 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  // Aperçu : la fiche telle qu'elle serait enregistrée.
  const apercu = useMemo(() => ({ ...etablissement, ...nettoyes(form) }), [etablissement, form]);
  const enteteApercu = enteteScolaireHtml(apercu);
  const piedApercu = piedScolaireHtml(apercu);

  const changerLigne = (i: number, modif: Partial<LigneEntete>) =>
    setForm((f) => ({ ...f, enteteLignes: f.enteteLignes.map((l, j) => (j === i ? { ...l, ...modif } : l)) }));
  const deplacerLigne = (i: number, sens: -1 | 1) =>
    setForm((f) => {
      const lignes = [...f.enteteLignes];
      const j = i + sens;
      if (j < 0 || j >= lignes.length) return f;
      [lignes[i], lignes[j]] = [lignes[j], lignes[i]];
      return { ...f, enteteLignes: lignes };
    });

  const choisirImage = (champ: "banniereDataUrl" | "logoDroitDataUrl", fichier?: File) => {
    if (!fichier) return;
    lireImageDocument(fichier)
      .then((dataUrl) => setForm((f) => ({ ...f, [champ]: dataUrl })))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Image illisible."));
  };

  const enregistrer = () => {
    if (!currentUser) return;
    const propres = nettoyes(form);
    const trouvees = erreursReglagesDocuments(propres);
    setErreurs(trouvees);
    if (trouvees.length > 0) return;
    updateEtablissement({ ...getEtablissement(), ...propres }, currentUser.id);
    toast.success("En-tête et pied de page des documents enregistrés.");
  };

  return (
    <div className="space-y-6" data-testid="documents-officiels">
      <div>
        <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Documents officiels</h3>
        <p className="text-xs text-muted-foreground mt-1">
          En-tête et pied de page des attestations, des relevés et bulletins et des procès-verbaux de délibération.
          Les reçus, factures et contrats ne changent pas.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">Forme de l'en-tête</legend>
        <div className="grid sm:grid-cols-3 gap-3">
          {FORMES.map((f) => (
            <label key={f.valeur} className={cn("border rounded-xl p-3 cursor-pointer text-sm transition-colors", form.enteteForme === f.valeur ? "border-primary bg-primary/5" : "border-border hover:bg-muted")}>
              <input type="radio" name="forme-entete" value={f.valeur} checked={form.enteteForme === f.valeur}
                onChange={() => setForm((x) => ({ ...x, enteteForme: f.valeur }))} className="sr-only" data-testid={`entete-forme-${f.valeur}`} />
              <span className="block font-semibold text-foreground">{f.titre}</span>
              <span className="block text-xs text-muted-foreground mt-1">{f.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {form.enteteForme === "banniere" && (
        <div className="space-y-2" data-testid="entete-banniere">
          <p className="text-xs text-muted-foreground">
            Image PNG, JPEG ou WebP, 1,9 Mo au plus, enregistrée sans retouche. Pour une impression nette, prévoyez
            environ 2 000 pixels de large.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted cursor-pointer">
              <ImageIcon size={14} /> {form.banniereDataUrl ? "Changer la bannière" : "Choisir la bannière"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { choisirImage("banniereDataUrl", e.target.files?.[0]); e.target.value = ""; }} data-testid="entete-banniere-input" />
            </label>
            {form.banniereDataUrl && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, banniereDataUrl: undefined }))}
                className="text-xs text-red-600 hover:underline" data-testid="entete-banniere-retirer">Retirer</button>
            )}
          </div>
        </div>
      )}

      {form.enteteForme === "compose" && (
        <div className="space-y-4" data-testid="entete-compose">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-border rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Logo de gauche</p>
              {etablissement.logoDataUrl
                ? <img src={etablissement.logoDataUrl} alt="Logo de l'établissement" className="h-16 object-contain" />
                : <p className="text-xs text-muted-foreground">Aucun logo.</p>}
              <p className="text-xs text-muted-foreground mt-2">C'est le logo de l'établissement, à changer dans l'onglet Université.</p>
            </div>
            <div className="border border-border rounded-xl p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Logo de droite</p>
              {form.logoDroitDataUrl && <img src={form.logoDroitDataUrl} alt="Logo de droite" className="h-16 object-contain mb-2" data-testid="entete-logo-droit-apercu" />}
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                  <ImageIcon size={12} /> {form.logoDroitDataUrl ? "Changer" : "Choisir une image"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => { choisirImage("logoDroitDataUrl", e.target.files?.[0]); e.target.value = ""; }} data-testid="entete-logo-droit-input" />
                </label>
                {form.logoDroitDataUrl && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, logoDroitDataUrl: undefined }))} className="text-xs text-red-600 hover:underline">Retirer</button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Lignes de l'en-tête ({form.enteteLignes.length}/{ENTETE_LIGNES_MAX})</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm((f) => ({ ...f, enteteLignes: LIGNES_ENTETE_EXEMPLE.map((l) => ({ ...l })) }))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted" data-testid="entete-exemple">
                  <Wand2 size={12} /> Exemple UCAO-ISAE
                </button>
                <button type="button" disabled={form.enteteLignes.length >= ENTETE_LIGNES_MAX}
                  onClick={() => setForm((f) => ({ ...f, enteteLignes: [...f.enteteLignes, { ...LIGNE_ENTETE_VIDE }] }))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40" data-testid="entete-ajouter-ligne">
                  <Plus size={12} /> Ajouter une ligne
                </button>
              </div>
            </div>
            {form.enteteLignes.length === 0 && <p className="text-xs text-muted-foreground">Aucune ligne : ajoutez-en, ou partez de l'exemple.</p>}
            {form.enteteLignes.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2" data-testid={`entete-ligne-${i}`}>
                <input aria-label={`Texte de la ligne ${i + 1}`} value={l.texte} maxLength={ENTETE_TEXTE_MAX}
                  onChange={(e) => changerLigne(i, { texte: e.target.value })} className={cn(inputClass, "flex-1 min-w-[220px]")} data-testid={`entete-ligne-texte-${i}`} />
                <select aria-label={`Taille de la ligne ${i + 1}`} value={l.taille} onChange={(e) => changerLigne(i, { taille: e.target.value as LigneEntete["taille"] })} className={selectClass}>
                  {Object.entries(TAILLES_ENTETE).map(([v, t]) => <option key={v} value={v}>{t.libelle}</option>)}
                </select>
                <select aria-label={`Style de la ligne ${i + 1}`} value={l.style} onChange={(e) => changerLigne(i, { style: e.target.value as LigneEntete["style"] })} className={selectClass}>
                  {Object.entries(STYLES_ENTETE).map(([v, t]) => <option key={v} value={v}>{t.libelle}</option>)}
                </select>
                <select aria-label={`Couleur de la ligne ${i + 1}`} value={l.couleur} onChange={(e) => changerLigne(i, { couleur: e.target.value as LigneEntete["couleur"] })} className={selectClass}>
                  {Object.entries(COULEURS_ENTETE).map(([v, t]) => <option key={v} value={v}>{t.libelle}</option>)}
                </select>
                <button type="button" aria-label="Monter" onClick={() => deplacerLigne(i, -1)} disabled={i === 0} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" aria-label="Descendre" onClick={() => deplacerLigne(i, 1)} disabled={i === form.enteteLignes.length - 1} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"><ArrowDown size={14} /></button>
                <button type="button" aria-label="Supprimer la ligne" onClick={() => setForm((f) => ({ ...f, enteteLignes: f.enteteLignes.filter((_, j) => j !== i) }))}
                  className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.enteteCadre} onChange={(e) => setForm((f) => ({ ...f, enteteCadre: e.target.checked }))} data-testid="entete-cadre" />
            Cadre autour de l'en-tête
          </label>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Pied de page</p>
        {form.piedLignes.map((l, i) => (
          <input key={i} aria-label={`Ligne ${i + 1} du pied de page`} value={l} maxLength={PIED_TEXTE_MAX}
            placeholder={["Route de Mont-Rolland", "Tél. : (00221) 33 951 14 81 – Fax : (00221) 33 951 14 81", "E-mail : isaet@ucao.edu.sn – Site web : www.isae-thies.edu.sn"][i]}
            onChange={(e) => setForm((f) => ({ ...f, piedLignes: f.piedLignes.map((x, j) => (j === i ? e.target.value : x)) }))}
            className={inputClass} data-testid={`pied-ligne-${i}`} />
        ))}
      </div>

      <div className="max-w-xs">
        <label htmlFor="documents-ville" className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Ville de « Fait à »</label>
        <input id="documents-ville" value={form.ville} maxLength={VILLE_MAX} placeholder={villeEtablissement({ ...etablissement, ville: "" }) || "Thiès"}
          onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))} className={inputClass} data-testid="documents-ville" />
        <p className="text-xs text-muted-foreground mt-1">Vide : le début de l'adresse de l'établissement.</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Aperçu</p>
        <div className="border border-border rounded-xl bg-white text-black p-6 overflow-x-auto" data-testid="documents-apercu">
          {enteteApercu
            ? <div dangerouslySetInnerHTML={{ __html: enteteApercu }} />
            : <p className="text-xs text-gray-500 text-center">En-tête actuel des documents (présentation livrée avec l'application).</p>}
          <div className="my-6 space-y-2" aria-hidden="true">
            <div className="h-2.5 bg-gray-200 rounded w-11/12" /><div className="h-2.5 bg-gray-200 rounded w-10/12" /><div className="h-2.5 bg-gray-200 rounded w-9/12" />
          </div>
          {piedApercu && <div dangerouslySetInnerHTML={{ __html: piedApercu }} />}
        </div>
      </div>

      {erreurs.length > 0 && (
        <ul className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2.5 space-y-1" data-testid="documents-erreurs">
          {erreurs.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={enregistrer}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors" data-testid="documents-enregistrer">
          <Save size={14} /> Enregistrer
        </button>
      </div>
    </div>
  );
}
