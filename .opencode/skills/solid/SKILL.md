---
name: solid
description: SOLID-principper for modulær kode. Brug ved planlægning af modulstruktur, interfaces og afhængigheder.
---

## SOLID — kort fortalt

| Princip | Regel | Anvendelse |
|---------|-------|------------|
| **S** RP | En klasse/modul har ét ansvar | Hvert modul gør én ting. Split ved "mixed concerns" |
| **O** CP | Åben for udvidelse, lukket for ændring | Brug interfaces/strategy pattern frem for if/switch |
| **L** SP | Subtyper skal kunne erstatte base-typen | Interface skal opfyldes fuldt; smid ikke `unimplemented` |
| **I** SP | Små, fokuserede interfaces > store | Split brede interfaces; klienter afhænger kun af dét de bruger |
| **D** IP | Afhæng af abstraktioner, ikke konkrete klasser | Dependency injection; moduler kender ikke hinandens implementation |

## Retningslinjer

- Interfaces i egne filer (fx `src/strategy/types.ts`)
- Hver klasse i egen fil
- Én dependency direction: `main → strategy → exchange → types`
- Injection via constructor, ikke `new()` internt
- Undgå cirkulære imports — refactor til fælles interface layer
