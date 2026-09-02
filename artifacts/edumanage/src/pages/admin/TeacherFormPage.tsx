import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { ArrowLeft, Save, Plus, Trash2, RefreshCw, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin/PageHeader";
import { getTeacherById, addTeacher, updateTeacher } from "@/data/teacherStore";
import { useAuth } from "@/contexts/AuthContext";
import { NIVEAUX_ETUDE, generateMatriculeEnseignant } from "@/lib/inscriptionConstants";

const TAILLE_MAX_PHOTO_OCTETS = 400 * 1024;

interface FormData {
  prenom: string;
  nom: string;
  sexe: "M" | "F";
  dateNaissance: string;
  paysNaissance: string;
  lieuNaissance: string;
  nationalite: string;
  cni: string;
  email: string;
  telephone: string;
  adresse?: string;
  niveauEtude: string;
  grade: "Permanent" | "Vacataire" | "Contractuel";
}

interface Props { id?: string; }

export default function TeacherFormPage({ id }: Props) {
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const isEdit = !!id;
  const [matricule, setMatricule] = useState("");
  const [diplomes, setDiplomes] = useState<string[]>([""]);
  const [specialites, setSpecialites] = useState<string[]>([""]);
  const [photoDataUrl, setPhotoDataUrl] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      prenom: "", nom: "", sexe: "M", dateNaissance: "", paysNaissance: "Sénégal",
      lieuNaissance: "", nationalite: "Sénégalaise", cni: "", email: "", telephone: "",
      adresse: "", niveauEtude: "Master", grade: "Vacataire",
    },
  });

  const handlePhoto = (file: File | undefined) => {
    if (!file) return;
    if (file.size > TAILLE_MAX_PHOTO_OCTETS) {
      toast.error(`Photo trop lourde (max ${Math.round(TAILLE_MAX_PHOTO_OCTETS / 1024)} Ko).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (isEdit && id) {
      const teacher = getTeacherById(id);
      if (teacher) {
        reset({
          prenom: teacher.prenom.replace(/^(Pr\.|Dr\.|Me\.|M\.)\s*/, ""),
          nom: teacher.nom,
          sexe: teacher.sexe ?? "M",
          dateNaissance: teacher.dateNaissance ?? "",
          paysNaissance: teacher.paysNaissance ?? "Sénégal",
          lieuNaissance: teacher.lieuNaissance ?? "Dakar",
          nationalite: teacher.nationalite ?? "Sénégalaise",
          cni: teacher.cni ?? "",
          email: teacher.email ?? `${teacher.nom.toLowerCase()}@univ.sn`,
          telephone: teacher.telephone,
          adresse: teacher.adresse ?? "",
          niveauEtude: teacher.niveauEtude ?? "Master",
          grade: teacher.grade,
        });
        setMatricule(teacher.matricule);
        setSpecialites(teacher.specialites?.length ? teacher.specialites : [teacher.specialite]);
        setDiplomes(teacher.diplomes?.length ? teacher.diplomes : ["Master en " + teacher.specialite]);
        setPhotoDataUrl(teacher.photoDataUrl ?? "");
      }
    } else {
      setMatricule(generateMatriculeEnseignant());
    }
  }, [id, isEdit, reset]);

  const onSubmit = (data: FormData) => {
    if (!currentUser) return;
    const specialitesRemplies = specialites.filter(Boolean);
    const payload = {
      prenom: data.prenom.trim(),
      nom: data.nom.trim().toUpperCase(),
      matricule,
      telephone: data.telephone,
      specialite: specialitesRemplies[0] ?? "",
      specialites: specialitesRemplies,
      grade: data.grade,
      email: data.email,
      sexe: data.sexe,
      dateNaissance: data.dateNaissance,
      paysNaissance: data.paysNaissance,
      lieuNaissance: data.lieuNaissance,
      nationalite: data.nationalite,
      cni: data.cni,
      adresse: data.adresse,
      niveauEtude: data.niveauEtude,
      diplomes: diplomes.filter(Boolean),
      photoDataUrl: photoDataUrl || undefined,
    };
    if (isEdit && id) {
      // Taux horaire et RIB ne sont plus saisis ici — gérés depuis la fiche enseignant
      // (Taux) ; on ne les touche donc pas pour ne pas écraser une valeur déjà réglée.
      updateTeacher(id, payload, currentUser.id);
    } else {
      addTeacher({ ...payload, tauxHoraire: 0 }, currentUser.id);
    }
    setLocation("/admin/teachers");
  };

  const inputClass = "w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

  const addListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((prev) => [...prev, ""]);
  };

  const updateListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    setter((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const removeListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "Admin" }, { label: "Utilisateurs" }, { label: "Enseignants", href: "/admin/teachers" }, { label: isEdit ? "Modifier" : "Ajouter" }]}
        title={isEdit ? "Modifier l'enseignant" : "Ajouter un enseignant"}
        subtitle="Informations personnelles, académiques et professionnelles"
        actions={
          <button onClick={() => setLocation("/admin/teachers")} className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm hover:bg-muted transition-colors">
            <ArrowLeft size={15} /> Retour
          </button>
        }
      />
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Identité</p>
            <div className="flex items-center gap-4 mb-4">
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="Photo" className="w-16 h-16 rounded-full object-cover border border-border flex-shrink-0" data-testid="teacher-photo-apercu" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User size={22} className="text-muted-foreground" />
                </div>
              )}
              <label className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors cursor-pointer">
                <Upload size={14} /> Photo de profil
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} data-testid="teacher-photo-input" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Prénom *</label>
                <input {...register("prenom", { required: "Prénom requis" })} placeholder="Cheikh" className={inputClass} />
                {errors.prenom && <p className="text-xs text-red-500 mt-1">{errors.prenom.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nom *</label>
                <input {...register("nom", { required: "Nom requis" })} placeholder="FALL" className={`${inputClass} uppercase`} />
                {errors.nom && <p className="text-xs text-red-500 mt-1">{errors.nom.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sexe *</label>
                <div className="flex gap-3 pt-2">
                  {(["M", "F"] as const).map((s) => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="radio" {...register("sexe")} value={s} className="w-4 h-4" />
                      {s === "M" ? "Masculin" : "Féminin"}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Matricule (auto)</label>
                <div className="flex gap-2">
                  <input type="text" readOnly value={matricule} className={`${inputClass} bg-muted/50 font-mono cursor-not-allowed flex-1`} style={{ fontFamily: "JetBrains Mono, monospace" }} />
                  {!isEdit && (
                    <button type="button" onClick={() => setMatricule(generateMatriculeEnseignant())} className="p-2.5 border border-border rounded-xl hover:bg-muted" title="Régénérer">
                      <RefreshCw size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date de naissance *</label>
                <input {...register("dateNaissance", { required: "Date requise" })} type="date" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Pays de naissance *</label>
                <select {...register("paysNaissance", { required: true })} className={inputClass}>
                  {["Sénégal", "Mali", "Côte d'Ivoire", "Guinée", "Mauritanie", "France", "Autre"].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Lieu de naissance *</label>
                <input {...register("lieuNaissance", { required: "Lieu requis" })} placeholder="Dakar" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nationalité *</label>
                <input {...register("nationalite", { required: "Nationalité requise" })} placeholder="Sénégalaise" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">N° CNI / Passeport</label>
                <input {...register("cni")} placeholder="1234567890123" className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Adresse</label>
                <input {...register("adresse")} placeholder="Quartier, ville" className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Contact</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email professionnel *</label>
                <input {...register("email", { required: "Email requis", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email invalide" } })} type="email" className={inputClass} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Téléphone *</label>
                <input {...register("telephone", { required: "Téléphone requis" })} placeholder="77 123 45 67" className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Profil académique</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Niveau d'étude *</label>
                <select {...register("niveauEtude", { required: true })} className={inputClass}>
                  {NIVEAUX_ETUDE.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Statut *</label>
                <select {...register("grade")} className={inputClass}>
                  <option value="Permanent">Permanent</option>
                  <option value="Vacataire">Vacataire</option>
                  <option value="Contractuel">Contractuel</option>
                </select>
              </div>
            </div>
            {!isEdit && (
              <p className="text-xs text-muted-foreground mt-3">
                Le taux horaire se règle depuis la fiche de l'enseignant une fois créé (onglet Taux).
              </p>
            )}

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Dernier diplôme / Certifications</label>
                <button type="button" onClick={() => addListItem(setDiplomes)} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  <Plus size={12} /> Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {diplomes.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={d} onChange={(e) => updateListItem(setDiplomes, i, e.target.value)} placeholder="ex: Master en Informatique" className={inputClass} />
                    {diplomes.length > 1 && (
                      <button type="button" onClick={() => removeListItem(setDiplomes, i)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Spécialité(s) *</label>
                <button type="button" onClick={() => addListItem(setSpecialites)} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  <Plus size={12} /> Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {specialites.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={s}
                      onChange={(e) => updateListItem(setSpecialites, i, e.target.value)}
                      placeholder="ex: Algorithmique & Intelligence Artificielle"
                      className={inputClass}
                      required={i === 0}
                    />
                    {specialites.length > 1 && (
                      <button type="button" onClick={() => removeListItem(setSpecialites, i)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors">
              <Save size={14} /> {isEdit ? "Enregistrer les modifications" : "Ajouter l'enseignant"}
            </button>
            <button type="button" onClick={() => setLocation("/admin/teachers")} className="px-6 py-2.5 border border-border rounded-xl text-sm hover:bg-muted transition-colors">Annuler</button>
          </div>
        </form>
      </div>
    </div>
  );
}
