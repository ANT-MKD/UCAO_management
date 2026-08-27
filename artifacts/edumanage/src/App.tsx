import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { StudentLayout } from "@/components/layout/StudentLayout";

const queryClient = new QueryClient();

// Lazy load pages
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));

// Admin pages
const DashboardPage = lazy(() => import("@/pages/admin/DashboardPage"));

// Académiques - listes
const FilieresPage = lazy(() => import("@/pages/admin/FilieresPage"));
const NiveauxPage = lazy(() => import("@/pages/admin/NiveauxPage"));
const SemestresPage = lazy(() => import("@/pages/admin/SemestresPage"));
const ClassesPage = lazy(() => import("@/pages/admin/ClassesPage"));
const SallesPage = lazy(() => import("@/pages/admin/SallesPage"));
const UEsPage = lazy(() => import("@/pages/admin/UEsPage"));
const ECsPage = lazy(() => import("@/pages/admin/ECsPage"));

// Académiques - formulaires dédiés
const FilieresFormPage = lazy(() => import("@/pages/admin/FilieresFormPage"));
const NiveauFormPage = lazy(() => import("@/pages/admin/NiveauFormPage"));
const SemestreFormPage = lazy(() => import("@/pages/admin/SemestreFormPage"));
const ClasseFormPage = lazy(() => import("@/pages/admin/ClasseFormPage"));
const SalleFormPage = lazy(() => import("@/pages/admin/SalleFormPage"));
const UEFormPage = lazy(() => import("@/pages/admin/UEFormPage"));
const ECFormPage = lazy(() => import("@/pages/admin/ECFormPage"));

// Planning
const SchedulePage = lazy(() => import("@/pages/admin/SchedulePage"));
const ScheduleFormPage = lazy(() => import("@/pages/admin/ScheduleFormPage"));
const AnneesAcademiquesPage = lazy(() => import("@/pages/admin/AnneesAcademiquesPage"));

// Reporting & finances
const AddTransactionPage = lazy(() => import("@/pages/admin/AddTransactionPage"));
const AttestationsPage = lazy(() => import("@/pages/admin/AttestationsPage"));
const UsersPage = lazy(() => import("@/pages/admin/UsersPage"));

// Étudiants
const StudentsPage = lazy(() => import("@/pages/admin/StudentsPage"));
const StudentDossierPage = lazy(() => import("@/pages/admin/StudentDossierPage"));
const AddStudentPage = lazy(() => import("@/pages/admin/AddStudentPage"));
const ReinscriptionPage = lazy(() => import("@/pages/admin/ReinscriptionPage"));
const StudentsAccessPage = lazy(() => import("@/pages/admin/StudentsAccessPage"));
const StudentCardPage = lazy(() => import("@/pages/admin/StudentCardPage"));

// Enseignants
const TeachersPage = lazy(() => import("@/pages/admin/TeachersPage"));
const TeacherCoursesPage = lazy(() => import("@/pages/admin/TeacherCoursesPage"));
const TeacherPlanningPage = lazy(() => import("@/pages/admin/TeacherPlanningPage"));
const TeacherPlanningFormPage = lazy(() => import("@/pages/admin/TeacherPlanningFormPage"));
const TeacherRatePage = lazy(() => import("@/pages/admin/TeacherRatePage"));
const TeacherVolumePage = lazy(() => import("@/pages/admin/TeacherVolumePage"));
const TeacherCourseStatusPage = lazy(() => import("@/pages/admin/TeacherCourseStatusPage"));
const TeacherPointageFormPage = lazy(() => import("@/pages/admin/TeacherPointageFormPage"));
const TeacherPointageTraitementPage = lazy(() => import("@/pages/admin/TeacherPointageTraitementPage"));
const TeacherRallongeFormPage = lazy(() => import("@/pages/admin/TeacherRallongeFormPage"));
const TeacherRallongeTraitementPage = lazy(() => import("@/pages/admin/TeacherRallongeTraitementPage"));
const TeacherAbsenceFormPage = lazy(() => import("@/pages/admin/TeacherAbsenceFormPage"));
const TeacherAbsencePage = lazy(() => import("@/pages/admin/TeacherAbsencePage"));
const TeacherContractFormPage = lazy(() => import("@/pages/admin/TeacherContractFormPage"));
const TeacherContractsPage = lazy(() => import("@/pages/admin/TeacherContractsPage"));
const TeacherContractDetailPage = lazy(() => import("@/pages/admin/TeacherContractDetailPage"));
const TeacherContractAvenantPage = lazy(() => import("@/pages/admin/TeacherContractAvenantPage"));
const TeacherDossierPage = lazy(() => import("@/pages/admin/TeacherDossierPage"));
const TeacherFormPage = lazy(() => import("@/pages/admin/TeacherFormPage"));

