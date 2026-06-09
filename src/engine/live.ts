import type { PortfolioStrategy } from "../portfolio/mod.ts";
import type { TradingStrategy } from "../trading/mod.ts";
import type { ExecutionStrategy } from "../execution/mod.ts";
import type { Logger } from "../communication/mod.ts";
import type { ReflectionStrategy } from "../reflection/mod.ts";
import type { DiscoveryStrategy } from "../discovery/mod.ts";
import type { PositionLoader } from "../position/mod.ts";
import { KucoinClient } from "../kucoin/mod.ts";
import type { Kline } from "../kucoin/mod.ts";
import type { PositionState, PipelineResult, TradeRecord } from "./types.ts";

export interface LiveEngineConfig {
  client: KucoinClient;
  discovery: DiscoveryStrategy;
  portfolio: PortfolioStrategy;
  trading: TradingStrategy;
  execution: ExecutionStrategy;
  logger: Logger;
  reflection: ReflectionStrategy;
  positionLoader: PositionLoader;
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
    const { logger, discovery, portfolio, trading, execution, reflection, client, targetPositions, candleInterval, candleRangeMs, reserveSymbol } = this.config;

    logger({ action: "startup", message: "=== Live Trading Engine ===" });
    logger({ action: "startup", message: `Discovery:    ${discovery.name}` });
    logger({ action: "startup", message: `Portfolio:    ${portfolio.name}` });
    logger({ action: "startup", message: `Trading:      ${trading.name}` });
    logger({ action: "startup", message: `Execution:    ${execution.name}` });
    logger({ action: "startup", message: `Reflection:   ${reflection.name}` });
    logger({ action: "startup", message: `Interval:     ${this.config.intervalMs / 60000} min` });

    await this.loadInitialPositions();

    this.installShutdown();

