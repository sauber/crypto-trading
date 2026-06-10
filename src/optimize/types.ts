/** Floating-point parameter with configurable decimal precision */
export interface DecimalParamSpec {
  key: string;
  type: "decimal";
  lo: number;
  hi: number;
  /** Number of decimal places (0 = integer) */
  precision: number;
}

/** Categorical parameter selecting one value from a fixed set */
export interface EnumParamSpec {
  key: string;
  type: "enum";
  values: string[];
}

/** Discriminated union of all supported parameter types */
export type ParamSpec = DecimalParamSpec | EnumParamSpec;

/** Configuration for the BOHB optimization algorithm */
export interface BOHBConfig {
  /** Minimum budget (first fidelity level) */
  minBudget: number;
  /** Maximum budget (last fidelity level) */
  maxBudget: number;
  /** Down-sampling rate (typically 2 or 3) */
  eta: number;
  /** Number of Successive Halving brackets */
  brackets: number;
  /** Number of configurations sampled per bracket */
  initialConfigs: number;
  /** Candidates evaluated by TPE per proposal (default 1000) */
  tpeCandidates?: number;
}

/** A single evaluated point in the search space */
export interface Trial {
  /** Parameter values at this trial */
  params: number[];
  /** Score returned by the evaluate function */
  score: number;
  /** Budget level at which this trial was evaluated */
  budget: number;
}

/** Final result returned by BOHB.run() */
export interface BOHBResult {
  /** Best parameter vector found */
  bestParams: number[];
  /** Best score found */
  bestScore: number;
  /** Best parameters mapped to config keys */
  bestConfig: Record<string, number | string>;
  /** All trials across all brackets and levels */
  trials: Trial[];
  /** Total number of evaluations performed */
  totalEvals: number;
  /** Original parameter specifications */
  specs: ParamSpec[];
}

/** Progress snapshot emitted by the onProgress callback during BOHB.run() */
export interface BOHBProgress {
  bracket: number;
  totalBrackets: number;
  level: number;
  levels: number[];
  candidates: number;
  nKeep: number;
  budget: number;
  bestScore: number;
  totalEvals: number;
}
