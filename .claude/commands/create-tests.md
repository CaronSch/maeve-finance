# Create Tests

Generate unit tests for the changes in the current branch.

## Instructions

You MUST follow these steps in order:

### 1. Identify changed files

Run `git diff main...HEAD --name-only` (or `master` if main doesn't exist) to get the list of files changed in this branch. Filter to application source files only: `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.jsx` (respect the project’s actual extensions).

Exclude files that are already tests or types-only:

- `*.test.*`, `*.spec.*`
- Files under `__tests__/` that are test modules
- `*.d.ts` unless the change is specifically about exported types that need runtime assertions

### 2. Analyze the changes

For each changed source file, run `git diff main...HEAD -- <file>` to understand exactly what was added, modified, or removed. Focus on:

- New or changed exported functions, classes, and hooks
- Modified branching or control flow
- New or changed async/Promise behavior and error paths
- New types used at runtime (validators, parsers, discriminated unions)
- New edge cases (null/undefined, empty arrays/strings, boundary values)

### 3. Identify testable units

For each changed file, identify what is worth unit testing:

- Pure or mostly pure logic with deterministic output
- Branching logic (conditionals, loops, switch)
- Error handling and rejection paths
- Edge cases (falsy values, empty collections, limits)
- Anything newly introduced that lacks coverage

Skip trivial pass-throughs, one-line getters with no logic, and pure re-exports unless the diff adds behavior.

### 4. Check for existing tests

Discover how this repo names and places tests (e.g. colocated `*.test.ts`, `*.spec.ts`, or `__tests__/` next to source). For a source file `foo.ts`, prefer extending `foo.test.ts` / `foo.spec.ts` (or the project’s equivalent) in the same area. Read existing test files to match patterns: runner API (`describe`/`it` vs `test`), assertions (`expect`), mocks (`vi`, `jest`, `sinon`), and shared helpers — extend them instead of inventing a new style.

### 5. Write the tests

Write idiomatic tests for the project’s chosen runner (Jest, Vitest, Node’s built-in `node:test`, etc. — detect from `package.json` and config files):

- Prefer table-driven or parameterized cases for multiple inputs/outputs
- Use nested `describe` blocks only when they improve readability; keep examples focused on one behavior
- Name tests so failures read like specifications (input + expected outcome)
- Mock HTTP, DB, Redis, filesystem, and timers at module boundaries; do not rely on real network or production services in unit tests
- For async code, use the runner’s async support (`async`/`await` or returned Promises) and assert rejections explicitly where errors matter
- Match project conventions for fake timers, `fetch`, and ESM vs CJS

### 6. Run the tests

From the repo root or the relevant workspace package (monorepos: `cd` into the package that owns the changed code), run the project’s test script, scoped when possible:

- Examples: `npm test -- <pattern>`, `pnpm test -- <pattern>`, `yarn test <pattern>`, `npx vitest run <pathOrPattern>`, `npx jest <pathOrPattern>`

Use whatever flag the project uses to run a subset (file path, test name pattern, or `--runTestsByPath`). If tests fail, fix them. Do not leave failing tests.

### 7. Report

List each test file created or modified, the test cases or suites added, and confirm they all pass.
