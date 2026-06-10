# Optimize

Project-aware parameter optimizer task. Wraps the generic `BOHB` from `src/hyperband/` with project-specific logic: backtest evaluator, strategy selection, param specs, and config file generation.

## Files

- `optimize_parameters.ts` — CLI entry point for `deno task optimize`
- `optimize_cli.ts` — progress display, best config output, config file generation
- `param_specs.ts` — per-strategy parameter definitions (`ParamSpec[]`)
- `strategy_arg.ts` — `--strategy=` CLI argument parsing + validation

## Usage

```sh
deno task optimize --strategy=rsi-timed
```
