export const ANNEES_ACADEMIQUES = [
  { id: "aa0", libelle: "2021-2022", actuelle: false },
  { id: "aa0b", libelle: "2022-2023", actuelle: false },
  { id: "aa1", libelle: "2023-2024", actuelle: false },
  { id: "aa2", libelle: "2024-2025", actuelle: false },
  { id: "aa3", libelle: "2025-2026", actuelle: true },
];

export const FILIERES = [
  { id: "f1", code: "LPIG", nom: "Licence Pro Informatique de Gestion", responsable: "Cheikh FALL", nbClasses: 3, nbEtudiants: 145, statut: "actif" },
  { id: "f2", code: "DROIT", nom: "Licence en Droit des Affaires", responsable: "Aminata DIALLO", nbClasses: 2, nbEtudiants: 98, statut: "actif" },
  { id: "f3", code: "GESTION", nom: "Licence en Sciences de Gestion", responsable: "Moussa SY", nbClasses: 4, nbEtudiants: 212, statut: "actif" },
  { id: "f4", code: "COMPTA", nom: "BTS Comptabilité & Gestion", responsable: "Fatou NDIAYE", nbClasses: 2, nbEtudiants: 87, statut: "actif" },
  { id: "f5", code: "BIOMED", nom: "Licence Sciences Biomédicales", responsable: "Ibrahima DIOP", nbClasses: 2, nbEtudiants: 76, statut: "actif" },
  { id: "f6", code: "ANGLAIS", nom: "Licence Langues Étrangères Appliquées", responsable: "Rokhaya BA", nbClasses: 1, nbEtudiants: 35, statut: "inactif" },
];

export const NIVEAUX = [
  { id: "n1", nom: "Licence 1", alias: "L1", cycle: "Licence", filiere: "LPIG", filiereId: "f1" },
  { id: "n2", nom: "Licence 2", alias: "L2", cycle: "Licence", filiere: "LPIG", filiereId: "f1" },
  { id: "n3", nom: "Licence 3", alias: "L3", cycle: "Licence", filiere: "LPIG", filiereId: "f1" },
  { id: "n4", nom: "Licence 1", alias: "L1", cycle: "Licence", filiere: "GESTION", filiereId: "f3" },
  { id: "n5", nom: "Licence 2", alias: "L2", cycle: "Licence", filiere: "GESTION", filiereId: "f3" },
  { id: "n6", nom: "Licence 3", alias: "L3", cycle: "Licence", filiere: "GESTION", filiereId: "f3" },
  { id: "n7", nom: "Master 1", alias: "M1", cycle: "Master", filiere: "GESTION", filiereId: "f3" },
  { id: "n8", nom: "Licence 1", alias: "L1", cycle: "Licence", filiere: "DROIT", filiereId: "f2" },
  { id: "n9", nom: "Licence 2", alias: "L2", cycle: "Licence", filiere: "DROIT", filiereId: "f2" },
  { id: "n10", nom: "BTS 1", alias: "BTS1", cycle: "BTS", filiere: "COMPTA", filiereId: "f4" },
  { id: "n11", nom: "BTS 2", alias: "BTS2", cycle: "BTS", filiere: "COMPTA", filiereId: "f4" },
];

export const SEMESTRES = [
  { id: "s1", nom: "Semestre 1", alias: "S1", niveau: "L1", niveauId: "n1", filiere: "LPIG", periode: "Sep 2025 – Jan 2026", statut: "actif" },
  { id: "s2", nom: "Semestre 2", alias: "S2", niveau: "L1", niveauId: "n1", filiere: "LPIG", periode: "Fév 2026 – Jun 2026", statut: "futur" },
  { id: "s3", nom: "Semestre 1", alias: "S1", niveau: "L2", niveauId: "n2", filiere: "LPIG", periode: "Sep 2025 – Jan 2026", statut: "actif" },
  { id: "s4", nom: "Semestre 2", alias: "S2", niveau: "L2", niveauId: "n2", filiere: "LPIG", periode: "Fév 2026 – Jun 2026", statut: "futur" },
  { id: "s5", nom: "Semestre 1", alias: "S1", niveau: "L1", niveauId: "n4", filiere: "GESTION", periode: "Sep 2025 – Jan 2026", statut: "actif" },
  { id: "s6", nom: "Semestre 2", alias: "S2", niveau: "L1", niveauId: "n4", filiere: "GESTION", periode: "Fév 2026 – Jun 2026", statut: "futur" },
  { id: "s7", nom: "Semestre 1", alias: "S1", niveau: "L1", niveauId: "n8", filiere: "DROIT", periode: "Sep 2025 – Jan 2026", statut: "actif" },
  { id: "s8", nom: "Semestre 2", alias: "S2", niveau: "L1", niveauId: "n8", filiere: "DROIT", periode: "Fév 2026 – Jun 2026", statut: "futur" },
  { id: "s9", nom: "Semestre 1", alias: "S1", niveau: "L3", niveauId: "n3", filiere: "LPIG", periode: "Sep 2024 – Jan 2025", statut: "clos" },
];

