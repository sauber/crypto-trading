import { RankTrendPortfolio } from "./strategy.ts";
import { config } from "./config.ts";
import type { CoinCandidate } from "../../../types.ts";
import type { PositionState, PortfolioDecision } from "../../../../engine/types.ts";

Deno.test("RankTrendPortfolio identifies improving-rank coins as buys", async () => {
  const strategy = new RankTrendPortfolio(config);

  const candidates: CoinCandidate[] = [
    { symbol: "BTC-USDT", score: 1000, reason: "vol" },
    { symbol: "ETH-USDT", score: 800, reason: "vol" },
    { symbol: "SOL-USDT", score: 600, reason: "vol" },
  ];

  // First call: all at rank 1, 2, 3 → no history → no rank change
  let decision = await strategy.analyze({
    candidates,
    activePositions: [],
    prices: new Map(),
    client: undefined as any,
    interval: "1hour",
    candleRangeMs: 0,
  });

  if (decision.wantToBuy.length !== 0) {
    throw new Error(
      `First call: expected 0 buys (no history), got ${decision.wantToBuy.length}`,
    );
  }

  // Second call: BTC drops to rank 3 (lowest volume), SOL rises to rank 1
  const candidates2: CoinCandidate[] = [
    { symbol: "SOL-USDT", score: 1200, reason: "vol" },
    { symbol: "ETH-USDT", score: 800, reason: "vol" },
    { symbol: "BTC-USDT", score: 400, reason: "vol" },
  ];

  decision = await strategy.analyze({
    candidates: candidates2,
    activePositions: [],
    prices: new Map(),
    client: undefined as any,
    interval: "1hour",
    candleRangeMs: 0,
  });

  const buySymbols = decision.wantToBuy.map((b) => b.symbol);
  if (!buySymbols.includes("SOL-USDT")) {
    throw new Error(
      `SOL-USDT should be a buy (rank improved from 3→1), buys: ${buySymbols.join(", ")}`,
    );
  }
  if (buySymbols.includes("BTC-USDT")) {
    throw new Error(
      `BTC-USDT should NOT be a buy (rank declined from 1→3)`,
    );
  }
});

Deno.test("RankTrendPortfolio flags declining held coins as sells", async () => {
  const strategy = new RankTrendPortfolio(config);

  const activePositions: PositionState[] = [
    { symbol: "BTC-USDT", entryPrice: 100, size: 0.1, enteredAt: 0, entryValue: 10 },
    { symbol: "SOL-USDT", entryPrice: 50, size: 0.2, enteredAt: 0, entryValue: 10 },
  ];

  // First call: establish history
  await strategy.analyze({
    candidates: [
      { symbol: "BTC-USDT", score: 1000, reason: "vol" },
      { symbol: "ETH-USDT", score: 800, reason: "vol" },
      { symbol: "SOL-USDT", score: 600, reason: "vol" },
    ],
    activePositions,
    prices: new Map(),
    client: undefined as any,
    interval: "1hour",
    candleRangeMs: 0,
  });

  // BTC drops from rank 1 to 3, SOL stays at 3
  const decision = await strategy.analyze({
    candidates: [
      { symbol: "ETH-USDT", score: 1000, reason: "vol" },
      { symbol: "SOL-USDT", score: 800, reason: "vol" },
      { symbol: "BTC-USDT", score: 400, reason: "vol" },
    ],
    activePositions,
    prices: new Map(),
    client: undefined as any,
    interval: "1hour",
    candleRangeMs: 0,
  });

  const sellSymbols = decision.wantToSell.map((s) => s.symbol);
  if (!sellSymbols.includes("BTC-USDT")) {
    throw new Error(
      `BTC-USDT should be a sell (rank declined 1→3), sells: ${sellSymbols.join(", ")}`,
    );
  }
  if (sellSymbols.includes("SOL-USDT")) {
    throw new Error(
      `SOL-USDT should not be sold (rank improved 3→2)`,
    );
  }
});

Deno.test("RankTrendPortfolio does not buy already-held coins", async () => {
  const strategy = new RankTrendPortfolio(config);

  const activePositions: PositionState[] = [
    { symbol: "ETH-USDT", entryPrice: 100, size: 1, enteredAt: 0, entryValue: 100 },
  ];

  // First call: establish history
  await strategy.analyze({
    candidates: [
      { symbol: "BTC-USDT", score: 800, reason: "vol" },
      { symbol: "ETH-USDT", score: 600, reason: "vol" },
    ],
    activePositions,
    prices: new Map(),
    client: undefined as any,
    interval: "1hour",
    candleRangeMs: 0,
  });

  // ETH improves rank, but we already hold it
  const decision = await strategy.analyze({
    candidates: [
      { symbol: "ETH-USDT", score: 1000, reason: "vol" },
      { symbol: "BTC-USDT", score: 500, reason: "vol" },
    ],
    activePositions,
    prices: new Map(),
    client: undefined as any,
    interval: "1hour",
    candleRangeMs: 0,
  });

  if (decision.wantToBuy.some((b) => b.symbol === "ETH-USDT")) {
    throw new Error("Should not buy already-held ETH-USDT");
  }
});
