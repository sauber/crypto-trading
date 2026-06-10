import { getKucoinCredentials } from "../kucoin/credentials.ts";
import { KucoinClient } from "../kucoin/mod.ts";
import { TradingEngine } from "../engine/live.ts";
import type { LiveEngineConfig } from "../engine/live.ts";
import { strategyRegistry } from "../registry/registration.ts";
import { CONFIG } from "../config.ts";

const { apiKey, apiSecret, apiPassphrase } = getKucoinCredentials();
const client = new KucoinClient({ apiKey, apiSecret, apiPassphrase });
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