export const CLASSES = [
  { id: "cl1", nom: "L1-INFO-A", filiere: "LPIG", filiereId: "f1", niveau: "L1", inscrits: 38, max: 40, delegue: "Moussa SY", annee: "2025-2026" },
  { id: "cl2", nom: "L1-INFO-B", filiere: "LPIG", filiereId: "f1", niveau: "L1", inscrits: 35, max: 40, delegue: "Aminata DIALLO", annee: "2025-2026" },
  { id: "cl3", nom: "L2-INFO-A", filiere: "LPIG", filiereId: "f1", niveau: "L2", inscrits: 30, max: 35, delegue: "Cheikh FALL", annee: "2025-2026" },
  { id: "cl4", nom: "L1-GEST-A", filiere: "GESTION", filiereId: "f3", niveau: "L1", inscrits: 42, max: 45, delegue: "Fatou NDIAYE", annee: "2025-2026" },
  { id: "cl5", nom: "L2-GEST-A", filiere: "GESTION", filiereId: "f3", niveau: "L2", inscrits: 38, max: 45, delegue: "Ibrahima DIOP", annee: "2025-2026" },
  { id: "cl6", nom: "L1-DROIT-A", filiere: "DROIT", filiereId: "f2", niveau: "L1", inscrits: 45, max: 50, delegue: "Rokhaya BA", annee: "2025-2026" },
  { id: "cl7", nom: "BTS1-COMPTA", filiere: "COMPTA", filiereId: "f4", niveau: "BTS1", inscrits: 28, max: 30, delegue: "Abdoulaye NIANG", annee: "2025-2026" },
  { id: "cl8", nom: "L3-INFO-A", filiere: "LPIG", filiereId: "f1", niveau: "L3", inscrits: 22, max: 30, delegue: "Mariama TOURE", annee: "2025-2026" },
];

export const SALLES = [
  { id: "sa1", nom: "Amphi A", type: "Amphithéâtre", capacite: 200, batiment: "Bloc A", equipements: ["Wifi", "Projecteur", "Climatisation"], statut: "actif" },
  { id: "sa2", nom: "Amphi B", type: "Amphithéâtre", capacite: 150, batiment: "Bloc A", equipements: ["Wifi", "Projecteur"], statut: "actif" },
  { id: "sa3", nom: "Salle 101", type: "Salle de cours", capacite: 50, batiment: "Bloc B", equipements: ["Climatisation", "Tableau"], statut: "actif" },
  { id: "sa4", nom: "Labo Info 1", type: "Laboratoire", capacite: 30, batiment: "Bloc C", equipements: ["Wifi", "Ordinateurs", "Climatisation"], statut: "actif" },
  { id: "sa5", nom: "Salle 205", type: "Salle de cours", capacite: 45, batiment: "Bloc B", equipements: ["Tableau", "Climatisation"], statut: "actif" },
  { id: "sa6", nom: "Salle TD-3", type: "Salle TD", capacite: 25, batiment: "Bloc C", equipements: ["Tableau"], statut: "en_maintenance" },
];

