import { Portfolio, OpenPosition, type Strategy, type BuyOrder, type SellOrder, type Instrument } from "@sauber/backtest";
import { KucoinClient } from "../kucoin/mod.ts";
import { RankedInstrument } from "../market/ranked-instrument.ts";
import type { Kline } from "../kucoin/mod.ts";
import { intervalToMs } from "./interval.ts";

type Order = BuyOrder | SellOrder;

export interface LiveEngineConfig {
  client: KucoinClient;
  strategy: Strategy;
  intervalMs: number;
  targetPositions: number;
  candleInterval: string;
  candleLookback: number;
  reserveSymbol: string;
}

export class TradingEngine {
  private config: LiveEngineConfig;
  private running = false;
  private cycleCount = 0;
  private lastRanks = new Map<string, number>();

  constructor(config: LiveEngineConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.running = true;
    const { strategy, client, intervalMs } = this.config;

    console.log("=== Live Trading Engine ===");
    console.log(`Strategy:    ${strategy.name ?? "unknown"}`);
    console.log(`Interval:    ${intervalMs / 60000} min`);

    this.installShutdown();

    while (this.running) {
      const start = Date.now();
      try {
        await this.cycle();
      } catch (err) {
        console.error(
          "Cycle error:",
          err instanceof Error ? err.message : String(err),
        );
      }
      const elapsed = Date.now() - start;
      const wait = Math.max(60000, intervalMs - elapsed);
      console.log(`Waiting ${(wait / 60000).toFixed(0)} min...`);
      while (this.running && Date.now() - start < intervalMs) {
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
    const { client, strategy, candleInterval, candleLookback, reserveSymbol } =
      this.config;
    const candleRangeMs = candleLookback * intervalToMs(candleInterval);

    console.log(`\n=== Cycle ${this.cycleCount} ===`);

    // 1. Fetch top coins via KuCoin discovery
    const topSymbols = await this.discoverTopCoins(client);
    if (topSymbols.length === 0) {
      console.log("No coins discovered.");
      return;
    }
    console.log(
      `Discovered ${topSymbols.length} coins: ${topSymbols.slice(0, 5).join(", ")}...`,
    );

    // 2. Fetch klines for all tracked symbols
    const now = Date.now();
    const klines = new Map<string, Kline[]>();
    const prices = new Map<string, number>();

    for (const sym of topSymbols) {
      try {
        const k = await client.getKlines(
          sym,
          candleInterval,
          now - candleRangeMs,
          now,
        );
        klines.set(sym, k);
        if (k.length > 0) prices.set(sym, k[k.length - 1].close);
      } catch {
        // skip
      }
    }

    if (klines.size === 0) {
      console.log("No klines data fetched.");
      return;
    }

    // 3. Build instruments with rank data
    const instruments = this.buildLiveInstruments(klines, topSymbols);

    // 4. Fetch balances and build portfolio
    const balances = await client.getBalances();
    let cash = 0;
    const livePositions: OpenPosition[] = [];

    for (const b of balances) {
      const av = parseFloat(b.available);
      if (av <= 0) continue;
      if (b.currency === reserveSymbol) {
        cash = av;
        continue;
      }
      const symbol = `${b.currency}-USDT`;
      const price = prices.get(symbol);
      const inst = instruments.find((i) => i.symbol === symbol);
      if (price && price > 0 && inst) {
        livePositions.push(new OpenPosition(inst, 0, av * price, av));
      }
    }

    console.log(`Cash: $${cash.toFixed(2)}`);
    console.log(`Positions: ${livePositions.length}`);

    const portfolio = new Portfolio(livePositions);

    // 5. Call strategy
    const orders = strategy(0, cash, instruments, portfolio) as Order[];

    if (orders.length === 0) {
      console.log("No orders this cycle.");
      return;
    }

    // 6. Execute orders on KuCoin
    for (const order of orders) {
      if ("position" in order) {
        const sellOrder = order as SellOrder;
        const qty = sellOrder.position.quantity;
        const sym = sellOrder.position.instrument.symbol;
        console.log(`Sell ${qty} ${sym}`);
        try {
          await client.placeOrder({
            symbol: sym,
            side: "sell",
            type: "market",
            size: qty.toString(),
          });
        } catch (err) {
          console.error(
            `Sell failed for ${sym}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      } else {
        const buyOrder = order as BuyOrder;
        const sym = buyOrder.instrument.symbol;
        console.log(`Buy $${buyOrder.amount} ${sym}`);
        try {
          await client.placeOrder({
            symbol: sym,
            side: "buy",
            type: "market",
            size: buyOrder.amount.toString(),
          });
        } catch (err) {
          console.error(
            `Buy failed for ${sym}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }
  }

  private async discoverTopCoins(
    client: KucoinClient,
  ): Promise<string[]> {
    try {
      const pool = await client.getTopVolumeSymbols(20);
      return pool.map((r) => r.symbol);
    } catch {
      return [];
    }
  }

  private buildLiveInstruments(
    klines: Map<string, Kline[]>,
    symbols: string[],
  ): Instrument[] {
    // Compute ranks from latest bar
    const latestBar = new Map<string, { volume: number; close: number }>();
    for (const sym of symbols) {
      const bars = klines.get(sym);
      if (!bars || bars.length === 0) continue;
      const last = bars[bars.length - 1];
      latestBar.set(sym, { volume: last.volume, close: last.close });
    }

    const scored = [...latestBar.entries()]
      .map(([sym, d]) => ({ sym, score: d.volume * d.close }))
      .sort((a, b) => b.score - a.score);

    const currentRanks = new Map<string, number>();
    for (let i = 0; i < scored.length; i++) {
      currentRanks.set(scored[i].sym, i + 1);
    }

    // Compute rank changes from previous cycle
    const rankChanges = new Map<string, number>();
    for (const [sym, rank] of currentRanks) {
      const prevRank = this.lastRanks.get(sym) ?? rank;
      rankChanges.set(sym, prevRank - rank);
    }
    this.lastRanks = currentRanks;

    const instruments: Instrument[] = [];
    for (const [sym, bars] of klines) {
      const closePrices = new Float32Array(bars.map((b) => b.close));
      const volumes = new Float32Array(bars.map((b) => b.volume));
      const rank = currentRanks.get(sym) ?? 1;
      const rankChange = rankChanges.get(sym) ?? 0;

      const rankSeries = new Float32Array(bars.length);
      rankSeries.fill(rank);

      const rankChangeSeries = new Float32Array(bars.length);
      rankChangeSeries.fill(rankChange);

      instruments.push(
        new RankedInstrument(
          closePrices,
          0,
          sym,
          rankSeries,
          rankChangeSeries,
          bars,
          volumes,
        ),
      );
    }

    return instruments;
  }
}
