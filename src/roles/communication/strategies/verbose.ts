import type { CommunicationStrategy, CommunicationConfig } from "../types.ts";
import type { PipelineResult } from "../../../engine/types.ts";
import type { ReflectionInsight } from "../../reflection/types.ts";

export const config: CommunicationConfig = { silent: false };

export class VerboseComm implements CommunicationStrategy {
  readonly name = "verbose";
  readonly config: CommunicationConfig;

  constructor(config: CommunicationConfig) {
    this.config = config;
  }

  report(result: PipelineResult): void {
    console.log(`\n=== Cycle Report ===`);
    console.log(`Trades:     ${result.totalTrades}`);
    console.log(`Return:     ${result.totalReturn > 0 ? "+" : ""}${result.totalReturn.toFixed(2)}%`);
    console.log(`Sharpe:     ${result.sharpeRatio.toFixed(2)}`);
    console.log(`Max DD:     ${result.maxDrawdown.toFixed(2)}%`);
    console.log(`Win Rate:   ${result.winRate.toFixed(1)}%`);
    console.log(`PF:         ${result.profitFactor === Infinity ? "∞" : result.profitFactor.toFixed(2)}`);
    console.log(`Equity:     ${result.equityCurve.length} pts`);
    if (result.trades.length > 0) {
      const last = result.trades[result.trades.length - 1];
      console.log(`Last trade: ${last.sellSymbol}→${last.buySymbol} ${last.pnlPct > 0 ? "+" : ""}${last.pnlPct.toFixed(2)}%`);
    }
  }

  insight(insight: ReflectionInsight): void {
    console.log(`[${insight.type}] ${insight.message}`);
  }

  error(err: Error): void {
    console.error(`[ERROR] ${err.message}`);
  }
}
