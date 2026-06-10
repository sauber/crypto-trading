import { Market } from "@sauber/backtest";
import { loadMarket, backtest, display, evaluate } from "./backtest/mod.ts";
import { timeline } from "./market/mod.ts";
import { RsiTimed } from "./strategy/mod.ts";

const strategy = RsiTimed({ targetPositions: 5 });
const marketObj = await loadMarket();
const tl = await timeline();
const results = backtest(marketObj, strategy, 1000, 0.001, tl);
const score = evaluate(results);
console.log(display(strategy, results));
console.log(`\nScore: ${score.toFixed(2)}`);
