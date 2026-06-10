import { KucoinClient } from "../kucoin/mod.ts";
import { TradingEngine } from "../engine/live.ts";
import type { LiveEngineConfig } from "../engine/live.ts";
import { strategyRegistry } from "../registry/registration.ts";
import { CONFIG } from "../config.ts";
import type { KucoinConfig } from "../kucoin/mod.ts";

const KUCOIN_API_KEY = Deno.env.get("KUCOIN_API_KEY") || "";
const KUCOIN_API_SECRET = Deno.env.get("KUCOIN_API_SECRET") || "";
const KUCOIN_API_PASSPHRASE = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";

if (!KUCOIN_API_KEY || !KUCOIN_API_SECRET || !KUCOIN_API_PASSPHRASE) {
  console.error("Missing KuCoin API credentials.");
  Deno.exit(1);
}

const client = new KucoinClient({
  apiKey: KUCOIN_API_KEY,
  apiSecret: KUCOIN_API_SECRET,
  apiPassphrase: KUCOIN_API_PASSPHRASE,
} as KucoinConfig);

const strategy = strategyRegistry
  .get(CONFIG.strategy.name)
  .create(CONFIG.strategy.params);

const engineConfig: LiveEngineConfig = {
  client,
  strategy,
  intervalMs: CONFIG.cycleIntervalMs,
  targetPositions: CONFIG.targetPositions,
  candleInterval: CONFIG.candleInterval,
  candleRangeMs: CONFIG.candleRangeMs,
  reserveSymbol: CONFIG.reserveSymbol,
};

console.log(`strategy=${CONFIG.strategy.name}`);
console.log(`targetPositions=${CONFIG.targetPositions}`);

const engine = new TradingEngine(engineConfig);
await engine.start();
