import { enregistrerMiroir, partie } from "@/lib/miroirServeur";
import { getContacts, remplacerContacts, type ContactRecord } from "./contactStore";
import { getDocuments, remplacerDocuments, type DocumentRecord } from "./documentStore";
import { getMemos, remplacerMemos, type MemoRecord } from "./memoStore";
import { getAbandons, remplacerAbandons, type AbandonRecord } from "./abandonStore";

/** Dernières données des dossiers reflétées dans la base (partie 9) : contacts des étudiants,
 * documents (fichier dans l'espace « dossiers ») et mémos des dossiers des étudiants et des
 * enseignants, abandons. Documents et mémos s'ajoutent et se retirent, sans jamais être réécrits ;
 * un abandon ne change plus, sauf sa réintégration, que la base note une fois. */
enregistrerMiroir({
  cle: "edumanage-contact-store-v1",
  parties: [
    partie<ContactRecord>({
      table: "contacts_etudiants",
      colonnes: ["id", "etudiantId", "role", "nomComplet", "telephone", "email", "adresse", "lien"],
      lire: getContacts,
      remplacer: remplacerContacts,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-document-store-v1",
  parties: [
    partie<DocumentRecord>({
      table: "documents_dossiers",
      colonnes: ["id", "entiteType", "entiteId", "nom", ["dataUrl", "fichier_chemin"], "tailleOctets", "ajouteLe", "ajoutePar"],
      sansMiseAJour: true,
      fichiers: { dataUrl: { espace: "dossiers", dossier: (d) => `${d.entiteType}s/${d.entiteId}/${d.id}/` } },
      lire: getDocuments,
      remplacer: remplacerDocuments,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-memo-store-v1",
  parties: [
    partie<MemoRecord>({
      table: "memos_dossiers",
      colonnes: ["id", "entiteType", "entiteId", "type", "date", "objet", "contenu", "auteur"],
      sansMiseAJour: true,
      lire: getMemos,
      remplacer: remplacerMemos,
    }),
  ],
});

enregistrerMiroir({
  cle: "edumanage-abandons-v1",
  parties: [
    partie<AbandonRecord>({
      table: "abandons",
      colonnes: ["id", "etudiantId", "matricule", "nom", "prenom", "email", "telephone", "dateNaissance", "lieuNaissance", "nationalite", "filiere",
        "filiereId", "niveau", "classe", "classeId", "annee", "sessionsAbandonnees", "cumulPaye", "cumulImpaye", "statutAvant", "dateAbandon", "motif",
        "valideParId", "valideParLabel", "reintegre", "dateReintegration", "reintegreParLabel"],
      defauts: { matricule: "", nom: "", prenom: "", email: "", telephone: "", dateNaissance: "", filiere: "", niveau: "", classe: "", annee: "",
        statutAvant: "", valideParLabel: "", sessionsAbandonnees: [], cumulPaye: 0, cumulImpaye: 0 },
      lire: getAbandons,
      remplacer: remplacerAbandons,
    }),
  ],
});
