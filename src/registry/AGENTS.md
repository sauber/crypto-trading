# Registry

Strategy registration and lookup via `RoleRegistry<T>`.

## RoleRegistry

```ts
class RoleRegistry<T> {
  register(name: string, factory: (...args: unknown[]) => T): void;
  get(name: string): { create(...args: unknown[]): T; name: string };
  list(): string[];
}
```

## Registration

`registration.ts` registers all strategies into named registries:

| Registry | Strategies |
|----------|------------|
| `discoveryRegistry` | `testdata`, `kucoin` |
| `portfolioRegistry` | `rank-trend` |
| `tradingRegistry` | `rsi-timed`, `macd-timed`, `bb-timed`, `ema-adx-timed` |
| `executionRegistry` | `simulate`, `kucoin` |
| `commRegistry` | `silent`, `verbose` |
| `reflectionRegistry` | `noop`, `analyst` |

## OCP

New strategies are added via `register()` — no existing code is changed.
