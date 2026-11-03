-- Fiches des étudiants : plus lues par les professeurs avant la partie 5 (partie 4).
--
-- La base ne sait pas encore quelles classes enseigne chaque professeur (emploi du temps et
-- séances, partie 5). D'ici là, aucun professeur ne lit la fiche d'un étudiant : seuls
-- l'administration et l'étudiant lui-même la lisent. La partie 5 ouvrira aux professeurs la
-- lecture des seules classes qu'ils enseignent.
alter policy etudiants_lecture on public.etudiants
  using ((select private.est_administration()) or id = (select private.etudiant_courant()));