// Évaluations
const NotesPage = lazy(() => import("@/pages/admin/NotesPage"));
const MoyennesPage = lazy(() => import("@/pages/admin/MoyennesPage"));
const DeliberationsPage = lazy(() => import("@/pages/admin/DeliberationsPage"));
const RelevesPage = lazy(() => import("@/pages/admin/RelevesPage"));

// Finances
const FraisPage = lazy(() => import("@/pages/admin/FraisPage"));
const FraisFormPage = lazy(() => import("@/pages/admin/FraisFormPage"));
const FinanceParametragePage = lazy(() => import("@/pages/admin/FinanceParametragePage"));
const PaiementsPage = lazy(() => import("@/pages/admin/PaiementsPage"));
const AddPaiementPage = lazy(() => import("@/pages/admin/AddPaiementPage"));
const PaiementDetailPage = lazy(() => import("@/pages/admin/PaiementDetailPage"));
const EmissionMassePage = lazy(() => import("@/pages/admin/EmissionMassePage"));
const OrganismesPECPage = lazy(() => import("@/pages/admin/OrganismesPECPage"));
const OrganismePECDetailPage = lazy(() => import("@/pages/admin/OrganismePECDetailPage"));
const EmissionMasseFormPage = lazy(() => import("@/pages/admin/EmissionMasseFormPage"));
const EmissionMasseDetailPage = lazy(() => import("@/pages/admin/EmissionMasseDetailPage"));
const VacationsPage = lazy(() => import("@/pages/admin/VacationsPage"));
const VacationFormPage = lazy(() => import("@/pages/admin/VacationFormPage"));
const TransactionsPage = lazy(() => import("@/pages/admin/TransactionsPage"));