    while (this.running) {
      const start = Date.now();
      try {
        await this.cycle();
      } catch (err) {
        logger({
          action: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      const elapsed = Date.now() - start;
      const wait = Math.max(60000, this.config.intervalMs - elapsed);
      logger({ action: "wait", message: `Waiting ${(wait / 60000).toFixed(0)} min...` });
      while (this.running && Date.now() - start < this.config.intervalMs) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    logger({ action: "shutdown", message: "Engine stopped." });
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
    const loader = this.config.positionLoader;
    const logger = this.config.logger;

    logger({ action: "init", message: "=== Initializing portfolio ===" });
    this.initialPositions = await loader();

    if (this.initialPositions.length === 0) {
      logger({ action: "init", message: "No existing positions found." });
      return;
    }

    for (const p of this.initialPositions) {
      const currency = p.symbol.replace("-USDT", "");
      logger({
        action: "init",
        symbol: p.symbol,
        message: `${currency.padEnd(10)} ${p.size.toFixed(4).padStart(12)} @ $${p.entryPrice.toFixed(4).padStart(10)} = $${p.entryValue.toFixed(2)}`,
      });
    }

    logger({
      action: "init",
      message: `Total ${this.initialPositions.length} positions, $ ${this.initialPositions.reduce((s, p) => s + p.entryValue, 0).toFixed(2)}`,
    });
  }

  private async cycle(): Promise<void> {
    this.cycleCount++;
    const { client, discovery, portfolio, trading, execution, logger, reflection, targetPositions, candleInterval, candleRangeMs, reserveSymbol } = this.config;

    logger({ cycle: this.cycleCount, action: "cycle", message: `=== Cycle ${this.cycleCount} ===` });

    // 1. Discovery — find top coins
    const candidates = await discovery();
    if (candidates.length === 0) {
      logger({ cycle: this.cycleCount, action: "discovery", message: "No coins found." });
      return;
    }
    const symbols = candidates.map((c) => c.symbol);
    logger({
      cycle: this.cycleCount,
      role: "DI",
      action: "discovery",
      message: `Found ${symbols.length} coins: ${symbols.slice(0, 5).join(", ")}...`,
    });

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

    logger({ cycle: this.cycleCount, role: "PO", action: "portfolio", message: "── Portfolio ──" });
    if (activePositions.length === 0) {
      logger({ cycle: this.cycleCount, role: "PO", action: "portfolio", message: "(no positions)" });
    } else {
      let totalValue = 0;
      for (const p of activePositions) {
        const price = prices.get(p.symbol) ?? 0;
        const value = p.size * price;
        totalValue += value;
        logger({
          cycle: this.cycleCount,
          role: "PO",
          action: "portfolio",
          symbol: p.symbol,
          message: `${p.symbol.padEnd(12)} ${p.size.toFixed(4).padStart(10)} @ $${price.toFixed(4).padStart(10)} = $${value.toFixed(2)}`,
        });
      }
      logger({
        cycle: this.cycleCount,
        role: "PO",
        action: "portfolio",
        message: `Total: $${totalValue.toFixed(2)}`,
      });
    }

    // 4. Portfolio analysis
    const decision = portfolio(activePositions, candidates);

    logger({ cycle: this.cycleCount, role: "PO", action: "decision", message: "── Portfolio decision ──" });
    logger({
      cycle: this.cycleCount,
      role: "PO",
      action: "decision",
      message: `Want to buy (${decision.wantToBuy.length}):`,
    });
    for (const b of decision.wantToBuy) {
      logger({
        cycle: this.cycleCount,
        role: "PO",
        action: "decision",
        side: "buy",
        symbol: b.symbol,
        reason: b.reason,
        message: `+ ${b.symbol.padEnd(12)} confidence=${b.confidence}  ${b.reason}`,
      });
    }
    if (decision.wantToBuy.length === 0) {
      logger({ cycle: this.cycleCount, role: "PO", action: "decision", message: "  (none)" });
    }
    logger({
      cycle: this.cycleCount,
      role: "PO",
      action: "decision",
      message: `Want to sell (${decision.wantToSell.length}):`,
    });
    for (const s of decision.wantToSell) {
      logger({
        cycle: this.cycleCount,
        role: "PO",
        action: "decision",
        side: "sell",
        symbol: s.symbol,
        reason: s.reason,
        message: `- ${s.symbol.padEnd(12)} ${s.reason}`,
      });
    }
    if (decision.wantToSell.length === 0) {
      logger({ cycle: this.cycleCount, role: "PO", action: "decision", message: "  (none)" });
    }

    // 5. Trading plan
    const plan = trading({
      wantToBuy: decision.wantToBuy,
      wantToSell: decision.wantToSell,
      activePositions,
      prices,
      klines,
      targetPositions,
    });

    for (const swap of plan.swaps) {
      const parts: string[] = [];
      if (swap.sellSymbol) parts.push(`Sell ${swap.sellSymbol}`);
      if (swap.buySymbol) parts.push(`Buy ${swap.buySymbol}`);
      logger({
        cycle: this.cycleCount,
        role: "TR",
        action: "signal",
        reason: swap.reason,
        message: parts.join(" → "),
      });
    }

    logger({ cycle: this.cycleCount, role: "EX", action: "execution", message: "── Execution ──" });
    if (plan.swaps.length === 0) {
      logger({ cycle: this.cycleCount, role: "EX", action: "execution", message: "(no swaps this cycle)" });
    }
    for (const swap of plan.swaps) {
      if (swap.sellSymbol) {
        const price = prices.get(swap.sellSymbol) ?? 0;
        const pos = activePositions.find((p) => p.symbol === swap.sellSymbol);
        const size = pos?.size ?? 0;
        const gross = size * price;
        const net = gross * (1 - 0.001);
        logger({
          cycle: this.cycleCount,
          role: "EX",
          action: "sell",
          side: "sell",
          symbol: swap.sellSymbol,
          reason: swap.reason,
          message: `Sell ${swap.sellSymbol.padEnd(12)} ${size.toFixed(4)} coins @ $${price.toFixed(4)} = $${gross.toFixed(2)} → $${net.toFixed(2)} received`,
        });
      }
      if (swap.buySymbol) {
        const price = prices.get(swap.buySymbol) ?? 0;
        const slotsLeft = targetPositions - activePositions.length;
        const spendEstimate = plan.swaps.length > 1 ? 100 : 50;
        logger({
          cycle: this.cycleCount,
          role: "EX",
          action: "buy",
          side: "buy",
          symbol: swap.buySymbol,
          reason: swap.reason,
          message: `Buy  ${swap.buySymbol.padEnd(12)} ~$${spendEstimate.toFixed(2)} @ $${price.toFixed(4)} = ~${(spendEstimate / price).toFixed(4)} coins`,
        });
      }
    }

    // 6. Record preconditions
    reflection.recordPrecondition({
      cycle: this.cycleCount,
      portfolioDecision: decision,
      swapPlan: plan,
    });

    // 7. Execute swaps
    const execResult = await execution(plan.swaps, new Map(), 0);

    // 8. Record outcomes
    reflection.recordOutcome({
      cycle: this.cycleCount,
      result: execResult,
    });

    // 9. Reflect
    const insights = reflection.reflect();
    for (const insight of insights) {
      logger({
        cycle: this.cycleCount,
        role: "AN",
        action: "insight",
        message: `[${insight.type}] ${insight.message}`,
      });
    }

    // 10. Report via logger
    if (execResult.trades.length > 0) {
      logger({
        cycle: this.cycleCount,
        action: "report",
        message: `Trades this cycle: ${execResult.trades.length}`,
      });
    }
  }
}
