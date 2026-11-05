import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useModelesAttestations } from "@/hooks/useModeleAttestationStore";
import { setModeleAttestation } from "@/data/modeleAttestationStore";
import { useEtablissement } from "@/hooks/useEtablissementStore";
import { useSignatureConfigs } from "@/hooks/useSignatureConfigStore";
import {
  champsDe, copieModele, erreursModele, LIBELLES_MODELES, MODELES_PAR_DEFAUT, PARAGRAPHE_TEXTE_MAX, PARAGRAPHES_MAX, TITRE_MAX,
  type ModeleAttestation, type TypeModele,
} from "@/lib/modelesAttestations";
import { buildAttestationHtml } from "@/pages/admin/AttestationsPage";
import type { AttestationRecord } from "@/data/attestationStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const TYPES: TypeModele[] = ["inscription", "scolarite", "reussite"];

/** Étudiante fictive de l'aperçu : jamais enregistrée. */
const APERCU_ETUDIANT = { sexe: "F" as const, dateNaissance: "2003-05-23", lieuNaissance: "Dakar", nationalite: "Sénégalaise" };
const apercuAttestation = (type: TypeModele): AttestationRecord => ({
  id: "apercu", numero: "ATT-0000-000", etudiantId: "apercu", etudiant: "Awa SECK", matricule: "2026-LPIG-0001",
  classeId: "", classe: "IG3-25/26", filiereId: "", filiere: "Licence professionnelle en informatique de gestion", annee: "2025-2026",
  type, typeLabel: LIBELLES_MODELES[type], semestreLabel: "Semestre 6", moyenneConstatee: 13.58, decisionConstatee: "admis",
  soldeDuConstate: 0, statut: "genere", dateGeneration: new Date().toISOString().slice(0, 10), effectuePar: "",
});

/** Paramètres généraux → Textes des attestations : titre et paragraphes de chaque attestation, avec
 * des champs remplis à l'impression. La base contrôle les textes et fige celui du moment dans
 * chaque attestation émise : modifier un texte ne change pas les attestations déjà délivrées. */