export const UES = [
  { id: "ue1", code: "UE-INFO101", libelle: "Fondements de l'Informatique", credits: 6, filiere: "LPIG", niveau: "L1", semestre: "S1", type: "Fondamentale", nbEc: 3 },
  { id: "ue2", code: "UE-INFO102", libelle: "Algorithmique et Programmation", credits: 8, filiere: "LPIG", niveau: "L1", semestre: "S1", type: "Fondamentale", nbEc: 2 },
  { id: "ue3", code: "UE-INFO201", libelle: "Bases de données avancées", credits: 6, filiere: "LPIG", niveau: "L2", semestre: "S3", type: "Spécialité", nbEc: 2 },
  { id: "ue4", code: "UE-GEST101", libelle: "Introduction à la Gestion", credits: 6, filiere: "GESTION", niveau: "L1", semestre: "S1", type: "Fondamentale", nbEc: 3 },
  { id: "ue5", code: "UE-DROIT101", libelle: "Introduction au Droit", credits: 6, filiere: "DROIT", niveau: "L1", semestre: "S1", type: "Fondamentale", nbEc: 2 },
  { id: "ue6", code: "UE-INFO103", libelle: "Réseaux et Systèmes", credits: 4, filiere: "LPIG", niveau: "L1", semestre: "S2", type: "Spécialité", nbEc: 2 },
];

export const ECS = [
  { id: "ec1", code: "EC-INFO1011", libelle: "Architecture des Ordinateurs", ue: "UE-INFO101", ueId: "ue1", coeff: 2, credits: 2, volCm: 30, volTd: 15, responsable: "Cheikh FALL" },
  { id: "ec2", code: "EC-INFO1012", libelle: "Systèmes d'Exploitation", ue: "UE-INFO101", ueId: "ue1", coeff: 2, credits: 2, volCm: 25, volTd: 20, responsable: "Ibrahima DIOP" },
  { id: "ec3", code: "EC-INFO1021", libelle: "Algorithmique I", ue: "UE-INFO102", ueId: "ue2", coeff: 3, credits: 4, volCm: 40, volTd: 30, responsable: "Cheikh FALL" },
  { id: "ec4", code: "EC-INFO1022", libelle: "Programmation C", ue: "UE-INFO102", ueId: "ue2", coeff: 3, credits: 4, volCm: 35, volTd: 35, responsable: "Moussa SY" },
  { id: "ec5", code: "EC-INFO2011", libelle: "SQL avancé", ue: "UE-INFO201", ueId: "ue3", coeff: 3, credits: 3, volCm: 30, volTd: 20, responsable: "Fatou NDIAYE" },
  { id: "ec6", code: "EC-GEST1011", libelle: "Microéconomie", ue: "UE-GEST101", ueId: "ue4", coeff: 2, credits: 2, volCm: 25, volTd: 15, responsable: "Aminata DIALLO" },
];

export const SEANCES = [
  { id: "se1", ec: "Algorithmique I", ecId: "ec3", classe: "L1-INFO-A", classeId: "cl1", jour: 1, heureDebut: "08:00", heureFin: "10:00", salle: "Amphi B", salleId: "sa2", prof: "Cheikh FALL", type: "CM" },
  { id: "se2", ec: "Programmation C", ecId: "ec4", classe: "L1-INFO-A", classeId: "cl1", jour: 1, heureDebut: "10:30", heureFin: "12:30", salle: "Labo Info 1", salleId: "sa4", prof: "Moussa SY", type: "TP" },
  { id: "se3", ec: "Algorithmique I", ecId: "ec3", classe: "L1-INFO-B", classeId: "cl2", jour: 2, heureDebut: "09:00", heureFin: "11:00", salle: "Amphi B", salleId: "sa2", prof: "Cheikh FALL", type: "CM" },
  { id: "se4", ec: "Architecture des Ordinateurs", ecId: "ec1", classe: "L1-INFO-A", classeId: "cl1", jour: 2, heureDebut: "14:00", heureFin: "16:00", salle: "Salle 101", salleId: "sa3", prof: "Ibrahima DIOP", type: "TD" },
  { id: "se5", ec: "SQL avancé", ecId: "ec5", classe: "L2-INFO-A", classeId: "cl3", jour: 3, heureDebut: "08:00", heureFin: "10:00", salle: "Labo Info 1", salleId: "sa4", prof: "Fatou NDIAYE", type: "TP" },
  { id: "se6", ec: "Microéconomie", ecId: "ec6", classe: "L1-GEST-A", classeId: "cl4", jour: 3, heureDebut: "10:30", heureFin: "12:30", salle: "Amphi A", salleId: "sa1", prof: "Aminata DIALLO", type: "CM" },
  { id: "se7", ec: "Programmation C", ecId: "ec4", classe: "L1-INFO-B", classeId: "cl2", jour: 4, heureDebut: "09:00", heureFin: "11:00", salle: "Labo Info 1", salleId: "sa4", prof: "Moussa SY", type: "TP" },
  { id: "se8", ec: "Algorithmique I", ecId: "ec3", classe: "L1-INFO-A", classeId: "cl1", jour: 4, heureDebut: "14:00", heureFin: "16:00", salle: "Salle 101", salleId: "sa3", prof: "Cheikh FALL", type: "TD" },
  { id: "se9", ec: "Systèmes d'Exploitation", ecId: "ec2", classe: "L1-INFO-A", classeId: "cl1", jour: 5, heureDebut: "08:00", heureFin: "10:00", salle: "Amphi B", salleId: "sa2", prof: "Ibrahima DIOP", type: "CM" },
  { id: "se10", ec: "SQL avancé", ecId: "ec5", classe: "L2-INFO-A", classeId: "cl3", jour: 5, heureDebut: "10:30", heureFin: "12:30", salle: "Salle 205", salleId: "sa5", prof: "Fatou NDIAYE", type: "TD" },
];

