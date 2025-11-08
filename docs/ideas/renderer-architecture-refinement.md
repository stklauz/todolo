# Renderer Architecture Refinement Notes

## Context

- **Age:** ~2 months, evolving rapidly off the Electron React Boilerplate.
- **Current shape:** Renderer hooks → Zustand store (single dense module) → persistence hooks/queues → IPC → SQLite.
- **Positive aspects:** Consistent naming, strong test coverage, predictable data flow once discovered.
- **Pain points:** High cognitive load (monolithic store, intertwined hooks), implicit contracts (timestamps, ordering), implicit persistence flow spread across hooks and store.

## Goals

- Make boundaries self-evident from file structure, not inference.
- Reduce cognitive load for modifying core behaviors (add/edit/delete lists & todos).
- Ensure invariants (sorting, timestamps, persistence) live in testable, reusable utilities.
- Create a “cascading” workflow: UI change → command/service → store → persistence, with each layer narrow and explicit.

## Recommended Structure Shifts

1. **Feature Slices with Façades**
   - Keep `features/todos/` but expose a curated public API via an index file (e.g. `features/todos/index.ts` exporting hooks, selectors, commands).
   - Private subfolders: `api/`, `services/`, `store/`, `hooks/`, `ui/`.
   - Result: contributors touch the façade and a local slice; no cross-feature spelunking.

2. **Decompose the Store**
   - Split `useTodosStore` into smaller composable stores or controllers (e.g., `listsStore`, `todosStore`, `selectionStore`).
   - Move shared logic (sorting, timestamp stamping, validation) into `utils/` modules; stores simply orchestrate.
   - Wrap high-level mutations in named commands (e.g., `listsCommand.rename`) that call the relevant slices.

3. **Introduce Service Layer**
   - Create `services/listsService.ts`, `services/todosService.ts` mediating between commands and persistence.
   - Responsibilities: normalize payloads, enforce invariants, trigger saves, log events.
   - Hooks and UI issue intent-based commands; services handle side effects and call IPC.

4. **Make Persistence Flow Explicit**
   - Represent the `load → normalize → sort → hydrate store` pipeline in one module (e.g., `services/listsLoader.ts`).
   - Consider an event-bus or lightweight state machine to route “listRenamed” events to store updates and save queues.
   - Document retry/queue behavior alongside the implementation for fast comprehension.

5. **Shared Utilities & Types**
   - Consolidate timestamp parsing, recency sorting, todo-tree helpers, and migrations under `shared/` or `lib/`.
   - Strengthen domain types (make `updatedAt` required, define DTOs vs domain models) to encode invariants in TypeScript.

6. **Guiding Docs & Scaffolding**
   - Add `README.md` inside `features/todos/` outlining the layers and data flow.
   - Provide a generator template (or documented checklist) for adding new features using the same slice pattern.
   - Maintain concise architecture notes in `/docs/` so new engineers need minutes—not days—to orient.

## Incremental Adoption Plan

| Step | Focus                                                                                 | Impact                                         |
| ---- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1    | Extract utility modules (sorting, timestamp helpers, todo tree ops) and tighten types | Safer invariants, smaller stores               |
| 2    | Introduce services for lists/todos with command-style API                             | Clear separation of pure state vs side effects |
| 3    | Split Zustand store into slice modules consumed by a composed store                   | Lower cognitive complexity warnings            |
| 4    | Document the slice & service contract (short README + diagrams)                       | Architecture becomes self-explanatory          |
| 5    | Optional: add event bus or state machine for persistence/IPC orchestration            | Easier to extend features like sync            |

## Additional Guardrails

- Keep the strong test suite but categorize by layer (unit, integration, e2e) for faster intent signals.
- Add CI checks for lint, TypeScript, targeted jest suites to catch regressions early.
- Prefer command/event naming that mirrors user actions (e.g. `listRenamed`, `todoInserted`) to keep cascading effects readable.

---

These notes capture the current conversation threads; refine them into a living architecture guide as the restructuring progresses.

## Reviewer Comments (from Codex)

This section is an external review and should be evaluated carefully before making any decisions. Treat the following as proposals for team discussion, not directives.

- Public facade for the feature: Add `features/todos/index.ts` exporting the stable API (hooks, selectors, commands). Internals can iterate without churn to call sites.
- Shared domain types and IPC schemas: Create `src/shared/types.ts` (e.g., `EditorTodo`, `ListsIndexV2`) and `src/shared/ipcSchemas.ts` (Zod/io-ts). Validate on both renderer and main; derive types from schemas to prevent drift.
- Services own side effects: Move SaveQueue + IPC orchestration into `services/` (e.g., `listsService`, `todosService`). Hooks express intent and call services; stores stay focused on pure state updates.
- Store decomposition with restraint: Compose a small number of slices (listsMeta, todos, selection/operations) within a single zustand store to reduce cognitive load while avoiding cross-slice chatter.
- Make persistence flow explicit: Centralize the load → normalize → sort → hydrate pipeline in a loader service. Document debounce defaults, flush points, and retry/backoff behavior alongside the implementation.
- Deterministic ordering: Keep a single recency helper (timestamp desc, name asc). Add a unit test for tie-breaking on equal timestamps. Consider renaming `timestampOrThrow` to reflect behavior (e.g., `timestampOrZero`) or filter invalids earlier.
- Time handling: Standardize on ISO strings end-to-end and consolidate parsing/normalization in `shared/time.ts` to avoid duplication and subtle inconsistencies.
- Deletion semantics: Maintain upsert-only behavior for index saves; route deletions via explicit commands (`deleteList`). Document this invariant so contributors don’t introduce accidental data loss.
- Observability: Retain structured logs; add lightweight counters/metrics for saves/loads/failures that no-op in production but are assertable in tests. Ensure production log gating to avoid noise.
- Incremental adoption path: Start with shared types/utilities (no behavior changes), then introduce services + facade, then extract store slices. Defer event bus/state machine until effects become high-fanout.

Risks to watch:

- Over-engineering early: Prefer services + composed slices before introducing an event bus. Keep slice count small to avoid coordination overhead.
- Dual write paths: Ensure UI writes go through commands/services, not directly to the store, to keep side effects and persistence consistent.

Small immediate wins:

- Add SaveQueue cleanup on unmount in `useTodosPersistence` to avoid dangling timers.
- Add a name tie-breaker test in `listOrdering.test.ts` to lock sort determinism.
