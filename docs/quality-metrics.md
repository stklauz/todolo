# Code Quality Metrics Guide

Tools for tracking complexity and duplication in the Todolo codebase.

## Setup

Install the duplication detector:

```bash
npm install --save-dev jscpd
```

## Usage

### Check Complexity

Checks for overly complex functions, deep nesting, too many parameters, etc.

```bash
npm run complexity
```

**What it checks:**

- Cyclomatic complexity > 15
- Functions > 80 lines
- Nesting depth > 4
- Parameters > 6
- Statements > 30

### Check Duplication

Finds copy-pasted code blocks.

```bash
npm run duplication
```

**What it checks:**

- Duplicate code blocks (5+ lines)
- Threshold: warns if > 10% duplication

### Check Both

```bash
npm run quality
```

## How to Use with AI

### Before Making Changes

Run baseline:

```bash
npm run quality > quality-before.txt
```

### After Making Changes

Compare:

```bash
npm run quality > quality-after.txt
diff quality-before.txt quality-after.txt
```

### Example AI Prompt

> "I'm refactoring useListsIndex. Before I commit, can you run `npm run complexity` and `npm run duplication` to verify we reduced complexity and duplication?"

## Integration with Pre-commit

To run automatically before commits, add to `.husky/pre-commit`:

```bash
# Optional: Block commits with high complexity
npm run quality || exit 1
```

## Reading the Output

### Complexity Example

```
src/hooks/useTodosState.ts:45:3: Function has complexity of 18. Maximum allowed is 15.
```

**Meaning:** Function starting at line 45 is too complex, consider breaking it down.

### Duplication Example

```
Found 2 clones in useListsIndex.ts and useTodosPersistence.ts
Lines: 25-35 duplicated
```

**Meaning:** Lines 25-35 are copy-pasted between files, extract to shared utility.

## What Changed in Phase 4 & 5

**Before (Phase 3):**

- `useListsIndex`: Complexity 40, Duplication 44%
- `useTodosPersistence`: Manual timer logic
- Total timer code: ~140 lines

**After (Phase 5):**

- Centralized save timing in `SaveQueue`
- Removed duplicate lifecycle handlers
- Reduced ~70 lines of timing code
- Expected: Lower complexity, lower duplication

**To measure after commit:**

```bash
npm run quality
# Compare with Codacy dashboard for historical trends
```

## Tips

1. **Complexity > 15**: Break function into smaller ones
2. **Duplication > 10%**: Extract to shared utilities
3. **Deep nesting**: Use early returns or extract helpers
4. **Long functions**: Split by responsibility

## Codacy Integration

These local tools complement Codacy (which runs on commits):

- **Local tools**: Pre-commit feedback, immediate
- **Codacy**: Historical trends, team visibility, CI/CD integration

Use both for best results!
