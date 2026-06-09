import { KucoinClient } from "./kucoin/mod.ts";
import { TradingEngine } from "./engine/live.ts";
import type { LiveEngineConfig } from "./engine/live.ts";
import { KucoinPositionLoader } from "./position/mod.ts";
import { BlankPositionLoader } from "./position/mod.ts";
import {
  discoveryRegistry,
} from "./registry/registration.ts";
import { ROLE_CONFIG } from "./config.ts";
import type { KucoinConfig } from "./kucoin/mod.ts";
import {
  portfolioRegistry,
  tradingRegistry,
  executionRegistry,
  commRegistry,
  reflectionRegistry,
} from "./registry/registration.ts";

const KUCOIN_API_KEY = Deno.env.get("KUCOIN_API_KEY") || "";
const KUCOIN_API_SECRET = Deno.env.get("KUCOIN_API_SECRET") || "";
const KUCOIN_API_PASSPHRASE = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";
const DRY_RUN = Deno.env.get("DRY_RUN") === "true";

if (!KUCOIN_API_KEY || !KUCOIN_API_SECRET || !KUCOIN_API_PASSPHRASE) {
  console.error("Missing KuCoin API credentials.");
  Deno.exit(1);
}

const client = new KucoinClient({
  apiKey: KUCOIN_API_KEY,
  apiSecret: KUCOIN_API_SECRET,
  apiPassphrase: KUCOIN_API_PASSPHRASE,
} as KucoinConfig);

const discovery = discoveryRegistry
  .get(ROLE_CONFIG.discovery.strategy)
  .create(ROLE_CONFIG.discovery.params, client);

const portfolio = portfolioRegistry
  .get(ROLE_CONFIG.portfolio.strategy)
  .create(ROLE_CONFIG.portfolio.params);

const trading = tradingRegistry
  .get(ROLE_CONFIG.trading.strategy)
  .create(ROLE_CONFIG.trading.params);

const fee = ROLE_CONFIG.execution.params.fee ?? 0.001;
const execution = executionRegistry
  .get(DRY_RUN ? "simulate" : "kucoin")
  .create({ fee }, client, true);

const comm = commRegistry
  .get(ROLE_CONFIG.communication.strategy)
  .create();

const reflection = reflectionRegistry
  .get(ROLE_CONFIG.reflection.strategy)
  .create();

const positionLoader = DRY_RUN
  ? new BlankPositionLoader({
    reserveSymbol: ROLE_CONFIG.reserveSymbol,
    candleInterval: ROLE_CONFIG.candleInterval,
    candleRangeMs: ROLE_CONFIG.candleRangeMs,
  })
  : new KucoinPositionLoader(
    {
      reserveSymbol: ROLE_CONFIG.reserveSymbol,
      candleInterval: ROLE_CONFIG.candleInterval,
      candleRangeMs: ROLE_CONFIG.candleRangeMs,
    },
    client,
  );

const engineConfig: LiveEngineConfig = {
  client,
  discovery,
  portfolio,
  trading,
  execution,
  communication: comm,
  reflection,
  positionLoader,
  intervalMs: ROLE_CONFIG.cycleIntervalMs,
  targetPositions: ROLE_CONFIG.targetPositions,
  candleInterval: ROLE_CONFIG.candleInterval,
  candleRangeMs: ROLE_CONFIG.candleRangeMs,
  reserveSymbol: ROLE_CONFIG.reserveSymbol,
};

console.log(`DRY_RUN=${DRY_RUN}`);
console.log(`discovery=${ROLE_CONFIG.discovery.strategy}`);
console.log(`portfolio=${ROLE_CONFIG.portfolio.strategy}`);
console.log(`trading=${ROLE_CONFIG.trading.strategy}`);
console.log(`execution=${DRY_RUN ? "simulate" : "kucoin"}`);
console.log(`communication=${ROLE_CONFIG.communication.strategy}`);
console.log(`reflection=${ROLE_CONFIG.reflection.strategy}`);

const engine = new TradingEngine(engineConfig);
await engine.start();
