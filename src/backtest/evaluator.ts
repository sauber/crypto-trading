import { Market } from "@sauber/backtest";
import type { Strategy } from "@sauber/backtest";
import { backtest } from "./mod.ts";
import { evaluate } from "./result.ts";
import { strategyRegistry } from "../registry/registration.ts";
import type { Timeline } from "../market/mod.ts";
import type { ParamSpec } from "../optimize/types.ts";

export function evaluateParams(
  params: number[],
  specs: ParamSpec[],
  marketObj: Market,
  tl: Timeline,
  strategyName: string,
  cash: number = 10000,
  fee: number = 0.001,
): number {
  const cfg: Record<string, number> = {};
  for (let i = 0; i < specs.length; i++) {
    cfg[specs[i].key] = params[i];
  }
  const strategy = strategyRegistry.get(strategyName).create(cfg);
  const results = backtest(marketObj, strategy as never, cash, fee, tl);
  return evaluate(results);
}

export function createParamEvaluator(
  specs: ParamSpec[],
  marketObj: Market,
  tl: Timeline,
  strategyName: string,
  cash: number = 10000,
  fee: number = 0.001,
): (params: number[], budget: number) => number {
  return (params: number[], _budget: number) =>
    evaluateParams(params, specs, marketObj, tl, strategyName, cash, fee);
}