export const ETUDIANTS = [
  { id: "et1", prenom: "Moussa", nom: "SY", matricule: "2025-LPIG-0001", sexe: "M", dateNaissance: "2003-04-15", email: "moussa.sy@edu.sn", telephone: "77 123 45 67", filiere: "LPIG", filiereId: "f1", classe: "L1-INFO-A", classeId: "cl1", niveau: "L1", statut: "inscrit", soldeDu: 0, annee: "2025-2026" },
  { id: "et2", prenom: "Aminata", nom: "DIALLO", matricule: "2025-LPIG-0002", sexe: "F", dateNaissance: "2003-08-22", email: "aminata.diallo@edu.sn", telephone: "76 234 56 78", filiere: "LPIG", filiereId: "f1", classe: "L1-INFO-A", classeId: "cl1", niveau: "L1", statut: "inscrit", soldeDu: 75000, annee: "2025-2026" },
  { id: "et3", prenom: "Cheikh", nom: "FALL", matricule: "2025-LPIG-0003", sexe: "M", dateNaissance: "2002-11-08", email: "cheikh.fall@edu.sn", telephone: "70 345 67 89", filiere: "LPIG", filiereId: "f1", classe: "L1-INFO-B", classeId: "cl2", niveau: "L1", statut: "inscrit", soldeDu: 150000, annee: "2025-2026" },
  { id: "et4", prenom: "Fatou", nom: "NDIAYE", matricule: "2025-GEST-0001", sexe: "F", dateNaissance: "2004-01-30", email: "fatou.ndiaye@edu.sn", telephone: "78 456 78 90", filiere: "GESTION", filiereId: "f3", classe: "L1-GEST-A", classeId: "cl4", niveau: "L1", statut: "inscrit", soldeDu: 0, annee: "2025-2026" },
  { id: "et5", prenom: "Ibrahima", nom: "DIOP", matricule: "2025-GEST-0002", sexe: "M", dateNaissance: "2003-06-14", email: "ibrahima.diop@edu.sn", telephone: "77 567 89 01", filiere: "GESTION", filiereId: "f3", classe: "L1-GEST-A", classeId: "cl4", niveau: "L1", statut: "inscrit", soldeDu: 50000, annee: "2025-2026" },
  { id: "et6", prenom: "Rokhaya", nom: "BA", matricule: "2025-DROIT-0001", sexe: "F", dateNaissance: "2003-09-05", email: "rokhaya.ba@edu.sn", telephone: "76 678 90 12", filiere: "DROIT", filiereId: "f2", classe: "L1-DROIT-A", classeId: "cl6", niveau: "L1", statut: "inscrit", soldeDu: 0, annee: "2025-2026" },
  { id: "et7", prenom: "Abdoulaye", nom: "NIANG", matricule: "2025-LPIG-0004", sexe: "M", dateNaissance: "2002-03-18", email: "abdoulaye.niang@edu.sn", telephone: "70 789 01 23", filiere: "LPIG", filiereId: "f1", classe: "L2-INFO-A", classeId: "cl3", niveau: "L2", statut: "inscrit", soldeDu: 200000, annee: "2025-2026" },
  { id: "et8", prenom: "Mariama", nom: "TOURE", matricule: "2025-COMPTA-0001", sexe: "F", dateNaissance: "2004-12-01", email: "mariama.toure@edu.sn", telephone: "77 890 12 34", filiere: "COMPTA", filiereId: "f4", classe: "BTS1-COMPTA", classeId: "cl7", niveau: "BTS1", statut: "suspendu", soldeDu: 350000, annee: "2025-2026" },
  { id: "et9", prenom: "Oumar", nom: "KANE", matricule: "2025-LPIG-0005", sexe: "M", dateNaissance: "2003-07-25", email: "oumar.kane@edu.sn", telephone: "76 901 23 45", filiere: "LPIG", filiereId: "f1", classe: "L1-INFO-A", classeId: "cl1", niveau: "L1", statut: "inscrit", soldeDu: 0, annee: "2025-2026" },
  { id: "et10", prenom: "Adja", nom: "SARR", matricule: "2025-GEST-0003", sexe: "F", dateNaissance: "2003-05-11", email: "adja.sarr@edu.sn", telephone: "78 012 34 56", filiere: "GESTION", filiereId: "f3", classe: "L1-GEST-A", classeId: "cl4", niveau: "L1", statut: "inscrit", soldeDu: 0, annee: "2025-2026" },
  { id: "et11", prenom: "Seydou", nom: "MBAYE", matricule: "2025-LPIG-0006", sexe: "M", dateNaissance: "2002-10-20", email: "seydou.mbaye@edu.sn", telephone: "77 123 45 68", filiere: "LPIG", filiereId: "f1", classe: "L2-INFO-A", classeId: "cl3", niveau: "L2", statut: "inscrit", soldeDu: 75000, annee: "2025-2026" },
  { id: "et12", prenom: "Khadija", nom: "FALL", matricule: "2025-DROIT-0002", sexe: "F", dateNaissance: "2004-02-28", email: "khadija.fall@edu.sn", telephone: "76 234 56 79", filiere: "DROIT", filiereId: "f2", classe: "L1-DROIT-A", classeId: "cl6", niveau: "L1", statut: "inscrit", soldeDu: 100000, annee: "2025-2026" },
  { id: "et13", prenom: "Lamine", nom: "GUEYE", matricule: "2025-LPIG-0007", sexe: "M", dateNaissance: "2003-08-15", email: "lamine.gueye@edu.sn", telephone: "70 345 67 90", filiere: "LPIG", filiereId: "f1", classe: "L1-INFO-B", classeId: "cl2", niveau: "L1", statut: "inscrit", soldeDu: 0, annee: "2025-2026" },
  { id: "et14", prenom: "Aissatou", nom: "DIALLO", matricule: "2025-COMPTA-0002", sexe: "F", dateNaissance: "2003-04-03", email: "aissatou.diallo@edu.sn", telephone: "78 456 78 91", filiere: "COMPTA", filiereId: "f4", classe: "BTS1-COMPTA", classeId: "cl7", niveau: "BTS1", statut: "inscrit", soldeDu: 0, annee: "2025-2026" },
  { id: "et15", prenom: "Pape", nom: "SECK", matricule: "2024-LPIG-0021", sexe: "M", dateNaissance: "2001-12-12", email: "pape.seck@edu.sn", telephone: "77 567 89 02", filiere: "LPIG", filiereId: "f1", classe: "L3-INFO-A", classeId: "cl8", niveau: "L3", statut: "inscrit", soldeDu: 0, annee: "2025-2026" },
];

