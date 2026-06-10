import { Market } from "@sauber/backtest";
import { BOHB } from "./bohb.ts";
import { paramSpecs } from "./param_specs.ts";
import { parseStrategyArg } from "./strategy_arg.ts";
import { createParamEvaluator } from "../backtest/evaluator.ts";
import { optimizeProgressCallback, displayBestConfig, generateConfigContent } from "./optimize_cli.ts";
import { market, timeline } from "../market/mod.ts";

const strategyName = parseStrategyArg();
const specs = paramSpecs[strategyName];
const instruments = await market();
const marketObj = new Market(instruments);
const tl = await timeline();
const evaluate = createParamEvaluator(specs, marketObj, tl, strategyName);
const config = { minBudget: 15, maxBudget: 60, eta: 2, brackets: 4, initialConfigs: 20 };
const result = new BOHB(specs, config, evaluate).run(optimizeProgressCallback);

displayBestConfig(result);

const content = generateConfigContent(strategyName, result.bestConfig);
await Deno.writeTextFile("src/config.ts", content);
console.log("\nConfig written to src/config.ts");
