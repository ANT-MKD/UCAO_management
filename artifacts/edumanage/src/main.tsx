import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import App from "./App";
import { modeReprise } from "@/lib/stockageLocal";
import "./index.css";

// Mode reprise (?reprise=poste) : seule la page de reprise s'ouvre ; l'application, qui chargerait
// la base dans les stores, ne démarre pas.
const RepriseApp = lazy(() => import("@/pages/reprise/RepriseApp"));

createRoot(document.getElementById("root")!).render(modeReprise ? <Suspense fallback={null}><RepriseApp /></Suspense> : <App />);
