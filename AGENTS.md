Scope: Entire repository

Purpose: Ensure agents follow our development rules for any change.

Rules for Agents
- Always follow docs/development-rules.md when implementing features or fixes.
- Work in small, incremental changes. If a feature is incomplete, guard it behind a flag.
- Prefer reuse over duplication. Search repo utilities before adding new ones.
- Write or update tests as you build, not at the end. Changes without tests need an explicit reason.
- Keep interfaces minimal and names clear. Validate inputs and handle failure modes explicitly.
- Add basic observability (logs/metrics) for key paths you touch.
- Update docs that users/devs rely on when behavior changes.

Operational Requirements
- Pre-commit must pass: tests (see .husky/pre-commit).

Notes
- If a rule is intentionally skipped, state the trade-off and the smallest safe alternative in the change summary.
