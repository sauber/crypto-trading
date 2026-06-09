import { RankTrendPortfolio } from "./rank-trend.ts";
import type { CoinCandidate } from "../discovery/mod.ts";
import type { PositionState } from "../engine/types.ts";

Deno.test("RankTrendPortfolio identifies improving-rank coins as buys", () => {
  const strategy = RankTrendPortfolio(5);

  const candidates: CoinCandidate[] = [
    { symbol: "BTC-USDT", score: 1000, reason: "vol" },
    { symbol: "ETH-USDT", score: 800, reason: "vol" },
    { symbol: "SOL-USDT", score: 600, reason: "vol" },
  ];

  let decision = strategy([], candidates);

  if (decision.wantToBuy.length !== 0) {
    throw new Error(
      `First call: expected 0 buys (no history), got ${decision.wantToBuy.length}`,
    );
  }

  const candidates2: CoinCandidate[] = [
    { symbol: "SOL-USDT", score: 1200, reason: "vol" },
    { symbol: "ETH-USDT", score: 800, reason: "vol" },
    { symbol: "BTC-USDT", score: 400, reason: "vol" },
  ];

  decision = strategy([], candidates2);

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

Deno.test("RankTrendPortfolio flags declining held coins as sells", () => {
  const strategy = RankTrendPortfolio(5);

  const activePositions: PositionState[] = [
    { symbol: "BTC-USDT", entryPrice: 100, size: 0.1, enteredAt: 0, entryValue: 10 },
    { symbol: "SOL-USDT", entryPrice: 50, size: 0.2, enteredAt: 0, entryValue: 10 },
  ];

  strategy(activePositions, [
    { symbol: "BTC-USDT", score: 1000, reason: "vol" },
    { symbol: "ETH-USDT", score: 800, reason: "vol" },
    { symbol: "SOL-USDT", score: 600, reason: "vol" },
  ]);

  const decision = strategy(activePositions, [
    { symbol: "ETH-USDT", score: 1000, reason: "vol" },
    { symbol: "SOL-USDT", score: 800, reason: "vol" },
    { symbol: "BTC-USDT", score: 400, reason: "vol" },
  ]);

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

Deno.test("RankTrendPortfolio does not buy already-held coins", () => {
  const strategy = RankTrendPortfolio(5);

  const activePositions: PositionState[] = [
    { symbol: "ETH-USDT", entryPrice: 100, size: 1, enteredAt: 0, entryValue: 100 },
  ];

  strategy(activePositions, [
    { symbol: "BTC-USDT", score: 800, reason: "vol" },
    { symbol: "ETH-USDT", score: 600, reason: "vol" },
  ]);

  const decision = strategy(activePositions, [
    { symbol: "ETH-USDT", score: 1000, reason: "vol" },
    { symbol: "BTC-USDT", score: 500, reason: "vol" },
  ]);

  if (decision.wantToBuy.some((b) => b.symbol === "ETH-USDT")) {
    throw new Error("Should not buy already-held ETH-USDT");
  }
});
