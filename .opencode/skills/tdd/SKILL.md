---
name: tdd
description: Test Driven Development — red/green/refactor cycle focused on testable code. Use when implementing new functionality.
---

## TDD-cyklus

```
  RED     →  Write a test that fails
  GREEN    →  Write minimal code so the test passes
  REFACTOR →  Improve the code without changing behavior
```

## Workflow

1. **Before code**: Define test in `src/<module>/<file>.test.ts` (or `_test.ts` for Deno)
2. **One test at a time**: Implement only enough to make the test green
3. **Refactor under green**: Clean up, remove duplication, improve naming
4. **Run the entire test suite** before commit — nothing should be red

## Naming convention

```
src/
├── modul/
│   ├── fil.ts            # Implementation
│   ├── fil.test.ts       # Unit tests
│   └── fil.integration.ts # Integration tests
```

- Test files are placed next to the code they test
- Use `describe`/`it` for structure: `describe("file.ts")` → `it("does X when Y")`

## Teststruktur (AAA)

| Phase | Purpose |
|------|--------|
| **Arrange** | Set up: mock data, instantiate objects |
| **Act** | Call the method / perform the action |
| **Assert** | Check the result — one assertion per test (preferably) |

## Rules

- Never write production code without a red test that justifies it
- If a test is difficult to write → bad code. Refactor the design
- Mocks only for external calls (API, filesystem, clock)
- Test boundaries: `0`, `null`, `undefined`, `empty string`, large numbers, error cases
