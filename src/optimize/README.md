# BOHB Optimizer

Standalone BOHB (Bayesian Optimization with HyperBand) module for multi-fidelity
hyperparameter optimization. Zero imports from the rest of the project — works
with any evaluation function.

## Algorithm

BOHB combines two techniques:

- **TPE (Tree-structured Parzen Estimator)** — models the density of good vs.
  all configurations using Gaussian KDE for decimal parameters and
  Laplace-smoothed categorical counts for enum parameters. New candidates are
  proposed by maximizing expected improvement.
- **Successive Halving** — evaluates candidates at increasing budget levels and
  prunes the bottom `1/eta` performers at each level, focusing compute on
  promising configurations.

## Usage (synchronous)

```ts
import { BOHB } from "./mod.ts";
import type { ParamSpec, BOHBResult, BOHBProgress } from "./types.ts";

// 1. Define parameters
const specs: ParamSpec[] = [
  { key: "learningRate", type: "decimal", lo: 0.001, hi: 0.1, precision: 3 },
  { key: "layers",       type: "decimal", lo: 1,     hi: 5,  precision: 0 },
  { key: "activation",   type: "enum",    values: ["relu", "tanh", "sigmoid"] },
];

// 2. Define synchronous evaluation function (higher score = better)
function evaluate(params: number[], budget: number): number {
  // params[0] = learning rate, params[1] = layers, params[2] = activation index
  // budget controls how much data / how many epochs to use
  // Return a score (higher is better)
  return computeScore(params, budget);
}

// 3. Configure & run (no await needed)
const result = new BOHB(specs, {
  minBudget: 10,
  maxBudget: 100,
  eta: 2,
  brackets: 4,
  initialConfigs: 20,
}, evaluate).run();

console.log(result.bestConfig);
// { learningRate: 0.01, layers: 3, activation: "relu" }
```

## Usage (asynchronous)

Use `BOHBAsync` when evaluation involves I/O such as loading data or calling an API.

```ts
import { BOHBAsync } from "./mod.ts";
import type { ParamSpec, BOHBResult } from "./types.ts";

const specs: ParamSpec[] = [
  { key: "learningRate", type: "decimal", lo: 0.001, hi: 0.1, precision: 3 },
  { key: "layers",       type: "decimal", lo: 1,     hi: 5,  precision: 0 },
  { key: "activation",   type: "enum",    values: ["relu", "tanh", "sigmoid"] },
];

async function evaluate(params: number[], budget: number): Promise<number> {
  return computeScore(params, budget);
}

const result = await new BOHBAsync(specs, {
  minBudget: 10,
  maxBudget: 100,
  eta: 2,
  brackets: 4,
  initialConfigs: 20,
}, evaluate).run();

console.log(result.bestConfig);
```

## API

### `BOHB`

| Method                                 | Returns           | Description                                                 |
| -------------------------------------- | ----------------- | ----------------------------------------------------------- |
| `constructor(specs, config, evaluate)` | —                 | Parameters, BOHB hyper-params, synchronous evaluation fn    |
| `run(onProgress?)`                     | `BOHBResult`      | Runs the full BOHB loop. No Promise — returns synchronously. |

### `BOHBAsync`

| Method                                 | Returns               | Description                                                 |
| -------------------------------------- | --------------------- | ----------------------------------------------------------- |
| `constructor(specs, config, evaluate)` | —                     | Parameters, BOHB hyper-params, async evaluation fn          |
| `run(onProgress?)`                     | `Promise<BOHBResult>` | Runs the full BOHB loop. `await` to get the result.          |

### `Parameter` classes

| Class                  | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `DecimalParameter`     | Numeric value with fixed decimal precision (`precision=0` = integer) |
| `EnumParameter`        | Categorical value selected from a fixed string list                  |
| `Parameter.fromSpec()` | Factory to construct a Parameter from a ParamSpec                    |

### Types

| Type           | Description                                                               |
| -------------- | ------------------------------------------------------------------------- |
| `EvaluateFn`   | `(params: number[], budget: number) => number` — sync evaluation          |
| `AsyncEvaluateFn` | `(params: number[], budget: number) => Promise<number>` — async evaluation |
| `ProgressFn`   | `(progress: BOHBProgress) => void` — sync progress callback               |
| `AsyncProgressFn` | `(progress: BOHBProgress) => void \| Promise<void>` — async progress callback |
| `ParamSpec`    | `DecimalParamSpec \| EnumParamSpec`                                       |
| `BOHBConfig`   | `{ minBudget, maxBudget, eta, brackets, initialConfigs, tpeCandidates? }` |
| `BOHBResult`   | `{ bestParams, bestScore, bestConfig, trials, totalEvals, specs }`        |
| `BOHBProgress` | Progress snapshot: bracket, level, candidates, budget, bestScore, ...     |
| `Trial`        | `{ params, score, budget }` — single evaluation result                    |

## Files

```
src/optimize/
├── mod.ts            # Public re-exports
├── types.ts          # Shared type definitions
├── parameter.ts      # Parameter, DecimalParameter, EnumParameter
├── tpe.ts            # TPE proposal (Gaussian KDE + categorical density)
├── bohb.ts           # BOHB (sync) and BOHBAsync classes
├── parameter.test.ts # Parameter unit tests
├── tpe.test.ts       # TPE proposal tests
├── bohb.test.ts      # BOHB and BOHBAsync integration tests
├── example.ts        # Synchronous usage example
├── example-async.ts  # Asynchronous usage example
└── README.md         # This file
```
