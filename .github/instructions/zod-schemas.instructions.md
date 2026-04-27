---
applyTo: "lib/schemas/**,lib/validation.ts"
description: "Rules for Zod schemas — the only validation layer the project trusts."
---

# Zod Schemas — `lib/schemas/**`

Schemas are the contract between the outside world and our services. They are reused by API routes (server-side parse) and by `react-hook-form` (client-side resolver), so they MUST be isomorphic.

## Conventions

- One file per domain: `asset.ts`, `agent.ts`, `workspace.ts`, etc. Export both the schema and the inferred type:
  ```ts
  export const CreateAssetSchema = z.object({ ... }).strict();
  export type CreateAssetInput = z.infer<typeof CreateAssetSchema>;
  ```
- `.strict()` on object schemas that accept user input — reject unknown keys to prevent mass assignment.
- `.trim()` strings and bound them with `.min(1).max(N)`. Free-text fields cap at a reasonable length (e.g. names ≤ 200, descriptions ≤ 5000).
- Coerce numbers from strings explicitly (`z.coerce.number()`) only on query-string parsers, not on JSON bodies.
- Use enums (`z.enum([...])`) over free-form strings whenever the set is finite. Mirror Prisma enums.
- Refinements for cross-field rules (`z.object({...}).refine(...)`). Don't push these into services.

## Reuse

- Server route → `Schema.parse(json)` (throws ZodError → `apiError` formats it).
- Client form → `useForm({ resolver: zodResolver(Schema) })` from the SAME schema file.
- Never duplicate the schema on the client. If the client needs a subset, derive with `.pick()` / `.omit()`.

## Output schemas

- Optional but recommended for API responses we want to lock down (especially anything sent to partner-portal or embedded clients). Use to strip fields that should never leak (passwordHash, internal IDs of other tenants, etc.).

## Don't

- Don't use `z.any()` or `z.unknown()` as a final type — narrow further.
- Don't validate AFTER touching the database. Validation is the FIRST thing in the request handler.
- Don't write hand-rolled `if (typeof x === 'string')` checks instead of a schema.