export const ENSEIGNANTS = [
  { id: "en1", prenom: "Pr. Cheikh", nom: "FALL", matricule: "ENS-2020-001", telephone: "+221771234567", specialite: "Algorithmique & IA", grade: "Permanent", tauxHoraire: 15000, modulesAssignes: 3, heuresMois: 48 },
  { id: "en2", prenom: "Dr. Aminata", nom: "DIALLO", matricule: "ENS-2021-002", telephone: "+221762345678", specialite: "Économie & Gestion", grade: "Permanent", tauxHoraire: 15000, modulesAssignes: 2, heuresMois: 32 },
  { id: "en3", prenom: "Dr. Moussa", nom: "SY", matricule: "ENS-2019-003", telephone: "+221703456789", specialite: "Développement Logiciel", grade: "Contractuel", tauxHoraire: 12000, modulesAssignes: 2, heuresMois: 40 },
  { id: "en4", prenom: "Dr. Fatou", nom: "NDIAYE", matricule: "ENS-2022-004", telephone: "+221784567890", specialite: "Bases de Données", grade: "Permanent", tauxHoraire: 15000, modulesAssignes: 2, heuresMois: 36 },
  { id: "en5", prenom: "M. Ibrahima", nom: "DIOP", matricule: "ENS-2023-005", telephone: "+221775678901", specialite: "Architecture & Réseaux", grade: "Vacataire", tauxHoraire: 8000, modulesAssignes: 2, heuresMois: 24 },
  { id: "en6", prenom: "Me. Rokhaya", nom: "BA", matricule: "ENS-2021-006", telephone: "+221766789012", specialite: "Droit des Affaires", grade: "Vacataire", tauxHoraire: 10000, modulesAssignes: 2, heuresMois: 28 },
  { id: "en7", prenom: "Dr. Abdoulaye", nom: "NIANG", matricule: "ENS-2020-007", telephone: "+221707890123", specialite: "Finance & Comptabilité", grade: "Contractuel", tauxHoraire: 12000, modulesAssignes: 3, heuresMois: 44 },
  { id: "en8", prenom: "Pr. Mariama", nom: "TOURE", matricule: "ENS-2018-008", telephone: "+221778901234", specialite: "Mathématiques Appliquées", grade: "Permanent", tauxHoraire: 15000, modulesAssignes: 4, heuresMois: 52 },
];

