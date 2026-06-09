import type { PortfolioStrategy } from "../roles/portfolio/types.ts";
import type { TradingStrategy } from "../roles/trading/types.ts";
import type { ExecutionStrategy } from "../roles/execution/types.ts";
import type { CommunicationStrategy } from "../roles/communication/types.ts";
import type { ReflectionStrategy } from "../roles/reflection/types.ts";
import type { DiscoveryStrategy } from "../roles/types.ts";
import { KucoinClient } from "../kucoin/client.ts";
import type { Kline } from "../kucoin/types.ts";
import type { PositionState, PortfolioDecision, PipelineResult, TradeRecord } from "./types.ts";
import type { CoinCandidate } from "../roles/types.ts";

export interface LiveEngineConfig {
  client: KucoinClient;
  discovery: DiscoveryStrategy;
  portfolio: PortfolioStrategy;
  trading: TradingStrategy;
  execution: ExecutionStrategy;
  communication: CommunicationStrategy;
  reflection: ReflectionStrategy;
  intervalMs: number;
  maxPositions: number;
  candleInterval: string;
  candleRangeMs: number;
  reserveSymbol: string;
}

export class TradingEngine {
  private config: LiveEngineConfig;
  private running = false;
  private cycleCount = 0;

  constructor(config: LiveEngineConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.running = true;
    const comm = this.config.communication;

    console.log(`=== Live Trading Engine ===`);
    console.log(`Discovery:    ${this.config.discovery.name}`);
    console.log(`Portfolio:    ${this.config.portfolio.name}`);
    console.log(`Trading:      ${this.config.trading.name}`);
    console.log(`Execution:    ${this.config.execution.name}`);
    console.log(`Communication: ${this.config.communication.name}`);
    console.log(`Reflection:   ${this.config.reflection.name}`);
    console.log(`Interval:     ${this.config.intervalMs / 60000} min\n`);

    this.installShutdown();

    while (this.running) {
      const start = Date.now();
      try {
        await this.cycle();
      } catch (err) {
        comm.error(err instanceof Error ? err : new Error(String(err)));
      }
      const elapsed = Date.now() - start;
      const wait = Math.max(60000, this.config.intervalMs - elapsed);
      console.log(`\nVenter ${(wait / 60000).toFixed(0)} min...\n`);
      while (this.running && Date.now() - start < this.config.intervalMs) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    console.log("Engine stopped.");
  }

  stop(): void {
    this.running = false;
  }

  private installShutdown(): void {
    const shutdown = () => this.stop();
    try { Deno.addSignalListener("SIGINT", shutdown); } catch {}
    try { Deno.addSignalListener("SIGTERM", shutdown); } catch {}
    try { Deno.addSignalListener("SIGBREAK", shutdown); } catch {}
  }

  private async cycle(): Promise<void> {
    this.cycleCount++;
    const { client, discovery, portfolio, trading, execution, communication, reflection, maxPositions, candleInterval, candleRangeMs, reserveSymbol } = this.config;

    console.log(`\n=== Cycle ${this.cycleCount} ===`);

    // 1. Discovery — find top coins
    const candidates = await discovery.discover(client);
    if (candidates.length === 0) {
      console.log("Ingen coins fundet.");
      return;
    }
    const symbols = candidates.map((c) => c.symbol);
    console.log(`Fundet ${symbols.length} coins: ${symbols.slice(0, 5).join(", ")}...`);

    // 2. Fetch klines and prices
    const now = Date.now();
    const klines = new Map<string, Kline[]>();
    const prices = new Map<string, number>();

    for (const sym of symbols) {
      try {
        const k = await client.getKlines(sym, candleInterval, now - candleRangeMs, now);
        klines.set(sym, k);
        if (k.length > 0) prices.set(sym, k[k.length - 1].close);
      } catch {
        // skip
      }
    }

    // 3. Fetch current balances/positions
    const balances = await client.getBalances();
    const activePositions: PositionState[] = [];
    for (const b of balances) {
      const av = parseFloat(b.available);
      if (av > 0 && b.currency !== reserveSymbol) {
        const symbol = `${b.currency}-USDT`;
        const price = prices.get(symbol) || 0;
        activePositions.push({
          symbol,
          entryPrice: price,
          size: av,
          enteredAt: now,
          entryValue: av * price,
        });
      }
    }
    console.log(`Positioner: ${activePositions.length}`);

    // 4. Portfolio analysis
    const decision = await portfolio.analyze({
      candidates,
      activePositions,
      prices,
      client,
      interval: candleInterval,
      candleRangeMs,
    });
    console.log(`Portfolio: ${decision.wantToBuy.length} ønsker at købe, ${decision.wantToSell.length} ønsker at sælge`);

    // 5. Trading plan
    const plan = await trading.plan({
      wantToBuy: decision.wantToBuy,
      wantToSell: decision.wantToSell,
      activePositions,
      prices,
      klines,
      maxPositions,
    });
    console.log(`Trading: ${plan.swaps.length} swaps planlagt`);

    // 6. Record preconditions
    reflection.recordPrecondition({
      cycle: this.cycleCount,
      portfolioDecision: decision,
      swapPlan: plan,
    });

    // 7. Execute swaps
    const execResult = await execution.executeSwaps(plan.swaps, new Map(), 0);

    // 8. Record outcomes
    reflection.recordOutcome({
      cycle: this.cycleCount,
      result: execResult,
    });

    // 9. Reflect
    const insights = reflection.reflect();
    for (const insight of insights) {
      console.log(`[${insight.type}] ${insight.message}`);
    }

    // 10. Build pipeline result for reporting
    const pipeResult: PipelineResult = {
      equityCurve: [],
      trades: execResult.trades,
      totalReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: execResult.trades.length,
    };

    // 11. Report
    communication.report(pipeResult);
  }
}
