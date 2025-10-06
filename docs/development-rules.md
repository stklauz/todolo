# Development Rules: New Feature Checklist

Use this as a simple, implementation‑doc checklist. Keep changes small, incremental, and well‑tested.

## Quick Checklist (TL;DR)
- Define the problem and success criteria.
- Reuse existing code/utilities; avoid duplication.
- Design minimal interfaces and data flow; name things clearly.
- Write tests as you build (happy path, edges, failures).
- Validate inputs; fail fast with helpful errors.
- Add observability (logs/metrics) for key paths.
- Handle timeouts, retries, and idempotency where needed.
- Update docs/usage and capture rollout/rollback notes.
- Run tests; remove dead code and noisy logs.

## Style (How to Code in this project)
- Think in slices: deliver a safe, testable increment first.
- Prefer composition and small functions; keep boundaries clean.
- Start from reuse: search for existing helpers before writing new ones.
- Make behavior obvious via tests and names, not comments.
- Instrument key paths; measure before optimizing.
- Make failure modes explicit: validate, guard, and return useful errors.
- Leave the campsite cleaner: remove duplication and tighten interfaces.

## Minimal Steps for Implementation Docs
1) Problem & scope: goal, non‑goals, inputs/outputs, edge cases.
2) Data flow & interfaces: functions, types, contracts, flags.
3) Test plan: cases, fixtures, and what won’t be tested (and why).
4) Rollout plan: flags, migrations, and rollback steps.
5) Observability: what to log/measure and where to look.
6) Risks: perf, security/privacy, reliability; mitigations.

## Testing (Do It As You Build)
- Add or extend tests with each change—not only at the end.
- **Unit Tests**: Fast, isolated tests for individual functions/components
- **Integration Tests**: Test interactions between modules
- **Edge Cases**: Test boundary conditions, error states, and invalid inputs
- **Performance Tests**: For time-sensitive operations (if applicable)
- Focus on fast unit tests; add integration/e2e for cross-boundary behavior.
- Keep tests deterministic and readable; avoid over-mocking.
- Target: >80% code coverage for new code, 100% for critical paths.

## Implementation Notes
- If duplication is unavoidable, extract a shared utility immediately after.
- Validate inputs and handle null/undefined; avoid silent failures.
- Guard external calls with timeouts/retries; ensure idempotency for retries.

## Observability
- **Logging**: Key decision points, errors, and state changes
- **Metrics**: Performance counters, user actions, system health
- **Monitoring**: Alerts for critical failures and performance degradation
- **Debugging**: Sufficient context for troubleshooting production issues

## Code Review Checklist
- [ ] Changes are incremental and focused
- [ ] Tests cover new functionality and edge cases
- [ ] No duplication with existing code
- [ ] Error handling is appropriate
- [ ] Documentation is updated
- [ ] Performance impact is considered

## Code Quality
- Run formatting, lint, and type checks.
- Remove dead code and debug logs; ticket any remaining TODOs.
- Document breaking changes.

## Definition of Done
- Feature is behind a flag or fully user‑ready.
- Tests exist and pass; key paths are observable.
- Docs updated; rollout/rollback verified.
- No unnecessary duplication; code aligns with project patterns.

## Examples

### Good: Incremental Feature Addition
- Start with basic functionality behind a feature flag
- Add comprehensive tests for core paths
- Gradually expose to users with monitoring

### Bad: Big Bang Implementation
- Implementing entire feature without flags
- Testing only after implementation is complete
- No rollback strategy

### Good: Code Reuse
```typescript
// Reuse existing validation utility
const isValidEmail = validateEmail(userInput);
```

### Bad: Duplication
```typescript
// Don't reimplement existing functionality
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = emailRegex.test(userInput);
```

---

Tip: If a rule adds little value for this change, note the trade-off in the change summary and choose the smallest safe alternative.