export const NOTES = [
  { id: "no1", etudiant: "Moussa SY", etudiantId: "et1", matricule: "2025-LPIG-0001", ec: "Algorithmique I", ecId: "ec3", type: "CC", note: 14.5, statut: "publie" },
  { id: "no2", etudiant: "Aminata DIALLO", etudiantId: "et2", matricule: "2025-LPIG-0002", ec: "Algorithmique I", ecId: "ec3", type: "CC", note: 12.0, statut: "publie" },
  { id: "no3", etudiant: "Cheikh FALL", etudiantId: "et3", matricule: "2025-LPIG-0003", ec: "Algorithmique I", ecId: "ec3", type: "CC", note: 16.5, statut: "publie" },
  { id: "no4", etudiant: "Moussa SY", etudiantId: "et1", matricule: "2025-LPIG-0001", ec: "Programmation C", ecId: "ec4", type: "CC", note: 13.0, statut: "publie" },
  { id: "no5", etudiant: "Aminata DIALLO", etudiantId: "et2", matricule: "2025-LPIG-0002", ec: "Programmation C", ecId: "ec4", type: "CC", note: 9.5, statut: "publie" },
  { id: "no6", etudiant: "Oumar KANE", etudiantId: "et9", matricule: "2025-LPIG-0005", ec: "Algorithmique I", ecId: "ec3", type: "CC", note: 11.0, statut: "brouillon" },
  { id: "no7", etudiant: "Lamine GUEYE", etudiantId: "et13", matricule: "2025-LPIG-0007", ec: "Algorithmique I", ecId: "ec3", type: "CC", note: 8.5, statut: "publie" },
  { id: "no8", etudiant: "Fatou NDIAYE", etudiantId: "et4", matricule: "2025-GEST-0001", ec: "Microéconomie", ecId: "ec6", type: "EF", note: 15.0, statut: "publie" },
  { id: "no9", etudiant: "Ibrahima DIOP", etudiantId: "et5", matricule: "2025-GEST-0002", ec: "Microéconomie", ecId: "ec6", type: "EF", note: 11.5, statut: "publie" },
  { id: "no10", etudiant: "Rokhaya BA", etudiantId: "et6", matricule: "2025-DROIT-0001", ec: "Microéconomie", ecId: "ec6", type: "EF", note: 17.0, statut: "publie" },
];