// Paramètres
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage"));
const AuditTrailPage = lazy(() => import("@/pages/admin/AuditTrailPage"));
const AdminComingSoonPage = lazy(() => import("@/pages/admin/AdminComingSoonPage"));
const MessagesPage = lazy(() => import("@/pages/admin/MessagesPage"));
const RequestsPage = lazy(() => import("@/pages/admin/RequestsPage"));
const StudentDashboardPage = lazy(() => import("@/pages/student/StudentDashboardPage"));
const StudentMessagesPage = lazy(() => import("@/pages/student/StudentMessagesPage"));
const StudentRequestsPage = lazy(() => import("@/pages/student/StudentRequestsPage"));
const CahiersAdminPage = lazy(() => import("@/pages/admin/CahiersAdminPage"));
const TeacherLayoutMod = lazy(() => import("@/pages/teacher/TeacherLayout").then((m) => ({ default: m.TeacherLayout })));
const TeacherDashboardPage = lazy(() => import("@/pages/teacher/TeacherPortalPages").then((m) => ({ default: m.TeacherDashboardPage })));
const TeacherSchedulePage = lazy(() => import("@/pages/teacher/TeacherPortalPages").then((m) => ({ default: m.TeacherSchedulePage })));
const TeacherModulesPage = lazy(() => import("@/pages/teacher/TeacherPortalPages").then((m) => ({ default: m.TeacherModulesPage })));
const TeacherGradesPage = lazy(() => import("@/pages/teacher/TeacherPortalPages").then((m) => ({ default: m.TeacherGradesPage })));
const TeacherRallongePage = lazy(() => import("@/pages/teacher/TeacherPortalPages").then((m) => ({ default: m.TeacherRallongePage })));
const TeacherContractPortalPage = lazy(() => import("@/pages/teacher/TeacherPortalPages").then((m) => ({ default: m.TeacherContractPage })));
const TeacherCahierPage = lazy(() => import("@/pages/teacher/TeacherCahierPage"));
const StudentSchedulePage = lazy(() => import("@/pages/student/StudentPortalPages").then((m) => ({ default: m.StudentSchedulePage })));
const StudentGradesPage = lazy(() => import("@/pages/student/StudentPortalPages").then((m) => ({ default: m.StudentGradesPage })));
const StudentPaymentsPage = lazy(() => import("@/pages/student/StudentPortalPages").then((m) => ({ default: m.StudentPaymentsPage })));
const StudentProfilePage = lazy(() => import("@/pages/student/StudentPortalPages").then((m) => ({ default: m.StudentProfilePage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function Admin({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </AdminLayout>
  );
}

function Student({ children }: { children: React.ReactNode }) {
  return (
    <StudentLayout>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </StudentLayout>
  );
}

function Teacher({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
      <TeacherLayoutMod>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </TeacherLayoutMod>
    </Suspense>
  );
}

function AppRouter() {
  return (
    <Switch>
      {/* ===== ADMIN — specific routes (3+ segments) MUST come before base routes ===== */}

      {/* Filières */}
      <Route path="/admin/filieres/new">
        <Admin><FilieresFormPage /></Admin>
      </Route>
      <Route path="/admin/filieres/:id/edit">
        {(p) => <Admin><FilieresFormPage id={p.id} /></Admin>}
      </Route>

      {/* Niveaux */}
      <Route path="/admin/niveaux/new">
        <Admin><NiveauFormPage /></Admin>
      </Route>
      <Route path="/admin/niveaux/:id/edit">
        {(p) => <Admin><NiveauFormPage id={p.id} /></Admin>}
      </Route>

      {/* Semestres */}
      <Route path="/admin/semestres/new">
        <Admin><SemestreFormPage /></Admin>
      </Route>
      <Route path="/admin/semestres/:id/edit">
        {(p) => <Admin><SemestreFormPage id={p.id} /></Admin>}
      </Route>

      {/* Classes */}
      <Route path="/admin/classes/new">
        <Admin><ClasseFormPage /></Admin>
      </Route>
      <Route path="/admin/classes/:id/edit">
        {(p) => <Admin><ClasseFormPage id={p.id} /></Admin>}
      </Route>

      {/* Salles */}
      <Route path="/admin/salles/new">
        <Admin><SalleFormPage /></Admin>
      </Route>
      <Route path="/admin/salles/:id/edit">
        {(p) => <Admin><SalleFormPage id={p.id} /></Admin>}
      </Route>

      {/* UEs */}
      <Route path="/admin/ues/new">
        <Admin><UEFormPage /></Admin>
      </Route>
      <Route path="/admin/ues/:id/edit">
        {(p) => <Admin><UEFormPage id={p.id} /></Admin>}
      </Route>

      {/* ECs */}
      <Route path="/admin/ecs/new">
        <Admin><ECFormPage /></Admin>
      </Route>
      <Route path="/admin/ecs/:id/edit">
        {(p) => <Admin><ECFormPage id={p.id} /></Admin>}
      </Route>

      {/* Planning */}
      <Route path="/admin/schedule/new">
        <Admin><ScheduleFormPage /></Admin>
      </Route>

      {/* Finances — transactions */}
      <Route path="/admin/transactions/new">
        <Admin><AddTransactionPage /></Admin>
      </Route>

      {/* Étudiants */}
      <Route path="/admin/students/new">
        <Admin><AddStudentPage /></Admin>
      </Route>
      <Route path="/admin/students/reinscription">
        <Admin><ReinscriptionPage /></Admin>
      </Route>
      <Route path="/admin/students/access">
        <Admin><StudentsAccessPage /></Admin>
      </Route>
      <Route path="/admin/students/card">
        <Admin><StudentCardPage /></Admin>
      </Route>
      <Route path="/admin/students/:id">
        {(p) => <Admin><StudentDossierPage id={p.id} /></Admin>}
      </Route>

      {/* Enseignants */}
      <Route path="/admin/teachers/new">
        <Admin><TeacherFormPage /></Admin>
      </Route>
      <Route path="/admin/teachers/courses">
        <Admin><TeacherCoursesPage /></Admin>
      </Route>
      <Route path="/admin/teachers/planning/new">
        <Admin><TeacherPlanningFormPage /></Admin>
      </Route>
      <Route path="/admin/teachers/planning">
        <Admin><TeacherPlanningPage /></Admin>
      </Route>
      <Route path="/admin/teachers/rates">
        <Admin><TeacherRatePage /></Admin>
      </Route>
      <Route path="/admin/teachers/volumes">
        <Admin><TeacherVolumePage /></Admin>
      </Route>
      <Route path="/admin/teachers/course-status">
        <Admin><TeacherCourseStatusPage /></Admin>
      </Route>
      <Route path="/admin/teachers/pointage/new">
        <Admin><TeacherPointageFormPage /></Admin>
      </Route>
      <Route path="/admin/teachers/pointage">
        <Admin><TeacherPointageTraitementPage /></Admin>
      </Route>
      <Route path="/admin/teachers/rallonge/new">
        <Admin><TeacherRallongeFormPage /></Admin>
      </Route>
      <Route path="/admin/teachers/rallonge">
        <Admin><TeacherRallongeTraitementPage /></Admin>
      </Route>
      <Route path="/admin/teachers/absence/new">
        <Admin><TeacherAbsenceFormPage /></Admin>
      </Route>
      <Route path="/admin/teachers/absence">
        <Admin><TeacherAbsencePage /></Admin>
      </Route>
      <Route path="/admin/teachers/contracts/new">
        <Admin><TeacherContractFormPage /></Admin>
      </Route>
      <Route path="/admin/teachers/contracts/:id/avenant">
        {(p) => <Admin><TeacherContractAvenantPage id={p.id} /></Admin>}
      </Route>
      <Route path="/admin/teachers/contracts/:id">
        {(p) => <Admin><TeacherContractDetailPage id={p.id} /></Admin>}
      </Route>
      <Route path="/admin/teachers/contracts">
        <Admin><TeacherContractsPage /></Admin>
      </Route>
      <Route path="/admin/teachers/:id/edit">
        {(p) => <Admin><TeacherFormPage id={p.id} /></Admin>}
      </Route>
      <Route path="/admin/teachers/:id">
        {(p) => <Admin><TeacherDossierPage id={p.id} /></Admin>}
      </Route>

      {/* Finances */}
      <Route path="/admin/finance-parametrage/:section">
        {(p) => <Admin><FinanceParametragePage section={p.section} /></Admin>}
      </Route>
      <Route path="/admin/finance-parametrage">
        <Redirect to="/admin/finance-parametrage/type-frais" />
      </Route>
      <Route path="/admin/frais/new">
        <Admin><FraisFormPage /></Admin>
      </Route>
      <Route path="/admin/frais/:id/edit">
        {(p) => <Admin><FraisFormPage id={p.id} /></Admin>}
      </Route>
      <Route path="/admin/paiements/new">
        <Admin><AddPaiementPage /></Admin>
      </Route>
      <Route path="/admin/paiements/:id">
        {(p) => <Admin><PaiementDetailPage id={p.id} /></Admin>}
      </Route>
      <Route path="/admin/emissions-masse/new">
        <Admin><EmissionMasseFormPage /></Admin>
      </Route>
      <Route path="/admin/emissions-masse/:id">
        {(p) => <Admin><EmissionMasseDetailPage id={p.id} /></Admin>}
      </Route>
      <Route path="/admin/organismes-pec/:id">
        {(p) => <Admin><OrganismePECDetailPage id={p.id} /></Admin>}
      </Route>
      <Route path="/admin/vacations/new">
        <Admin><VacationFormPage /></Admin>
      </Route>
      <Route path="/admin/vacations/:id/edit">
        {(p) => <Admin><VacationFormPage id={p.id} /></Admin>}
      </Route>

      {/* ===== ADMIN — base routes (2 segments) ===== */}
      <Route path="/admin/dashboard">
        <Admin><DashboardPage /></Admin>
      </Route>
      <Route path="/admin/filieres">
        <Admin><FilieresPage /></Admin>
      </Route>
      <Route path="/admin/niveaux">
        <Admin><NiveauxPage /></Admin>
      </Route>
      <Route path="/admin/semestres">
        <Admin><SemestresPage /></Admin>
      </Route>
      <Route path="/admin/classes">
        <Admin><ClassesPage /></Admin>
      </Route>
      <Route path="/admin/salles">
        <Admin><SallesPage /></Admin>
      </Route>
      <Route path="/admin/ues">
        <Admin><UEsPage /></Admin>
      </Route>
      <Route path="/admin/ecs">
        <Admin><ECsPage /></Admin>
      </Route>
      <Route path="/admin/schedule">
        <Admin><SchedulePage /></Admin>
      </Route>
      <Route path="/admin/annees">
        <Admin><AnneesAcademiquesPage /></Admin>
      </Route>
      <Route path="/admin/cahiers">
        <Admin><CahiersAdminPage /></Admin>
      </Route>
      <Route path="/admin/statistics">
        <Redirect to="/admin/dashboard#reporting" />
      </Route>
      <Route path="/admin/attestations">
        <Admin><AttestationsPage /></Admin>
      </Route>
      <Route path="/admin/users">
        <Admin><UsersPage /></Admin>
      </Route>
      <Route path="/admin/students">
        <Admin><StudentsPage /></Admin>
      </Route>
      <Route path="/admin/teachers">
        <Admin><TeachersPage /></Admin>
      </Route>
      <Route path="/admin/notes">
        <Admin><NotesPage /></Admin>
      </Route>
      <Route path="/admin/moyennes">
        <Admin><MoyennesPage /></Admin>
      </Route>
      <Route path="/admin/deliberations">
        <Admin><DeliberationsPage /></Admin>
      </Route>
      <Route path="/admin/releves">
        <Admin><RelevesPage /></Admin>
      </Route>
      <Route path="/admin/frais">
        <Admin><FraisPage /></Admin>
      </Route>
      <Route path="/admin/paiements">
        <Admin><PaiementsPage /></Admin>
      </Route>
      <Route path="/admin/emissions-masse">
        <Admin><EmissionMassePage /></Admin>
      </Route>
      <Route path="/admin/organismes-pec">
        <Admin><OrganismesPECPage /></Admin>
      </Route>
      <Route path="/admin/vacations">
        <Admin><VacationsPage /></Admin>
      </Route>
      <Route path="/admin/transactions">
        <Admin><TransactionsPage /></Admin>
      </Route>
      <Route path="/admin/settings">
        <Admin><SettingsPage /></Admin>
      </Route>
      <Route path="/admin/audit">
        <Admin><AuditTrailPage /></Admin>
      </Route>
      <Route path="/admin/wip/:pageId">
        {(p) => <Admin><AdminComingSoonPage pageId={p.pageId} /></Admin>}
      </Route>
      <Route path="/admin/messages">
        <Admin><MessagesPage /></Admin>
      </Route>
      <Route path="/admin/requests">
        <Admin><RequestsPage /></Admin>
      </Route>

      {/* /admin root → redirect to dashboard */}
      <Route path="/admin">
        <Redirect to="/admin/dashboard" />
      </Route>

      {/* ===== NON-ADMIN ROUTES ===== */}
      <Route path="/login">
        <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>
      </Route>
      <Route path="/teacher/dashboard">
        <Teacher><TeacherDashboardPage /></Teacher>
      </Route>
      <Route path="/teacher/schedule">
        <Teacher><TeacherSchedulePage /></Teacher>
      </Route>
      <Route path="/teacher/modules">
        <Teacher><TeacherModulesPage /></Teacher>
      </Route>
      <Route path="/teacher/grades">
        <Teacher><TeacherGradesPage /></Teacher>
      </Route>
      <Route path="/teacher/cahier">
        <Teacher><TeacherCahierPage /></Teacher>
      </Route>
      <Route path="/teacher/rallonge">
        <Teacher><TeacherRallongePage /></Teacher>
      </Route>
      <Route path="/teacher/contract">
        <Teacher><TeacherContractPortalPage /></Teacher>
      </Route>
      <Route path="/teacher">
        <Redirect to="/teacher/dashboard" />
      </Route>
      <Route path="/student/dashboard">
        <Student><StudentDashboardPage /></Student>
      </Route>
      <Route path="/student/schedule">
        <Student><StudentSchedulePage /></Student>
      </Route>
      <Route path="/student/grades">
        <Student><StudentGradesPage /></Student>
      </Route>
      <Route path="/student/payments">
        <Student><StudentPaymentsPage /></Student>
      </Route>
      <Route path="/student/profile">
        <Student><StudentProfilePage /></Student>
      </Route>
      <Route path="/student/messages">
        <Student><StudentMessagesPage /></Student>
      </Route>
      <Route path="/student/requests">
        <Student><StudentRequestsPage /></Student>
      </Route>
      <Route path="/">
        <Suspense fallback={<PageLoader />}><LandingPage /></Suspense>
      </Route>

      {/* Catch-all */}
      <Route>
        <Redirect to="/admin/dashboard" />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRouter />
            </WouterRouter>
            <Toaster />
            <SonnerToaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
