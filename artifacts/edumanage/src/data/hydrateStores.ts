/** Stores qui mutent un tableau de mockData.ts « en place » (filiereStore, niveauStore,
 * semestreStore, teacherStore, vacationStore) pour que les dizaines de fichiers qui lisent
 * encore FILIERES/NIVEAUX/SEMESTRES/ENSEIGNANTS/VACATIONS directement restent à jour sans
 * réécriture. Leur hydratation depuis localStorage (loadPersisted) se déclenche au chargement
 * du module — mais avec les pages en lazy() par route, ce module ne se chargeait auparavant que
 * si la page courante importait ce store précis. Une page qui ne l'importe pas (ex: le formulaire
 * Filière, qui lit ENSEIGNANTS mais pas teacherStore) rechargée directement affichait donc les
 * données mock vides malgré des enregistrements bien présents en localStorage. Cet import (fait
 * une seule fois, au démarrage) force l'hydratation des 5 stores avant le premier rendu. */
import "./filiereStore";
import "./niveauStore";
import "./semestreStore";
import "./teacherStore";
import "./vacationStore";
