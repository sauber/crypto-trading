---
name: solid
description: SOLID principles for modular code. Use when planning module structure, interfaces and dependencies.
---

## SOLID — in short

| Princip | Regel | Anvendelse |
|---------|-------|------------|
| **S** RP | A class/module has one responsibility | Each module does one thing. Split at "mixed concerns" |
| **O** CP | Open for extension, closed for modification | Use interfaces/strategy pattern instead of if/switch |
| **L** SP | Subtypes must be able to replace the base type | Interface must be fully implemented; don't throw `unimplemented` |
| **I** SP | Small, focused interfaces > large ones | Split broad interfaces; clients depend only on what they use |
| **D** IP | Depend on abstractions, not concrete classes | Dependency injection; modules don't know each other's implementation |

## Guidelines

- Interfaces in their own files (e.g. `src/strategy/types.ts`)
- Each class in its own file
- One dependency direction: `main → strategy → exchange → types`
- Injection via constructor, not `new()` internally
- Avoid circular imports — refactor to shared interface layer