export function TextesAttestationsPanel() {
  const { currentUser } = useAuth();
  const modeles = useModelesAttestations();
  useEtablissement();
  useSignatureConfigs();
  const [type, setType] = useState<TypeModele>("inscription");
  const [formes, setFormes] = useState<Record<TypeModele, ModeleAttestation>>(() => ({
    inscription: copieModele(modeles.inscription), scolarite: copieModele(modeles.scolarite), reussite: copieModele(modeles.reussite),
  }));
  const zones = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [actif, setActif] = useState(0);

  const forme = formes[type];
  const erreurs = erreursModele(type, forme);
  const modifie = JSON.stringify(forme) !== JSON.stringify(modeles[type]);
  const apercu = useMemo(() => buildAttestationHtml(apercuAttestation(type), { modele: forme, etudiant: APERCU_ETUDIANT, niveau: "Licence 3" }), [type, forme]);

  const changer = (m: ModeleAttestation) => setFormes((f) => ({ ...f, [type]: m }));
  const changerParagraphe = (i: number, modif: Partial<ModeleAttestation["paragraphes"][number]>) =>
    changer({ ...forme, paragraphes: forme.paragraphes.map((p, j) => (j === i ? { ...p, ...modif } : p)) });
  const deplacer = (i: number, sens: -1 | 1) => {
    const j = i + sens;
    if (j < 0 || j >= forme.paragraphes.length) return;
    const ps = [...forme.paragraphes];
    [ps[i], ps[j]] = [ps[j], ps[i]];
    changer({ ...forme, paragraphes: ps });
  };

  /** Insère le champ à l'endroit du curseur, dans le dernier paragraphe utilisé. */
  const insererChamp = (cle: string) => {
    if (forme.paragraphes.length === 0) return;
    const i = Math.min(actif, forme.paragraphes.length - 1);
    const zone = zones.current[i];
    const texte = forme.paragraphes[i].texte;
    const debut = zone?.selectionStart ?? texte.length;
    const fin = zone?.selectionEnd ?? texte.length;
    const champ = `{${cle}}`;
    changerParagraphe(i, { texte: texte.slice(0, debut) + champ + texte.slice(fin) });
    requestAnimationFrame(() => {
      const z = zones.current[i];
      if (!z) return;
      z.focus();
      z.setSelectionRange(debut + champ.length, debut + champ.length);
    });
  };

  const enregistrer = () => {
    if (!currentUser || erreurs.length > 0) return;
    const enregistre = { titre: forme.titre.trim(), paragraphes: forme.paragraphes };
    setModeleAttestation(type, enregistre, currentUser.id);
    changer(copieModele(enregistre));
    toast.success(`Texte « ${LIBELLES_MODELES[type]} » enregistré : il s'applique aux prochaines attestations.`);
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="space-y-5" data-testid="textes-attestations">
      <div>
        <h3 className="font-bold text-foreground" style={{ fontFamily: "Outfit, sans-serif" }}>Textes des attestations</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Écrivez les phrases ; les informations de l'étudiant s'insèrent avec les boutons de champs et sont remplies à
          l'impression. Un texte enregistré s'applique aux prochaines attestations : celles déjà délivrées gardent le leur.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button key={t} type="button" onClick={() => { setType(t); setActif(0); }}
            className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-colors", type === t ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-muted")}
            data-testid={`textes-type-${t}`}>
            {LIBELLES_MODELES[t]}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="textes-titre" className="block text-xs font-semibold text-foreground uppercase tracking-wide mb-1.5">Titre du document</label>
        <input id="textes-titre" value={forme.titre} maxLength={TITRE_MAX} onChange={(e) => changer({ ...forme, titre: e.target.value })}
          className={inputClass} data-testid="textes-titre" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Champs</p>
        <p className="text-xs text-muted-foreground">Cliquez dans un paragraphe, puis sur un champ pour l'insérer à cet endroit.</p>
        <div className="flex flex-wrap gap-1.5">
          {champsDe(type).map((c) => (
            <button key={c.cle} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insererChamp(c.cle)}
              className="px-2.5 py-1 rounded-lg border border-border text-xs hover:bg-muted" title={`{${c.cle}}`} data-testid={`textes-champ-${c.cle}`}>
              {c.libelle}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Paragraphes ({forme.paragraphes.length}/{PARAGRAPHES_MAX})</p>
          <button type="button" disabled={forme.paragraphes.length >= PARAGRAPHES_MAX}
            onClick={() => { changer({ ...forme, paragraphes: [...forme.paragraphes, { texte: "", centre: false }] }); setActif(forme.paragraphes.length); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-40" data-testid="textes-ajouter">
            <Plus size={12} /> Ajouter un paragraphe
          </button>
        </div>
        {forme.paragraphes.map((p, i) => (
          <div key={i} className={cn("border rounded-xl p-2.5 space-y-2", actif === i ? "border-primary/60" : "border-border")} data-testid={`textes-paragraphe-${i}`}>
            <textarea ref={(el) => { zones.current[i] = el; }} aria-label={`Paragraphe ${i + 1}`} value={p.texte} maxLength={PARAGRAPHE_TEXTE_MAX} rows={2}
              onFocus={() => setActif(i)} onChange={(e) => changerParagraphe(i, { texte: e.target.value })}
              className={cn(inputClass, "resize-y", p.centre && "text-center")} data-testid={`textes-paragraphe-texte-${i}`} />
            <div className="flex items-center gap-2 text-xs">
              <label className="inline-flex items-center gap-1.5 text-foreground">
                <input type="checkbox" checked={p.centre} onChange={(e) => changerParagraphe(i, { centre: e.target.checked })} data-testid={`textes-paragraphe-centre-${i}`} />
                Centré
              </label>
              <span className="flex-1" />
              <button type="button" aria-label="Monter" onClick={() => deplacer(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"><ArrowUp size={13} /></button>
              <button type="button" aria-label="Descendre" onClick={() => deplacer(i, 1)} disabled={i === forme.paragraphes.length - 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30"><ArrowDown size={13} /></button>
              <button type="button" aria-label="Supprimer le paragraphe" onClick={() => changer({ ...forme, paragraphes: forme.paragraphes.filter((_, j) => j !== i) })}
                className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {erreurs.length > 0 && (
        <ul className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-3 py-2.5 space-y-1" data-testid="textes-erreurs">
          {erreurs.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => changer(copieModele(MODELES_PAR_DEFAUT[type]))}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted" data-testid="textes-retablir">
          <RotateCcw size={14} /> Texte de départ
        </button>
        <button type="button" onClick={enregistrer} disabled={erreurs.length > 0 || !modifie}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-40" data-testid="textes-enregistrer">
          <Save size={14} /> Enregistrer
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Aperçu (étudiante fictive)</p>
        <iframe title="Aperçu de l'attestation" srcDoc={apercu} className="w-full h-[900px] border border-border rounded-xl bg-white" data-testid="textes-apercu" />
      </div>
    </div>
  );
}
