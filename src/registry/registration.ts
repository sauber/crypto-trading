import { RoleRegistry } from "./registry.ts";
import type { PortfolioStrategy } from "../portfolio/mod.ts";
import type { TradingStrategy } from "../trading/mod.ts";
import type { ExecutionStrategy } from "../execution/mod.ts";
import type { ReflectionStrategy } from "../reflection/mod.ts";
import type { DiscoveryStrategy } from "../discovery/mod.ts";
import type { KucoinClient } from "../kucoin/mod.ts";
import type { Kline } from "../kucoin/mod.ts";
import { FileDiscovery } from "../discovery/mod.ts";
import { KucoinDiscovery } from "../discovery/mod.ts";
import { RankTrendPortfolio } from "../portfolio/mod.ts";
import { RsiTimed } from "../trading/mod.ts";
import { MacdTimed } from "../trading/mod.ts";
import { BollingerTimed } from "../trading/mod.ts";
import { EmaAdxTimed } from "../trading/mod.ts";
import { SimulateExecution } from "../execution/mod.ts";
import { KucoinExecution } from "../execution/mod.ts";
import { NoopReflection } from "../reflection/mod.ts";
import { AnalystReflection } from "../reflection/mod.ts";

export const discoveryRegistry = new RoleRegistry<DiscoveryStrategy>();

discoveryRegistry.register("testdata", (config?: unknown) =>
  FileDiscovery(config as { topN?: number }));

discoveryRegistry.register("kucoin", (...args: unknown[]) =>
  KucoinDiscovery(args[0] as { topN: number }, args[1] as KucoinClient));

export const portfolioRegistry = new RoleRegistry<PortfolioStrategy>();
export const tradingRegistry = new RoleRegistry<TradingStrategy>();
export const executionRegistry = new RoleRegistry<ExecutionStrategy>();
export const reflectionRegistry = new RoleRegistry<ReflectionStrategy>();

portfolioRegistry.register("rank-trend", (config?: unknown) =>
  RankTrendPortfolio((config as { targetPositions?: number }).targetPositions ?? 5));

tradingRegistry.register("rsi-timed", (config?: unknown) =>
  RsiTimed(config as Record<string, number>));
tradingRegistry.register("macd-timed", (config?: unknown) =>
  MacdTimed(config as Record<string, number>));
tradingRegistry.register("bb-timed", (config?: unknown) =>
  BollingerTimed(config as Record<string, number>));
tradingRegistry.register("ema-adx-timed", (config?: unknown) =>
  EmaAdxTimed(config as Record<string, number>));

executionRegistry.register("simulate", (...args: unknown[]) =>
  SimulateExecution(
    args[0] as { fee: number },
    args[1] as Map<string, number> | undefined,
    args[2] as Map<string, Kline[]> | undefined,
    args[3] as number | undefined,
  ));
executionRegistry.register("kucoin", (...args: unknown[]) =>
  KucoinExecution(args[0] as { fee: number }, args[1] as never, args[2] as boolean));

reflectionRegistry.register("noop", () => new NoopReflection({ enabled: false }));
reflectionRegistry.register("analyst", () => new AnalystReflection({ enabled: true }));