export const PAIEMENTS = [
  { id: "pa1", date: "2025-09-03", etudiant: "Moussa SY", etudiantId: "et1", classe: "L1-INFO-A", rubrique: "Frais d'inscription", montant: 150000, moyen: "Wave", reference: "WAVE-20250903-001", soldeRestant: 0, statut: "paye" },
  { id: "pa2", date: "2025-09-05", etudiant: "Aminata DIALLO", etudiantId: "et2", classe: "L1-INFO-A", rubrique: "Frais d'inscription", montant: 150000, moyen: "OrangeMoney", reference: "OM-20250905-002", soldeRestant: 75000, statut: "partiel" },
  { id: "pa3", date: "2025-09-08", etudiant: "Cheikh FALL", etudiantId: "et3", classe: "L1-INFO-B", rubrique: "Frais d'inscription", montant: 100000, moyen: "Especes", reference: "ESP-001", soldeRestant: 150000, statut: "partiel" },
  { id: "pa4", date: "2025-10-01", etudiant: "Fatou NDIAYE", etudiantId: "et4", classe: "L1-GEST-A", rubrique: "Scolarité S1", montant: 300000, moyen: "Wave", reference: "WAVE-20251001-003", soldeRestant: 0, statut: "paye" },
  { id: "pa5", date: "2025-10-05", etudiant: "Ibrahima DIOP", etudiantId: "et5", classe: "L1-GEST-A", rubrique: "Scolarité S1", montant: 250000, moyen: "Virement", reference: "VIR-20251005-001", soldeRestant: 50000, statut: "partiel" },
  { id: "pa6", date: "2025-10-10", etudiant: "Rokhaya BA", etudiantId: "et6", classe: "L1-DROIT-A", rubrique: "Inscription + Scolarité S1", montant: 450000, moyen: "Wave", reference: "WAVE-20251010-004", soldeRestant: 0, statut: "paye" },
  { id: "pa7", date: "2025-10-15", etudiant: "Abdoulaye NIANG", etudiantId: "et7", classe: "L2-INFO-A", rubrique: "Scolarité S1", montant: 175000, moyen: "OrangeMoney", reference: "OM-20251015-005", soldeRestant: 200000, statut: "partiel" },
  { id: "pa8", date: "2025-11-01", etudiant: "Mariama TOURE", etudiantId: "et8", classe: "BTS1-COMPTA", rubrique: "Scolarité S1", montant: 150000, moyen: "Especes", reference: "ESP-002", soldeRestant: 350000, statut: "partiel" },
  { id: "pa9", date: "2025-11-05", etudiant: "Moussa SY", etudiantId: "et1", classe: "L1-INFO-A", rubrique: "Scolarité S1", montant: 350000, moyen: "Wave", reference: "WAVE-20251105-006", soldeRestant: 0, statut: "paye" },
  { id: "pa10", date: "2025-11-10", etudiant: "Oumar KANE", etudiantId: "et9", classe: "L1-INFO-A", rubrique: "Inscription + Scolarité S1", montant: 500000, moyen: "Virement", reference: "VIR-20251110-002", soldeRestant: 0, statut: "paye" },
  { id: "pa11", date: "2025-11-15", etudiant: "Adja SARR", etudiantId: "et10", classe: "L1-GEST-A", rubrique: "Scolarité S1", montant: 300000, moyen: "Wave", reference: "WAVE-20251115-007", soldeRestant: 0, statut: "paye" },
  { id: "pa12", date: "2025-11-20", etudiant: "Seydou MBAYE", etudiantId: "et11", classe: "L2-INFO-A", rubrique: "Scolarité S1", montant: 300000, moyen: "OrangeMoney", reference: "OM-20251120-008", soldeRestant: 75000, statut: "partiel" },
  { id: "pa13", date: "2025-12-01", etudiant: "Khadija FALL", etudiantId: "et12", classe: "L1-DROIT-A", rubrique: "Scolarité S1", montant: 220000, moyen: "Wave", reference: "WAVE-20251201-009", soldeRestant: 100000, statut: "partiel" },
  { id: "pa14", date: "2025-12-05", etudiant: "Lamine GUEYE", etudiantId: "et13", classe: "L1-INFO-B", rubrique: "Inscription", montant: 150000, moyen: "Especes", reference: "ESP-003", soldeRestant: 0, statut: "paye" },
  { id: "pa15", date: "2025-12-10", etudiant: "Pape SECK", etudiantId: "et15", classe: "L3-INFO-A", rubrique: "Scolarité S1", montant: 375000, moyen: "Virement", reference: "VIR-20251210-003", soldeRestant: 0, statut: "paye" },
];

