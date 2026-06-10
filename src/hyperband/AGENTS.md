# Hyperband

Standalone BOHB (Bayesian Optimization with HyperBand) module for multi-fidelity hyperparameter optimization.

Zero imports from the rest of the project — works with any evaluation function.

## Files

- `bohb.ts` — `BOHB` (sync) and `BOHBAsync` classes + shared utility functions
- `tpe.ts` — Tree-structured Parzen Estimator (Gaussian KDE + categorical density)
- `parameter.ts` — `DecimalParameter`, `EnumParameter`
- `types.ts` — `ParamSpec`, `BOHBConfig`, `BOHBResult`, `BOHBProgress`, `Trial`
- `mod.ts` — public re-exports

## Usage

```ts
const result = new BOHB(specs, config, evaluate).run(onProgress);
```
