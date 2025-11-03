# Release Process

This document explains how the automated release process works in Todolo.

## Overview

Todolo uses [Semantic Release](https://semantic-release.gitbook.io/) to automatically determine version bumps and create releases based on commit messages. This eliminates the need to manually manage version numbers or create git tags.

## How It Works

### 1. Commit Message Analysis

Every commit message is analyzed to determine if a release is needed:

- **`fix:`** → Patch release (1.4.0 → 1.4.1)
- **`feat:`** → Minor release (1.4.0 → 1.5.0)
- **`feat!:` or `fix!:`** → Major release (1.4.0 → 2.0.0)
- **Other types** → No release

### 2. Release Triggers

**Commits that trigger releases:**

- `fix: resolve drag drop issue` → Patch release
- `feat: add dark mode` → Minor release
- `feat!: redesign entire UI` → Major release
- `fix!: change API format` → Major release

**Commits that DON'T trigger releases:**

- `refactor: simplify todo logic`
- `chore: update dependencies`
- `docs: update README`
- `test: add coverage`
- `style: format code`
- `perf: optimize rendering`
- `build: update webpack config`
- `ci: fix workflow`

### 3. Automated Process

When you push commits to `main`:

1. **Tests run** - All tests must pass
2. **Coverage reported** - Sent to Codacy
3. **Semantic Release analyzes** - Checks if release needed
4. **If release needed:**
   - Updates `package.json` version
   - Updates `release/app/package.json` version
   - Generates `CHANGELOG.md`
   - Creates git tag (e.g., `v1.4.1`)
   - Builds Electron app
   - Publishes to GitHub Releases

## Commit Message Format

All commit messages must follow this format:

```text
type: description
type(scope): description
```

### Valid Types

| Type       | Description              | Release Impact |
| ---------- | ------------------------ | -------------- |
| `feat`     | New feature              | Minor release  |
| `fix`      | Bug fix                  | Patch release  |
| `refactor` | Code refactoring         | No release     |
| `chore`    | Maintenance tasks        | No release     |
| `docs`     | Documentation changes    | No release     |
| `style`    | Code formatting          | No release     |
| `test`     | Adding/updating tests    | No release     |
| `perf`     | Performance improvements | No release     |
| `build`    | Build system changes     | No release     |
| `ci`       | CI/CD changes            | No release     |

### Breaking Changes

To trigger a major release, use `!` after the type:

- `feat!: redesign API` → Major release
- `fix!: change data format` → Major release

Or include `BREAKING CHANGE:` in the commit body:

```text
feat: add new API

BREAKING CHANGE: The old API is deprecated
```

### Examples

**Good commit messages:**

```bash
feat: add dark mode toggle
fix: resolve drag drop crash
refactor: extract todo logic into separate module
chore: update electron to latest version
docs: add release process documentation
feat(ui): add new button component
fix!: change API response format
```

**Bad commit messages:**

```bash
fixed the bug
added feature
update
WIP
```

## Retrying Failed Builds

If a build fails, you can retry it:

1. Go to GitHub Actions → CI workflow
2. Click "Re-run failed jobs" or "Re-run all jobs"
3. The workflow will continue from where it left off

Semantic Release is **idempotent** - it won't create duplicate releases or tags if run multiple times.

## Manual Release (Emergency)

If you need to create a release manually:

1. Update `package.json` version
2. Commit the change
3. Push to `main`
4. The CI workflow will detect the version change and create a release

## Troubleshooting

### Commit Message Rejected

If your commit message is rejected, you'll see a helpful error message showing:

- What was wrong with your message
- Valid commit types
- Examples of correct format

Fix the message and try again:

```bash
git commit --amend -m "fix: resolve the issue"
```

### No Release Created

If no release was created, check:

- Did you use `fix:` or `feat:` in your commit message?
- Are there any commits since the last release?
- Did the CI workflow run successfully?

### Build Fails

If the build fails:

- Check the GitHub Actions logs
- Fix the issue in your code
- Push a new commit (or re-run the workflow)
- The release will continue automatically

## Configuration Files

- `.releaserc.json` - Semantic Release configuration
- `.commitlintrc.json` - Commit message validation rules
- `.husky/commit-msg` - Pre-commit hook for validation
- `.github/workflows/ci.yml` - CI/CD workflow

## Benefits

- **No manual version management** - Versions are determined automatically
- **Consistent releases** - Same process every time
- **Clear changelog** - Generated automatically from commits
- **Safe retries** - Can retry failed builds without issues
- **Commit discipline** - Enforces good commit message practices
