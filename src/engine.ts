import { KucoinClient } from "./kucoin/client.ts";
import { RiskManager } from "./risk/manager.ts";
import { PortfolioProcessor } from "./roles/portfolio/strategy.ts";
import { createRoles, ROLE_CONFIG } from "./roles/registry.ts";
import type { RoleSet } from "./roles/registry.ts";

export interface EngineOptions {
  client: KucoinClient;
  portfolioStrategyName: string;
  dryRun: boolean;
}

export class TradingEngine {
  private client: KucoinClient;
  private roles: RoleSet;
  private portfolio: PortfolioProcessor;
  private risk: RiskManager;
  private opts: EngineOptions;
  private running = true;

  constructor(opts: EngineOptions) {
    this.client = opts.client;
    this.opts = opts;
    this.roles = createRoles(opts.client);
    this.portfolio = new PortfolioProcessor({
      client: opts.client,
      strategyName: opts.portfolioStrategyName,
      config: {
        maxPositions: ROLE_CONFIG.maxPositions,
        reserveSymbol: ROLE_CONFIG.reserveSymbol,
        stopLossPct: 0.05,
        takeProfitPct: 0.10,
      },
      interval: ROLE_CONFIG.candleInterval,
      candleRangeMs: ROLE_CONFIG.candleRangeMs,
      minCandles: ROLE_CONFIG.minCandles,
    });
    this.risk = new RiskManager(opts.client, {
      maxPositions: ROLE_CONFIG.maxPositions,
      reserveSymbol: ROLE_CONFIG.reserveSymbol,
      stopLossPct: 0.05,
      takeProfitPct: 0.10,
    });
  }

  async start(): Promise<void> {
    const roles = this.roles;
    const comm = roles.communication;

    if (this.opts.dryRun) comm.info("System", "=== DRY RUN MODE ===");
    comm.info("System", `Discovery: ${roles.discovery.name}`);
    comm.info("System", `Portfolio: ${this.opts.portfolioStrategyName}`);
    comm.info("System", `Trading: ${roles.trading.name}`);
    comm.info("System", `Execution: ${roles.execution.name}`);
    comm.info("System", `Communication: ${roles.communication.name}`);
    comm.info("System", `Max positions: ${ROLE_CONFIG.maxPositions}\n`);

    this.installShutdown();

    while (this.running) {
      const start = Date.now();
      try {
        await this.cycle();
      } catch (err) {
        comm.error("System", `Cycle fejl: ${err}`);
      }
      const elapsed = Date.now() - start;
      const wait = Math.max(60000, ROLE_CONFIG.cycleIntervalMs - elapsed);
      comm.info("System", `Venter ${(wait / 60000).toFixed(0)} min...\n`);
      while (this.running && Date.now() - start < ROLE_CONFIG.cycleIntervalMs) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    comm.info("System", "Agent stoppet.");
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
    const comm = this.roles.communication;
    const now = new Date().toISOString();

    // 1. Balances
    const balances = await this.client.getBalances();
    const usdc = balances.find((b) => b.currency === ROLE_CONFIG.reserveSymbol);
    if (!usdc) { comm.warn("Portfolio", "Ingen USDC balance"); return; }
    const availableUSDC = parseFloat(usdc.available);

    // 2. Discovery — find top coins
    const candidates = await this.roles.discovery.discover(this.client);
    if (candidates.length === 0) { comm.warn("Discovery", "Ingen coins fundet"); return; }
    comm.info("Discovery", `${candidates.length} coins: ${candidates.slice(0, 5).map((c) => c.symbol).join(", ")}...`);

    // 3. Portfolio — analyze and decide allocation
    const activePositions = this.risk.getPositions();
    const decision = await this.portfolio.decide(
      candidates.map((c) => c.symbol),
      activePositions,
    );
    comm.info("Portfolio", `${decision.wantToBuy.length} ønsket købt, ${decision.wantToSell.length} ønsket solgt`);

    // 4. Trading — plan swaps
    const prices = new Map<string, number>();
    for (const b of decision.wantToBuy) prices.set(b.symbol, b.price);
    for (const s of decision.wantToSell) {
      if (!prices.has(s.symbol)) {
        const ticker = await this.client.getTicker(s.symbol);
        prices.set(s.symbol, ticker.last);
      }
    }

    const swapPlan = await this.roles.trading.plan({
      wantToBuy: decision.wantToBuy,
      wantToSell: decision.wantToSell,
      activePositions,
      prices,
      availableCapital: availableUSDC,
      maxPositions: ROLE_CONFIG.maxPositions,
    });
    comm.info("Trading", `${swapPlan.swaps.length} swap(s) planlagt`);

    // 5. Execution — execute swaps
    const exec = this.roles.execution;
    for (const swap of swapPlan.swaps) {
      if (swap.sellSymbol && swap.sellSize) {
        const orderId = await exec.executeSell(swap.sellSymbol, swap.sellSize, swap.reason);
        this.risk.removePosition(swap.sellSymbol);
        if (!this.opts.dryRun) {
          comm.info("Execution", `Solgt ${swap.sellSymbol} order=${orderId}`);
        }
      }
      if (swap.buySymbol && swap.buyAmount > 0) {
        const size = swap.buyAmount.toFixed(2);
        const orderId = await exec.executeBuy(swap.buySymbol, size, swap.reason);
        const price = prices.get(swap.buySymbol) || 0;
        const coinAmount = price > 0 ? (swap.buyAmount / price).toFixed(6) : "0";
        this.risk.addPosition(swap.buySymbol, price, coinAmount, swap.buyAmount);
        if (!this.opts.dryRun) {
          comm.info("Execution", `Købt ${swap.buySymbol} order=${orderId}`);
        }
      }
    }

    // 6. Report positions
    comm.info("Portfolio", `${this.risk.getActiveCount()}/${ROLE_CONFIG.maxPositions - 1} positioner`);
    for (const p of this.risk.getPositions()) {
      const cur = prices.get(p.symbol) || 0;
      const pnl = cur > 0 ? ((cur - p.entryPrice) / p.entryPrice * 100).toFixed(2) : "?";
      comm.info("Portfolio", `  ${p.symbol.padEnd(12)} entry=${p.entryPrice.toFixed(4)} PnL=${pnl}%`);
    }
  }
}
