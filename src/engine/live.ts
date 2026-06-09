import type { PortfolioStrategy } from "../roles/portfolio/types.ts";
import type { TradingStrategy } from "../roles/trading/types.ts";
import type { ExecutionStrategy } from "../roles/execution/types.ts";
import type { CommunicationStrategy } from "../roles/communication/types.ts";
import type { ReflectionStrategy } from "../roles/reflection/types.ts";
import type { DiscoveryStrategy } from "../discovery/types.ts";
import { KucoinClient } from "../kucoin/client.ts";
import type { Kline } from "../kucoin/types.ts";
import type { PositionState, PortfolioDecision, PipelineResult, TradeRecord } from "./types.ts";

export interface LiveEngineConfig {
  client: KucoinClient;
  discovery: DiscoveryStrategy;
  portfolio: PortfolioStrategy;
  trading: TradingStrategy;
  execution: ExecutionStrategy;
  communication: CommunicationStrategy;
  reflection: ReflectionStrategy;
  intervalMs: number;
  targetPositions: number;
  candleInterval: string;
  candleRangeMs: number;
  reserveSymbol: string;
}

export class TradingEngine {
  private config: LiveEngineConfig;
  private running = false;
  private cycleCount = 0;
  private initialPositions: PositionState[] = [];

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

    await this.loadInitialPositions();

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
      console.log(`\nWaiting ${(wait / 60000).toFixed(0)} min...\n`);
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

  private async loadInitialPositions(): Promise<void> {
    const { client, reserveSymbol, candleInterval, candleRangeMs } = this.config;

    console.log("=== Initializing portfolio ===");
    const balances = await client.getBalances();
    const activeBalances = balances.filter(
      (b) => parseFloat(b.available) > 0 && b.currency !== reserveSymbol,
    );

    if (activeBalances.length === 0) {
      console.log("No existing positions found.\n");
      return;
    }

    const now = Date.now();

    for (const b of activeBalances) {
      const symbol = `${b.currency}-USDT`;
      try {
        const ticker = await client.getTicker(symbol);
        const price = ticker.last;
        const size = parseFloat(b.available);
        const value = size * price;
        this.initialPositions.push({
          symbol,
          entryPrice: price,
          size,
          enteredAt: now - candleRangeMs,
          entryValue: value,
        });
        console.log(
          `  ${b.currency.padEnd(10)} ${size.toFixed(4).padStart(12)} @ $${price.toFixed(4).padStart(10)} = $${value.toFixed(2)}`,
        );
      } catch {
        try {
          const klines = await client.getKlines(symbol, candleInterval, now - candleRangeMs, now);
          if (klines.length > 0) {
            const price = klines[klines.length - 1].close;
            const size = parseFloat(b.available);
            const value = size * price;
            this.initialPositions.push({
              symbol,
              entryPrice: price,
              size,
              enteredAt: now - candleRangeMs,
              entryValue: value,
            });
            console.log(
              `  ${b.currency.padEnd(10)} ${size.toFixed(4).padStart(12)} @ $${price.toFixed(4).padStart(10)} = $${value.toFixed(2)}`,
            );
          }
        } catch {
          const size = parseFloat(b.available);
          console.log(`  ${b.currency.padEnd(10)} ${size.toFixed(4).padStart(12)} (could not fetch price)`);
        }
      }
    }

    console.log(`\nTotal ${this.initialPositions.length} positions, ` +
      `$ ${this.initialPositions.reduce((s, p) => s + p.entryValue, 0).toFixed(2)}\n`);
  }

