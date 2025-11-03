# ESLint: Unused Variables Policy

## Current Approach

**Production Code:** ✅ `error` - Unused variables are build-breaking errors  
**Test Files:** ⚠️ `warn` - Unused variables generate warnings but don't break builds

## Rationale

Test files often have legitimately unused variables due to:

- Test setup/mocking requirements (`import * as storage` for `jest.mock()`)
- User event setup that may not be used in every test
- Mock variables needed for type checking but not assertions

## Alternative Approaches Considered

### 1. Strict (Errors Everywhere)

```javascript
'@typescript-eslint/no-unused-vars': ['error', ...]
```

**Rejected:** Too rigid for test files; requires excessive `eslint-disable` comments

### 2. Fully Disabled in Tests

```javascript
'@typescript-eslint/no-unused-vars': 'off'
```

**Rejected:** Loses valuable feedback about actual unused code

### 3. Whitelist Common Patterns

```javascript
varsIgnorePattern: '^_|^React$|^storage$|^user$|^mockStorage$';
```

**Rejected:** Becomes an ever-growing list; masks real issues

### 4. Current: Warnings + Prefix Convention

```javascript
// Intentionally unused - prefix with _
const _user = setupUser();

// Genuinely needed but triggers warning
import * as storage from '...'; // Required for jest.mock()
```

**Chosen:** Balances strictness with pragmatism

## Best Practices

1. **Remove genuinely unused imports/variables**

   ```bash
   npm run lint:fix  # Auto-removes most unused imports
   ```

2. **Prefix intentionally unused variables with `_`**

   ```javascript
   const _unusedSetup = setupComplexMock(); // Won't warn
   ```

3. **Use per-line disable for edge cases**

   ```javascript
   // eslint-disable-next-line @typescript-eslint/no-unused-vars
   import * as storage from '...'; // Required for jest.mock()
   ```

4. **Review warnings periodically**
   ```bash
   npm run lint | grep warning
   ```

## Industry Standards

- **Google**: Warnings in tests, errors in prod
- **Airbnb**: Strict errors, but allows `_` prefix
- **Facebook**: Auto-fix on save (removes unused imports)
- **Microsoft**: Warnings everywhere, relies on code review

## Future Improvements

Consider adding:

- `eslint-plugin-unused-imports` - Auto-removes unused imports
- VSCode setting: `"editor.codeActionsOnSave": { "source.removeUnused": true }`
- Pre-commit hook: Run `lint:fix` automatically

## Summary

✅ **What we do:** Errors in prod, warnings in tests, `_` prefix for intentional  
🎯 **Why:** Catches real issues without friction in test setup  
📊 **Result:** Clean prod code + flexible tests
