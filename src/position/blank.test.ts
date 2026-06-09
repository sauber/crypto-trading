import { BlankPositionLoader } from "./blank.ts";
import { config } from "./blank.config.ts";

Deno.test("BlankPositionLoader returns empty array", async () => {
  const loader = new BlankPositionLoader(config);
  const positions = await loader.loadPositions();
  if (positions.length !== 0) {
    throw new Error(`expected [], got ${positions.length} positions`);
  }
});

Deno.test("BlankPositionLoader uses defaults when no config given", async () => {
  const loader = new BlankPositionLoader();
  if (loader.config.reserveSymbol !== "USDC") {
    throw new Error(`expected USDC, got ${loader.config.reserveSymbol}`);
  }
  if (loader.config.candleInterval !== "1hour") {
    throw new Error(`expected 1hour, got ${loader.config.candleInterval}`);
  }
  const positions = await loader.loadPositions();
  if (positions.length !== 0) throw new Error("should be empty");
});

Deno.test("BlankPositionLoader respects partial config overrides", async () => {
  const loader = new BlankPositionLoader({ reserveSymbol: "USDT" });
  if (loader.config.reserveSymbol !== "USDT") {
    throw new Error(`expected USDT, got ${loader.config.reserveSymbol}`);
  }
  if (loader.config.candleInterval !== "1hour") {
    throw new Error("candleInterval should still be default");
  }
});
