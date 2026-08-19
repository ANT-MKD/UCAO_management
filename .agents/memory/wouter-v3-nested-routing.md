---
name: Wouter v3 nested routing
description: Routes with 3+ path segments go blank when nested inside an outer wildcard Route in wouter v3. Use a single flat Switch instead.
---

## The rule
Never nest a Switch inside a component matched by an outer `<Route path="/admin/:rest*">`. All routes must be declared in a single flat Switch at the top level.

**Why:** In wouter v3, when an outer Route with a wildcard pattern (`/admin/:rest*`) matches, it changes the path context for inner nested Routes. Routes with 2 path segments (e.g. `/admin/dashboard`) happened to work by coincidence, but routes with 3+ segments (e.g. `/admin/filieres/new`) produced a blank white page with no console errors — no Switch entry matched the modified path context.

**How to apply:** Use a single `<Switch>` in `AppRouter` containing ALL routes (admin + non-admin). Wrap admin pages with an `<Admin>` layout component inline:
```jsx
function Admin({ children }) {
  return <AdminLayout><Suspense fallback={<PageLoader />}>{children}</Suspense></AdminLayout>;
}

// In AppRouter Switch:
<Route path="/admin/filieres/new"><Admin><FilieresFormPage /></Admin></Route>
<Route path="/admin/filieres/:id/edit">{(p) => <Admin><FilieresFormPage id={p.id} /></Admin>}</Route>
```

Specific routes (3 segments) MUST appear before base routes (2 segments) in the Switch.
