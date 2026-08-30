import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { UserAvatar } from "@/components/admin/UserAvatar";
import { useDevisList } from "@/hooks/useDevisStore";
import { marquerDevisConverti } from "@/data/devisStore";
import { useStudentStore } from "@/hooks/useStudentStore";
import { registerNewEtudiant, emettreQuittanceBrute, allocateMatricule, type EtudiantRecord } from "@/data/studentStore";
import { FILIERES } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { formatCFA, cn } from "@/lib/utils";

const inputClass =
  "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";

function splitNomPrenom(beneficiaire: string): { prenom: string; nom: string } {
  const parts = beneficiaire.trim().split(/\s+/);
  if (parts.length < 2) return { prenom: beneficiaire.trim(), nom: "" };
  return { prenom: parts.slice(0, -1).join(" "), nom: parts[parts.length - 1] };
}

export default function DevisConvertirPage({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const devisList = useDevisList();
  const etudiants = useStudentStore();

  const record = devisList.find((d) => d.id === id);

  const [mode, setMode] = useState<"recherche" | "nouveau">("recherche");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<EtudiantRecord | null>(null);

  const { prenom: prenomInit, nom: nomInit } = record ? splitNomPrenom(record.beneficiaire) : { prenom: "", nom: "" };
  const [prenom, setPrenom] = useState(prenomInit);
  const [nom, setNom] = useState(nomInit);
  const [sexe, setSexe] = useState<"M" | "F">("F");
  const [dateNaissance, setDateNaissance] = useState("");
  const [telephone, setTelephone] = useState(record?.telephone ?? "");
  const [email, setEmail] = useState(record?.email ?? "");

  const [checked, setChecked] = useState<Set<number>>(new Set(record ? record.lignes.map((_, i) => i) : []));

  if (!record) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les devis", href: "/admin/devis" }]}
          title="Devis introuvable"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          Ce devis n&apos;existe pas ou a été supprimé.
        </div>
      </div>
    );
  }

  if (record.annule || record.convertiEtudiantId) {
    return (
      <div>
        <PageHeader
          breadcrumb={[{ label: "Admin" }, { label: "Finances" }, { label: "Les devis", href: "/admin/devis" }, { label: record.reference }]}
          title="Conversion impossible"
        />
        <div className="bg-card border border-dashed border-border rounded-xl py-16 text-center text-sm text-muted-foreground">
          {record.convertiEtudiantId ? "Ce devis a déjà été converti en inscription." : "Ce devis a été annulé — il ne peut pas être converti."}
        </div>
      </div>
    );
  }

  const filteredStudents = searchQuery.length > 1
    ? etudiants.filter((e) =>
        `${e.prenom} ${e.nom}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.matricule.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const selectedLignes = record.lignes.filter((_, i) => checked.has(i));
  const totalSelectionne = selectedLignes.reduce((s, l) => s + l.montantTTC, 0);

  const toggleLigne = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const canSubmit =
    selectedLignes.length > 0 &&
    (mode === "recherche"
      ? !!selectedStudent
      : prenom.trim().length > 0 && nom.trim().length > 0 && dateNaissance.trim().length > 0);

  const handleConvertir = () => {
    if (!canSubmit) return;
    const lignes = selectedLignes.map((l) => ({ label: l.intitule, montant: l.montantTTC }));

    try {
      let etudiant: EtudiantRecord;
      if (mode === "recherche" && selectedStudent) {
        etudiant = selectedStudent;
      } else {
        const filiere = FILIERES.find((f) => f.id === record.filiereId);
        const matricule = allocateMatricule(filiere?.code ?? "XXX");
        etudiant = registerNewEtudiant(
          {
            prenom: prenom.trim(),
            nom: nom.trim(),
            sexe,
            dateNaissance,
            email: email.trim(),
            telephone: telephone.trim() || undefined,
            filiereId: record.filiereId,
            classeId: "",
            niveau: record.niveau,
            statut: "preinscrit",
            annee: record.annee,
            soldeDu: 0,
            inscriptionUniquePayee: false,
          },
          matricule,
        );
      }

      emettreQuittanceBrute({
        etudiantId: etudiant.id,
        date: new Date().toISOString().slice(0, 10),
        lignes,
        reference: `Devis ${record.reference}`,
      });

      marquerDevisConverti(record.id, etudiant.id);
      toast.success(`Devis converti — facture de ${formatCFA(totalSelectionne)} émise pour ${etudiant.prenom} ${etudiant.nom}`);
      setLocation(`/admin/students/${etudiant.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Conversion impossible");
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Admin" },
          { label: "Finances" },
          { label: "Les devis", href: "/admin/devis" },
          { label: record.reference, href: `/admin/devis/${record.id}` },
          { label: "Convertir" },
        ]}
        title={`Convertir le devis ${record.reference} en inscription`}
        subtitle="Crée une facture (quittance impayée) reprenant les lignes cochées, pour un étudiant nouveau ou existant"
        actions={
          <button onClick={() => setLocation(`/admin/devis/${record.id}`)} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Annuler
          </button>
        }
      />

      <div className="bg-card border border-border rounded-xl p-4 mb-5 text-sm text-muted-foreground" style={{ boxShadow: "var(--shadow-sm)" }}>
        Filière : <strong className="text-foreground">{record.filiereLabel}</strong> — Niveau : <strong className="text-foreground">{record.niveauLabel}</strong> — Année : <strong className="text-foreground">{record.annee}</strong>
      </div>

      <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 space-y-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Étudiant</label>
          <div className="flex gap-1 bg-muted rounded-xl p-1 mb-3 w-fit">
            <button
              type="button"
              onClick={() => setMode("recherche")}
              className={cn("px-4 py-2 text-xs font-medium rounded-lg transition-colors", mode === "recherche" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}
            >
              Étudiant existant
            </button>
            <button
              type="button"
              onClick={() => setMode("nouveau")}
              className={cn("px-4 py-2 text-xs font-medium rounded-lg transition-colors", mode === "nouveau" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}
              data-testid="devis-convertir-mode-nouveau"
            >
              <UserPlus size={13} className="inline mr-1.5" /> Nouvel étudiant
            </button>
          </div>

          {mode === "recherche" ? (
            selectedStudent ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border border-primary bg-primary/5">
                <UserAvatar name={`${selectedStudent.prenom} ${selectedStudent.nom}`} size="sm" />
                <div className="flex-1">
                  <div className="font-medium text-foreground text-sm">{selectedStudent.prenom} {selectedStudent.nom}</div>
                  <div className="text-xs text-muted-foreground font-mono">{selectedStudent.matricule}</div>
                </div>
                <button onClick={() => { setSelectedStudent(null); setSearchQuery(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Changer
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="Nom, prénom ou matricule..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="devis-convertir-search"
                  />
                </div>
                {filteredStudents.map((stu) => (
                  <div
                    key={stu.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted cursor-pointer mt-2"
                    onClick={() => setSelectedStudent(stu)}
                    data-testid={`devis-convertir-option-${stu.id}`}
                  >
                    <UserAvatar name={`${stu.prenom} ${stu.nom}`} size="sm" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground text-sm">{stu.prenom} {stu.nom}</div>
                      <div className="text-xs text-muted-foreground font-mono">{stu.matricule}</div>
                    </div>
                  </div>
                ))}
                {searchQuery.length > 1 && filteredStudents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun étudiant trouvé</p>
                )}
              </>
            )
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Prénom <span className="text-red-500">*</span></label>
                  <input value={prenom} onChange={(e) => setPrenom(e.target.value)} className={inputClass} data-testid="devis-convertir-prenom" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom <span className="text-red-500">*</span></label>
                  <input value={nom} onChange={(e) => setNom(e.target.value)} className={inputClass} data-testid="devis-convertir-nom" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sexe <span className="text-red-500">*</span></label>
                  <select value={sexe} onChange={(e) => setSexe(e.target.value as "M" | "F")} className={inputClass}>
                    <option value="F">Féminin</option>
                    <option value="M">Masculin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date de naissance <span className="text-red-500">*</span></label>
                  <input type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} className={inputClass} data-testid="devis-convertir-date-naissance" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone</label>
                  <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Lignes à facturer</label>
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {record.lignes.map((l, i) => (
              <label key={i} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40">
                <input type="checkbox" checked={checked.has(i)} onChange={() => toggleLigne(i)} className="rounded" data-testid={`devis-convertir-ligne-${i}`} />
                <span className="flex-1 text-sm">{l.intitule}</span>
                <span className="text-sm font-semibold">{formatCFA(l.montantTTC)}</span>
              </label>
            ))}
          </div>
          <p className="text-right text-sm mt-2">
            Total sélectionné : <span className="font-bold text-primary">{formatCFA(totalSelectionne)}</span>
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={() => setLocation(`/admin/devis/${record.id}`)} className="flex-1 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors">
            Annuler
          </button>
          <button
            onClick={handleConvertir}
            disabled={!canSubmit}
            className="flex items-center gap-2 flex-1 justify-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            data-testid="devis-convertir-submit"
          >
            <UserPlus size={15} /> Créer l&apos;inscription
          </button>
        </div>
      </div>
    </div>
  );
}
