---
applyTo: "components/**,app/**/*.tsx"
description: "Rules for React components, layouts, and pages in the web app."
---

# React Components & Pages

## Server vs Client

- Default to **Server Components**. Add `"use client"` ONLY when you need: `useState`, `useEffect`, `useRef`, browser APIs, event handlers, Socket.io subscriptions, WebRTC peers, or third-party client-only libs.
- Never put `"use client"` on layouts or pages that just compose server-rendered children.
- Server Components may call services (`AssetService.getAssets(...)`) directly — but still through the service, never `prisma.*`.

## Data flow

- Server Component → service call → pass typed data to Client Component as props.
- Client Components fetch dynamic / paginated data via `fetch("/api/...")` to typed routes (or the existing TanStack Query hooks in `hooks/`).
- Live updates: use the Socket.io client wrappers in `lib/websocket/` — do not instantiate `io()` ad hoc.

## Forms

- `react-hook-form` + `@hookform/resolvers/zod`. Reuse the schema from `lib/schemas/` — do NOT redeclare it.
- All submit handlers POST/PATCH to an API route; never call services from a Client Component.
- Disable submit while pending; surface server validation errors per field.

## Styling

- Tailwind + `cn()` (from `lib/utils.ts`) for conditional classes. Use `tailwind-merge` semantics; never concatenate strings manually.
- Use design tokens — `nerve` (neutral surface), `cortex` (primary teal), `oracle` (warning amber), `reflex` (success green), `health-*` (status). Don't introduce new color literals.
- Dark mode: classes work in both — never hardcode `bg-white` / `text-black`. Use `bg-background`, `text-foreground`, etc.
- shadcn primitives in `components/ui/` are generated. If you need a variant, extend through `class-variance-authority` rather than forking the file.

## Accessibility

- Every interactive element is keyboard-reachable and labelled (aria-label, `<label htmlFor>`, or visible text).
- Focus states must be visible — do not remove `outline` without replacement.
- Color is never the sole signal — pair status colors with an icon or text.
- Modals trap focus and restore it on close (Radix Dialog already handles this; don't break it).

## Performance

- Avoid client bundles bloat: dynamic-import heavy charts/editors with `next/dynamic` and `{ ssr: false }` only when truly client-only.
- `next/image` for images, with `width`/`height` set.
- Memoize expensive derivations with `useMemo`; memoize child callbacks with `useCallback` only when the child is itself memoized.

## Don't

- Don't fetch from the database in a Client Component (impossible) or call services from one (architecturally forbidden).
- Don't render untrusted HTML with `dangerouslySetInnerHTML` without `isomorphic-dompurify` + a strict allowlist.
- Don't store auth tokens or workspace IDs in `localStorage` — read from the session.
