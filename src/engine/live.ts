import { Portfolio, OpenPosition, type Strategy, type BuyOrder, type SellOrder, type Instrument } from "@sauber/backtest";
import { KucoinClient } from "../kucoin/mod.ts";
import { KucoinDiscovery } from "../discovery/mod.ts";
import { RankedInstrument } from "../market/ranked-instrument.ts";
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

    // 1. Discover top coins and build instruments via KuCoin API
    const discovery = KucoinDiscovery({
      poolSize: 20,
      interval: candleInterval,
      lookback: candleLookback,
    }, client);
    const instruments = await discovery();

    if (instruments.length === 0) {
      console.log("No coins discovered.");
      return;
    }
    console.log(
      `Discovered ${instruments.length} coins: ${instruments.slice(0, 5).map((i) => i.symbol).join(", ")}...`,
    );

    // 2. Fetch balances and build portfolio
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
      const inst = instruments.find((i) => i.symbol === symbol);
      if (inst && inst.klines.length > 0) {
        const price = inst.klines[inst.klines.length - 1].close;
        if (price > 0) {
          livePositions.push(new OpenPosition(inst, 0, av * price, av));
        }
      }
    }

    console.log(`Cash: $${cash.toFixed(2)}`);
    console.log(`Positions: ${livePositions.length}`);

    const portfolio = new Portfolio(livePositions);

    // 3. Call strategy
    const orders = strategy(0, cash, instruments, portfolio) as Order[];

    if (orders.length === 0) {
      console.log("No orders this cycle.");
      return;
    }

    // 4. Execute orders on KuCoin
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
}
