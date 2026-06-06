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

## Components Created

### `task-form.tsx`
Validated task creation form with `react-hook-form` + `zod`.
- **Fields**: Title, Description, Priority toggle, Date (Popover+Calendar), Time (3 Select dropdowns: Hours, Minutes, Format toggle)
- **Time format**: Hours dropdown dynamically switches between `01-12` (AM/PM) and `00-23` (24h) based on the Format toggle
- **Validation**: Title required (max 100 chars), hours range validated per format via `superRefine`
- **Transformation**: `onSubmit` converts JS Date → `YYYY-MM-DD` and normalizes time → `HH:mm` (24h)
- **Import path**: `@/features/todo-timeline/components/task-form`
- All UI primitives imported from `@/components/ui/` (`Form`, `Input`, `Textarea`, `Select`, `Popover`, `Calendar`, `Button`)

### UI Primitives (`@/components/ui/`)
- `button.tsx` — Real shadcn button with variants (default/destructive/outline/secondary/ghost/link)
- `input.tsx`, `textarea.tsx`, `label.tsx` — Standard shadcn inputs
- `form.tsx` — react-hook-form wrapper (FormProvider + FormField/FormItem/FormLabel/FormControl/FormMessage)
- `select.tsx` — Radix UI select with scroll buttons, check indicator
- `popover.tsx` — Radix UI popover
- `calendar.tsx` — react-day-picker v10 wrapper with shadcn styling

## Known Gaps
- `TimelineContainer`, `TaskCard`, `ScrollAnchor`, `PriorityToggle` are empty `<div>` shells — not yet wired to hooks or the form
- `useUpdateTaskStatus` references `completed_at`/`updated_at` fields via the canonical Task type
- `Dialog` remains a handwritten placeholder
- No tests, no lint-staged, no CI

## Dev
```bash
npm run dev    # local dev server
npm run build  # type-check + production build
```
