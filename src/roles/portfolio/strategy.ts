import type { PortfolioStrategy, PortfolioDecision, PortfolioConfig } from "../types.ts";
import type { PositionState } from "../../risk/types.ts";
import { KucoinClient } from "../../kucoin/client.ts";
import type { Ticker } from "../../kucoin/types.ts";
import type { Strategy } from "../../strategies/types.ts";
import { getStrategyEntry } from "../../strategies/registry.ts";

async function fetchPrices(client: KucoinClient, symbols: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  const results = await Promise.allSettled(symbols.map((s) => client.getTicker(s)));
  for (let i = 0; i < symbols.length; i++) {
    if (results[i].status === "fulfilled") prices.set(symbols[i], (results[i] as { value: Ticker }).value.last);
  }
  return prices;
}

async function fetchKlinesAndAnalyze(
  client: KucoinClient,
  strategy: Strategy,
  symbols: string[],
  interval: string,
  range: number,
  minCandles: number,
): Promise<Map<string, { signal: string; confidence: number; reason: string }>> {
  const results = new Map<string, { signal: string; confidence: number; reason: string }>();
  const now = Date.now();
  const settled = await Promise.allSettled(
    symbols.map((s) =>
      client.getKlines(s, interval, now - range, now).then((klines) => {
        if (klines.length < minCandles) return null;
        const r = strategy.analyze(s, klines.map((k) => k.close), klines.map((k) => k.high), klines.map((k) => k.low), klines.map((k) => k.volume));
        return { symbol: s, signal: r.signal, confidence: r.confidence, reason: r.reason };
      }),
    ),
  );
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) results.set(r.value.symbol, r.value);
  }
  return results;
}

export class PortfolioProcessor {
  private client: KucoinClient;
  private strategy: Strategy;
  private config: PortfolioConfig;
  private interval: string;
  private candleRangeMs: number;
  private minCandles: number;

  constructor(params: {
    client: KucoinClient;
    strategyName: string;
    config: PortfolioConfig;
    interval: string;
    candleRangeMs: number;
    minCandles: number;
  }) {
    this.client = params.client;
    this.strategy = getStrategyEntry(params.strategyName).create();
    this.config = params.config;
    this.interval = params.interval;
    this.candleRangeMs = params.candleRangeMs;
    this.minCandles = params.minCandles;
  }

  get strategyName(): string {
    return this.strategy.name;
  }

  async decide(
    candidates: string[],
    activePositions: PositionState[],
  ): Promise<PortfolioDecision> {
    const held = new Set(activePositions.map((p) => p.symbol));
    const prices = await fetchPrices(this.client, [...new Set([...activePositions.map((p) => p.symbol), ...candidates])]);

    const signals = await fetchKlinesAndAnalyze(
      this.client, this.strategy, candidates,
      this.interval, this.candleRangeMs, this.minCandles,
    );

    const buySignals = [...signals.entries()]
      .filter(([, s]) => s.signal === "buy")
      .map(([symbol, s]) => ({ symbol, confidence: s.confidence, reason: s.reason, price: prices.get(symbol) || 0 }))
      .sort((a, b) => b.confidence - a.confidence);

    const maxTradeSlots = this.config.maxPositions - 1;
    const activeCount = activePositions.length;
    const slotsAvailable = Math.max(0, maxTradeSlots - activeCount);

    const wantToBuy = buySignals.slice(0, slotsAvailable + activePositions.length);

    const wantToSell: Array<{ symbol: string; size: string; reason: string }> = [];
    const sellSignals = await fetchKlinesAndAnalyze(
      this.client, this.strategy, activePositions.map((p) => p.symbol),
      this.interval, this.candleRangeMs, this.minCandles,
    );
    for (const pos of activePositions) {
      const sig = sellSignals.get(pos.symbol);
      if (sig && sig.signal === "sell") {
        wantToSell.push({ symbol: pos.symbol, size: pos.size, reason: sig.reason });
      }
      const price = prices.get(pos.symbol) || 0;
      if (price > 0) {
        const pnl = (price - pos.entryPrice) / pos.entryPrice;
        if (pnl <= -this.config.stopLossPct) {
          if (!wantToSell.find((w) => w.symbol === pos.symbol)) {
            wantToSell.push({ symbol: pos.symbol, size: pos.size, reason: `Stop-loss ${(this.config.stopLossPct * 100).toFixed(0)}%` });
          }
        } else if (pnl >= this.config.takeProfitPct) {
          if (!wantToSell.find((w) => w.symbol === pos.symbol)) {
            wantToSell.push({ symbol: pos.symbol, size: pos.size, reason: `Take-profit ${(this.config.takeProfitPct * 100).toFixed(0)}%` });
          }
        }
      }
    }

    return { wantToBuy, wantToSell, activePositions, slotsAvailable };
  }
}
