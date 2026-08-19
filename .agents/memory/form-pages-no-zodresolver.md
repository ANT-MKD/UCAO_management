---
name: Form pages — no zodResolver
description: This project must never use zodResolver from @hookform/resolvers. Use react-hook-form native validation rules only.
---

## The rule
Never import `zodResolver` from `"@hookform/resolvers/zod"` in any form page in this project.

**Why:** The `@hookform/resolvers` package causes a runtime module error in Vite that makes the entire page go blank with no visible console error. The catalog has zod `^3.25.76` but the resolvers package has import issues in this build setup.

**How to apply:** Use TypeScript interfaces + react-hook-form native validation:
```tsx
interface FormData { nom: string; code: string; }

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  defaultValues: { nom: "", code: "" }
});

// Validation via register rules:
<input {...register("nom", { required: "Nom requis", minLength: { value: 3, message: "Min 3 chars" } })} />
```

No `resolver:` prop on `useForm`.
