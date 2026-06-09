---
name: deno
description: Modern Deno practices — imports, TypeScript, standard library, and tooling. Use for setup and daily development.
---

## Imports & dependencies

- Prefer `jsr:` over `npm:` when the library exists there
- Use `deno add jsr:@lib/name` to add — updates `deno.json` automatically
- File-specific imports: `import { x } from "./file.ts"` — always `.ts`/.tsx extension
- Avoid `import_map.json`; use `imports` in `deno.json`

## TypeScript

- `strict: true` i `deno.json`
- Prefer `type` over `interface` for objects
- Use `Deno.env.get("KEY")` for environment variables — never `process.env`
- Async/await over `.then()` — no callbacks unless necessary

## Standardbibliotek (std)

- `@std/assert` — test assertions
- `@std/testing` — mocking, snapshot, bdd
- `@std/fs` — filsystem (walk, exists, move)
- `@std/path` — path manipulation
- `@std/dotenv` — `.env` load

## Proces & tooling

| Tool | Usage |
|---------|------|
| `deno fmt` | Formatting — no `prettier` |
| `deno lint` | Linting — no `eslint` |
| `deno check` | Type-check |
| `deno test` | Test runner — no `jest`/`vitest` |
| `deno task` | Task runner — no `package.json` scripts |

## Projektstruktur (anbefaling)

```
deno.json
src/
├── main.ts           # Entrypoint
├── modul/
│   ├── fil.ts        # Implementation
│   ├── fil.test.ts   # Test alongside
│   └── fil.ts        # Public API barrel
dev_deps.ts           # Bundled dev-dependencies (optional)
```

## Code conventions

- `camelCase` for functions/variables, `PascalCase` for classes/interfaces
- Name test files `{name}.test.ts` — Deno discovers automatically
- Use `export default` sparingly — prefer named exports
- `const` over `let` unless rebinding is necessary
