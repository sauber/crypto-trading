---
name: tdd
description: Test Driven Development — rød/grøn/refactor cyklus med fokus på testbar kode. Brug ved implementering af ny funktionalitet.
---

## TDD-cyklus

```
  RØD     →  Skriv en test der fejler
  GRØN    →  Skriv minimal kode så testen passerer
  REFACTOR →  Forbedr koden uden at ændre opførsel
```

## Arbejdsgang

1. **Før kode**: Definer test i `src/<modul>/<fil>.test.ts` (el. `_test.ts` for Deno)
2. **Én test ad gangen**: Implementér kun nok til at gøre testen grøn
3. **Refactor under grøn**: Ryd op, fjern duplikering, forbedr navngivning
4. **Kør hele test-suiten** før commit — intet må være rødt

## Navnekonvention

```
src/
├── modul/
│   ├── fil.ts            # Implementation
│   ├── fil.test.ts       # Unit tests
│   └── fil.integration.ts # Integration tests
```

- Test-filer placeres ved siden af den kode de tester
- Brug `describe`/`it` til struktur: `describe("fil.ts")` → `it("gør X når Y")`

## Teststruktur (AAA)

| Fase | Formål |
|------|--------|
| **Arrange** | Sæt op: mock data, instantier objekter |
| **Act** | Kald metoden / udfør handlingen |
| **Assert** | Tjek resultat — én assertion pr. test (helst) |

## Regler

- Skriv aldrig produktionskode uden en rød test der retfærdiggør den
- Hvis en test er svær at skrive → dårlig kode. Refactor designet
- Mocks kun ved eksterne kald (API, filsystem, clock)
- Test grænser: `0`, `null`, `undefined`, `tom streng`, store tal, fejlcases