export const VACATIONS = [
  { id: "va1", mois: "Octobre 2025", enseignant: "Pr. Cheikh FALL", enseignantId: "en1", modules: ["Algorithmique I", "Architecture des Ord."], heuresCm: 30, heuresTd: 20, tauxHoraire: 15000, montantTotal: 750000, statut: "paye", moyen: "Virement" },
  { id: "va2", mois: "Octobre 2025", enseignant: "M. Ibrahima DIOP", enseignantId: "en5", modules: ["Systèmes d'Exploitation"], heuresCm: 15, heuresTd: 10, tauxHoraire: 8000, montantTotal: 200000, statut: "valide", moyen: "Wave" },
  { id: "va3", mois: "Octobre 2025", enseignant: "Me. Rokhaya BA", enseignantId: "en6", modules: ["Introduction au Droit", "Droit des Contrats"], heuresCm: 20, heuresTd: 12, tauxHoraire: 10000, montantTotal: 320000, statut: "brouillon", moyen: "" },
  { id: "va4", mois: "Novembre 2025", enseignant: "Pr. Cheikh FALL", enseignantId: "en1", modules: ["Algorithmique I", "Architecture des Ord."], heuresCm: 32, heuresTd: 22, tauxHoraire: 15000, montantTotal: 810000, statut: "paye", moyen: "Virement" },
  { id: "va5", mois: "Novembre 2025", enseignant: "Dr. Moussa SY", enseignantId: "en3", modules: ["Programmation C"], heuresCm: 25, heuresTd: 20, tauxHoraire: 12000, montantTotal: 540000, statut: "valide", moyen: "OrangeMoney" },
];

export const NOTIFICATIONS = [
  { id: "nt1", type: "danger", message: "3 étudiants avec des impayés de plus de 30 jours", temps: "il y a 2h", lue: false },
  { id: "nt2", type: "warning", message: "5 notes en attente de validation - Semestre 1", temps: "il y a 4h", lue: false },
  { id: "nt3", type: "info", message: "2 nouveaux étudiants non affectés à une classe", temps: "il y a 6h", lue: false },
  { id: "nt4", type: "success", message: "4 paiements Wave/OM réconciliés avec succès", temps: "il y a 1j", lue: true },
  { id: "nt5", type: "info", message: "Rapport mensuel d'octobre disponible", temps: "il y a 2j", lue: true },
];

export const ABSENCES = [
  { id: "ab1", etudiantId: "et1", date: "2025-10-07", heure: "08:00–10:00", ec: "Algorithmique I", type: "CM", justifie: false, motif: "" },
  { id: "ab2", etudiantId: "et1", date: "2025-10-21", heure: "14:00–16:00", ec: "Algorithmique I", type: "TD", justifie: true, motif: "Certificat médical" },
  { id: "ab3", etudiantId: "et1", date: "2025-11-04", heure: "10:30–12:30", ec: "Programmation C", type: "TP", justifie: false, motif: "" },
  { id: "ab4", etudiantId: "et2", date: "2025-10-14", heure: "08:00–10:00", ec: "Algorithmique I", type: "CM", justifie: true, motif: "Rendez-vous médical" },
  { id: "ab5", etudiantId: "et2", date: "2025-11-18", heure: "14:00–16:00", ec: "Architecture des Ordinateurs", type: "TD", justifie: false, motif: "" },
  { id: "ab6", etudiantId: "et3", date: "2025-09-30", heure: "10:30–12:30", ec: "Programmation C", type: "TP", justifie: false, motif: "" },
  { id: "ab7", etudiantId: "et3", date: "2025-11-11", heure: "08:00–10:00", ec: "Systèmes d'Exploitation", type: "CM", justifie: true, motif: "Deuil familial" },
  { id: "ab8", etudiantId: "et4", date: "2025-10-28", heure: "10:30–12:30", ec: "Microéconomie", type: "CM", justifie: false, motif: "" },
  { id: "ab9", etudiantId: "et7", date: "2025-12-02", heure: "08:00–10:00", ec: "SQL avancé", type: "TP", justifie: true, motif: "Certificat médical" },
  { id: "ab10", etudiantId: "et9", date: "2025-11-25", heure: "14:00–16:00", ec: "Algorithmique I", type: "TD", justifie: false, motif: "" },
];

export const ATTESTATIONS = ETUDIANTS.slice(0, 8).map((e, i) => ({
  id: `att-${i + 1}`,
  etudiantId: e.id,
  etudiant: `${e.prenom} ${e.nom}`,
  matricule: e.matricule,
  classe: e.classe,
  filiere: e.filiere,
  type: i % 2 === 0 ? "Certificat de scolarité" : "Attestation d'inscription",
  annee: e.annee,
  statut: i < 4 ? "genere" : i < 6 ? "envoye" : "en_attente",
  dateGeneration: i < 6 ? "2026-01-15" : "",
}));
