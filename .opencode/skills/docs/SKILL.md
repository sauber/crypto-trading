---
name: docs
description: Documentation workflow for the KuCoin trading agent. Use when creating or updating AGENTS.md files, JSDoc, or skills.
---

# Documentation workflow

## AGENTS.md per component

Each `src/<component>/` directory has an `AGENTS.md` describing:

- The component's interface (types)
- Available strategies/implementations with filenames
- Config format
- Any important behavior notes

## Root AGENTS.md

The project root `AGENTS.md` contains:

- Architecture diagram (pipeline overview)
- Links to per-component AGENTS.md
- Commands table
- Environment variables
- Coding standards (SOLID, conventions)
- Project structure tree

## Skills

Skills live in `.opencode/skills/<name>/SKILL.md` with frontmatter:

```yaml
---
name: <name>
description: <one-liner>
---
```

They contain workflow guidance specific to a task domain.

## JSDoc

Add `/** ... */` JSDoc to every public interface, class, and method.
Use `@param` and `@returns` tags. No JSDoc on private/internal symbols.
