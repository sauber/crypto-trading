import { RoleRegistry } from "./registry.ts";
import type { Strategy } from "@sauber/backtest";
import {
  rebalancer,
  RsiTimed,
  MacdTimed,
  BollingerTimed,
  EmaAdxTimed,
} from "../strategy/mod.ts";

export const strategyRegistry = new RoleRegistry<Strategy>();

strategyRegistry.register("rebalancer", (config?: unknown) =>
  rebalancer((config as { targetPositions?: number }).targetPositions ?? 5));

strategyRegistry.register("rsi-timed", (config?: unknown) =>
  RsiTimed(config as Record<string, number>));

strategyRegistry.register("macd-timed", (config?: unknown) =>
  MacdTimed(config as Record<string, number>));

strategyRegistry.register("bb-timed", (config?: unknown) =>
  BollingerTimed(config as Record<string, number>));

strategyRegistry.register("ema-adx-timed", (config?: unknown) =>
  EmaAdxTimed(config as Record<string, number>));