  private async cycle(): Promise<void> {
    this.cycleCount++;
    const { client, discovery, portfolio, trading, execution, communication, reflection, targetPositions, candleInterval, candleRangeMs, reserveSymbol } = this.config;

    console.log(`\n=== Cycle ${this.cycleCount} ===`);

    // 1. Discovery — find top coins
    const candidates = await discovery.discover();
    if (candidates.length === 0) {
      console.log("No coins found.");
      return;
    }
    const symbols = candidates.map((c) => c.symbol);
    console.log(`Found ${symbols.length} coins: ${symbols.slice(0, 5).join(", ")}...`);

    // 2. Fetch klines and prices
    const now = Date.now();
    const klines = new Map<string, Kline[]>();
    const prices = new Map<string, number>();

    // Include all candidate symbols + any held symbols not in candidates
    const heldSymbols = this.initialPositions.map((p) => p.symbol);
    const allSymbols = [...new Set([...symbols, ...heldSymbols])];

    for (const sym of allSymbols) {
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
        const price = prices.get(symbol);
        if (price && price > 0) {
          activePositions.push({
            symbol,
            entryPrice: price,
            size: av,
            enteredAt: now,
            entryValue: av * price,
          });
        }
      }
    }

    console.log(`\n  ── Portfolio ──`);
    if (activePositions.length === 0) {
      console.log(`     (no positions)`);
    } else {
      let totalValue = 0;
      for (const p of activePositions) {
        const price = prices.get(p.symbol) ?? 0;
        const value = p.size * price;
        totalValue += value;
        console.log(`     ${p.symbol.padEnd(12)} ${p.size.toFixed(4).padStart(10)} @ $${price.toFixed(4).padStart(10)} = $${value.toFixed(2)}`);
      }
      console.log(`     ─────────────────────────────────────────────`);
      console.log(`     Total: $${totalValue.toFixed(2)}`);
    }

    // 4. Portfolio analysis
    const decision = await portfolio.analyze({
      candidates,
      activePositions,
      prices,
      client,
      interval: candleInterval,
      candleRangeMs,
    });

    console.log(`\n  ── Portfolio decision ──`);
    console.log(`     Want to buy (${decision.wantToBuy.length}):`);
    for (const b of decision.wantToBuy) {
      console.log(`       + ${b.symbol.padEnd(12)} confidence=${b.confidence}  ${b.reason}`);
    }
    if (decision.wantToBuy.length === 0) console.log(`       (none)`);
    console.log(`     Want to sell (${decision.wantToSell.length}):`);
    for (const s of decision.wantToSell) {
      console.log(`       - ${s.symbol.padEnd(12)} ${s.reason}`);
    }
    if (decision.wantToSell.length === 0) console.log(`       (none)`);

    // 5. Trading plan
    const plan = await trading.plan({
      wantToBuy: decision.wantToBuy,
      wantToSell: decision.wantToSell,
      activePositions,
      prices,
      klines,
      targetPositions,
    });

    console.log(`\n  ── Execution ──`);
    if (plan.swaps.length === 0) {
      console.log(`     (no swaps this cycle)`);
    }
    for (const swap of plan.swaps) {
      if (swap.sellSymbol) {
        const price = prices.get(swap.sellSymbol) ?? 0;
        const pos = activePositions.find((p) => p.symbol === swap.sellSymbol);
        const size = pos?.size ?? 0;
        const gross = size * price;
        const net = gross * (1 - 0.001);
        console.log(`     Sell ${swap.sellSymbol.padEnd(12)} ${size.toFixed(4)} coins @ $${price.toFixed(4)} = $${gross.toFixed(2)} → $${net.toFixed(2)} received`);
        console.log(`       Reason: ${swap.reason}`);
      }
      if (swap.buySymbol) {
        const price = prices.get(swap.buySymbol) ?? 0;
        const slotsLeft = targetPositions - activePositions.length;
        const spendEstimate = plan.swaps.length > 1 ? 100 : 50;
        console.log(`     Buy  ${swap.buySymbol.padEnd(12)} ~$${spendEstimate.toFixed(2)} @ $${price.toFixed(4)} = ~${(spendEstimate / price).toFixed(4)} coins`);
        console.log(`       Reason: ${swap.reason}`);
      }
    }

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
      console.log(`  [${insight.type}] ${insight.message}`);
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
