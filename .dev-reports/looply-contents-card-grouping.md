# Contents Card Grouping — Implementation Report

## Branch

`feature/demo-v1-polish`

## Initial SHA

`7cdb2ff` (previous commit on this branch)

## Summary

Added card grouping (parent-child / sub-ticket) functionality to the Kanban. When a user drags a card from the same company over another card for ~1.5 seconds, the target card highlights and a drop groups the dragged card as a child. Children render as compact sub-items under the parent card. Normal column-to-column drag-and-drop remains fully functional.

## Files Changed

### Backend
- `backend/prisma/schema.prisma` — added `parentId String?` field + self-referential `ContentGroup` relation + `@@index([parentId])`
- `backend/src/services/contentService.ts` — added `children` include in `listContents`, added `groupContent()` and `ungroupContent()` functions with circular-reference protection
- `backend/src/routes/contents.ts` — added `POST /:id/group` and `POST /:id/ungroup` endpoints

### Frontend
- `frontend/src/lib/types.ts` — added `parentId?: string | null` and `children?` array to `ContentListItem`
- `frontend/src/lib/api.ts` — added `useGroupContent()` and `useUngroupContent()` mutation hooks
- `frontend/src/features/ContentsList.tsx` — complete rewrite of drag logic: long-hover timer, group target state, filtered top-level items, children rendering, visual "Agrupar aqui" overlay

## How Grouping Works

### Data Model
- `Content.parentId` (optional FK to self) — when set, the content is a child/sub-ticket
- `Content.children` — reverse relation, parent has many children
- `ON DELETE SET NULL` — deleting a parent does not cascade-delete children

### Backend
- `listContents` now includes `children: { select: { id, title, status, format } }` for each content item
- `groupContent(childId, parentId)`:
  - Validates same company (`clientId` match)
  - Checks for circular references (walks up parent chain)
  - Sets `parentId` on the child
- `ungroupContent(childId)`: sets `parentId` to null

### Frontend — Long-Hover Detection
1. User starts dragging a card → `draggedId` + `draggedClientId` set
2. Drag enters another card's area → `handleCardDragOver` fires
3. If same company and different card: starts a 1.5s timer, sets `groupTargetId`
4. Timer completes → target card shows "Agrupar aqui" overlay with dashed border + ring
5. User drops → if `groupTargetId` is set, calls `groupMutation.mutate()` instead of column drop
6. If user moves away before timer → `handleCardDragLeave` clears timer and target

### Frontend — Card Rendering
- Items with `parentId` are excluded from top-level column display
- Parent cards render children as compact sub-items (title + StatusPill) in a bordered section below
- Children are clickable and navigate to their own detail page

## Tests Executed

| Command | Result |
|---------|--------|
| `npm --prefix backend run typecheck` | PASS |
| `npm --prefix frontend run typecheck` | PASS |
| `npm --prefix backend run test` | PASS (20/20) |
| `npm --prefix frontend run test` | PASS (5/5) |
| `npm --prefix frontend run build` | PASS |
| `npm --prefix backend run build` | PASS |
| `git diff --check` | PASS (clean) |

## Limitations Known

- No E2E tests exist in the project — E2E gate dispensable
- Grouping state is not persisted in URL — page refresh resets filter/grouping view
- The 1.5s hover threshold is hardcoded (could be made configurable if needed)
- Children always stay in the same column as their parent (they inherit parent's status); to move a child, ungroup it first then drag

## E2E Gate

**Dispensable** — no E2E framework exists in the repository.

## git diff --check

Clean — no whitespace errors.

## Commit Hash

Pending commit.
