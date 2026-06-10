import { getKucoinCredentials } from "../kucoin/credentials.ts";
import { KucoinClient } from "../kucoin/mod.ts";
import { TradingEngine } from "../engine/live.ts";
import type { LiveEngineConfig } from "../engine/live.ts";
import { strategyRegistry } from "../registry/registration.ts";
import config from "../../data/config.json" with { type: "json" };

const { apiKey, apiSecret, apiPassphrase } = getKucoinCredentials();
const client = new KucoinClient({ apiKey, apiSecret, apiPassphrase });
const strategy = strategyRegistry
  .get(config.strategy.name)
  .create(config.strategy.params);
const engineConfig: LiveEngineConfig = {
  client,
  strategy,
  intervalMs: config.cycleIntervalMs,
  targetPositions: config.targetPositions,
  candleInterval: config.candleInterval,
  candleLookback: config.candleLookback,
  reserveSymbol: config.reserveSymbol,
};

console.log(`strategy=${config.strategy.name}`);
console.log(`targetPositions=${config.targetPositions}`);

const engine = new TradingEngine(engineConfig);
await engine.start();
