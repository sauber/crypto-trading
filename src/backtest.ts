import { loadMarket, backtest, display, evaluate } from "./backtest/mod.ts";
import { RsiTimed } from "./strategy/mod.ts";

const strategy = RsiTimed({ targetPositions: 5 });
const market = await loadMarket();
const results = await backtest(market, strategy, 1000, 0.001);
const score = evaluate(results);
console.log(display(strategy, results));
console.log(`\nScore: ${score.toFixed(2)}`);
