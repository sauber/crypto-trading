---
name: deno
description: Moderne Deno-praksis — imports, TypeScript, standardbibliotek, og tooling. Brug ved opsætning og daglig udvikling.
---

## Imports & dependencies

- Foretræk `jsr:` frem for `npm:` når biblioteket findes dér
- Brug `deno add jsr:@lib/name` til at tilføje — opdaterer `deno.json` automatisk
- Filspecifikke imports: `import { x } from "./fil.ts"` — altid `.ts`/.tsx ekstension
- Undgå `import_map.json`; brug `imports` i `deno.json`

## TypeScript

- `strict: true` i `deno.json`
- Foretræk `interface` over `type` for objekter
- Brug `Deno.env.get("KEY")` til miljøvariabler — aldrig `process.env`
- Async/await over `.then()` — ingen callbacks med mindre nødvendigt

## Standardbibliotek (std)

- `@std/assert` — test assertions
- `@std/testing` — mocking, snapshot, bdd
- `@std/fs` — filsystem (walk, exists, move)
- `@std/path` — sti-manipulation
- `@std/dotenv` — `.env` load

## Proces & tooling

| Værktøj | Brug |
|---------|------|
| `deno fmt` | Formattering — ingen `prettier` |
| `deno lint` | Linting — ingen `eslint` |
| `deno check` | Type-check |
| `deno test` | Test runner — ingen `jest`/`vitest` |
| `deno task` | Task runner — ingen `package.json` scripts |

## Projektstruktur (anbefaling)

```
deno.json
src/
├── main.ts           # Entrypoint
├── modul/
│   ├── fil.ts        # Implementering
│   ├── fil.test.ts   # Test ved siden af
│   └── fil.ts        # Public API barrel
dev_deps.ts           # Samlede dev-dependencies (frivillig)
```

## Kodekonventioner

- `camelCase` for funktioner/variable, `PascalCase` for klasser/interfaces
- Navngiv test-filer `{navn}.test.ts` — Deno discoverer automatisk
- Brug `export default` sparsomt — foretræk named exports
- `const` frem for `let` medmindre rebinding er nødvendigt
