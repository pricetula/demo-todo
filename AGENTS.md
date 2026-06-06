# AGENTS.md — Todo Timeline

## Stack
- **Next.js** 16 (App Router) + **React** 19
- **Tailwind CSS** v4 + **shadcn/ui** patterns
- **@tanstack/react-query** v5
- **IndexedDB** (raw API, no wrapper)
- **TypeScript**

## Architecture

```
page.tsx
 └─ TimelineContainer (shell)
     └─ TaskCard (shell) · ScrollAnchor (shell) · PriorityToggle (shell)

hooks/use-tasks.ts  ── React Query wrappers (fetch, create, update with optimistic)
db/indexeddb-store.ts ── CRUD over IndexedDB (openDb, withStore helper)
types/index.ts       ── Domain types (currently orphaned)
```

## `Task` Type (single source of truth)

Defined in `types/index.ts`, re-exported by `db/indexeddb-store.ts`, imported by hooks.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID |
| `title`, `description` | `string` | |
| `status` | `'unfinished'\|'done'\|'skipped'` | |
| `priority` | `'low'\|'high'` | |
| `scheduled_date` | `string` | `YYYY-MM-DD` |
| `start_time` | `string` | `HH:mm` |
| `completed_at` | `string \| null` | ISO timestamp |
| `created_at`, `updated_at` | `string` | ISO timestamps, auto-set |

## Known Gaps
- All 4 components are empty `<div>` shells — no rendering logic, no wiring to hooks
- `useUpdateTaskStatus` references `completed_at`/`updated_at` fields that only exist in the DB store's shape
- `Button` & `Dialog` are handwritten placeholders (run `npx shadcn@latest add` to replace)
- No tests, no lint-staged, no CI

## Dev
```bash
npm run dev    # local dev server
npm run build  # type-check + production build
```
