# Duplicate List Feature

Status: planned → implementing

This folder contains phase-by-phase docs for the Duplicate List feature. Start with Phase 1 and proceed sequentially. Each phase is shippable and includes acceptance criteria and tests.

- Phase 1 — Core Path + UI Smoke: features/duplicate-list/phase-1.md
- Phase 2 — UI Integration & A11y: features/duplicate-list/phase-2.md
- Phase 3 — Observability & Perf: features/duplicate-list/phase-3.md

LLM-Friendly Spec (Authoritative)
- Feature ID: duplicate_list_v1
- Files by layer:
  - DB: src/main/db.ts
  - IPC: src/main/main.ts
  - Storage: src/renderer/features/todos/api/storage.ts
  - State: src/renderer/features/todos/hooks/useTodosState.ts
  - UI: src/renderer/features/todos/components/TodoApp.tsx (title actions), src/renderer/features/todos/components/ListSidebar.tsx (list display)
- IPC Contract: duplicate-list(sourceListId: string, newListName?: string) →
  - Success: { success: true, newListId: string }
  - Failure: { success: false, error: ErrorCode }
- ErrorCode: 'invalid_source_id' | 'not_found' | 'internal_error'
- Determinism: copy todos reusing id and order_index under the new list_id.
- UX: Title actions menu shows "Duplicate list" above "Delete list"; disable while duplicating; ARIA live announces status.
