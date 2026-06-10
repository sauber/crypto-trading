import { assertEquals } from "@std/assert";
import { TradingEngine } from "./live.ts";
import type { KucoinClient } from "../kucoin/mod.ts";

Deno.test("constructs engine", () => {
  const engine = new TradingEngine({
    client: {} as unknown as KucoinClient,
    strategy: (() => []) as never,
    intervalMs: 3600000,
    targetPositions: 5,
    candleInterval: "1hour",
    candleLookback: 55,
    reserveSymbol: "USDC",
  });
  assertEquals(engine instanceof TradingEngine, true);
});

Deno.test("stops engine", () => {
  const engine = new TradingEngine({} as never);
  engine.stop();
});
