# EduManage

Plateforme SaaS de gestion universitaire pour les universités privées de l'Afrique francophone (Sénégal). Frontend-only avec données mock, design system complet.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifact: `artifacts/edumanage`)
- Routing: wouter v3
- Forms: react-hook-form + zod (v3, import from `"zod"` not `"zod/v4"`)
- Charts: recharts
- State: @tanstack/react-query
- Styling: Tailwind CSS v4 + tw-animate-css
- API: Express 5 (artifact: `artifacts/api-server`)
- Build: Vite (frontend), esbuild (backend)

## Where things live

- `artifacts/edumanage/src/`
  - `App.tsx` — Root app with all routes (lazy-loaded)
  - `index.css` — CSS variables (light+dark), font imports, animations
  - `data/mockData.ts` — All mock data (students, teachers, payments, schedule, etc.)
  - `lib/utils.ts` — cn, formatCFA, formatDate, formatShortDate, getMention
  - `contexts/ThemeContext.tsx` — Dark mode (persisted to localStorage)
  - `contexts/AuthContext.tsx` — Mock auth (login/logout)
  - `components/layout/AdminLayout.tsx` — Sidebar nav with dropdown menus
  - `components/admin/` — KPICard, StatusBadge, PageHeader, UserAvatar, DataTable
  - `pages/LandingPage.tsx` — Landing page
  - `pages/LoginPage.tsx` — Login page
  - `pages/StubPage.tsx` — Placeholder for teacher/student portals
  - `pages/admin/` — All admin pages

## Architecture decisions

- **Frontend-only (no DB)**: All data comes from `mockData.ts`. Auth is mocked via localStorage.
- **Zod v3**: Use `import { z } from "zod"` NOT `"zod/v4"` — the catalog has zod `^3.25.76`.
- **Route auto-redirect**: `/admin` redirects to `/admin/dashboard`. Unknown routes redirect to `/`.
- **Dark mode**: Toggled via `document.documentElement.classList.add("dark")` in ThemeContext, key `"edumanage-theme"` in localStorage.
- **DataTable casting**: Typed arrays must be cast with `as unknown as Record<string, unknown>[]` to satisfy the DataTable generic.

## Product

EduManage is a complete university management SaaS covering:
- Academic structure (filieres, niveaux, semestres, classes, salles, UE, EC)
- Scheduling (weekly calendar grid with drag-and-drop feel)
- Student management (full dossier: notes, paiements, absences)
- Teacher management (dossier: modules, planning, vacations)
- Financial management (frais config, paiements, vacations, transactions)
- Evaluations (notes entry, moyennes/deliberations, releves PDF preview)
- Settings (universite, academique, notifications, securite, integrations)

## User preferences

- Design language: Outfit/Inter/JetBrains Mono, indigo primary (#4f46e5), emerald success (#10b981), amber warning, red danger
- Images from Unsplash
- French (fr-FR) throughout
- Francophone Africa context (FCFA currency, Wave/OrangeMoney payments, LMD system)
- Login credentials: admin@edumanage.com / prof@edumanage.com / etu@edumanage.com — password: `demo123`

## Gotchas

- Use `zod` not `zod/v4` (catalog has v3)
- DataTable requires `Record<string, unknown>[]` — cast typed arrays
- wouter base uses `import.meta.env.BASE_URL.replace(/\/$/, "")` to strip trailing slash
- Run `restart_workflow "artifacts/edumanage: web"` after major changes

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
