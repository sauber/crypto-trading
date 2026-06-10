import { strategyRegistry } from "../registry/registration.ts";

export function parseStrategyArg(): string {
  const strategyArg = Deno.args.find((a) => a.startsWith("--strategy="));

  if (!strategyArg) {
    console.error("Usage: deno task optimize --strategy=rsi-timed");
    Deno.exit(1);
  }

  const strategyName = strategyArg.split("=")[1];

  if (!strategyRegistry.has(strategyName)) {
    console.error(
      `Unknown strategy: ${strategyName}. Available: ${strategyRegistry.list().join(", ")}`,
    );
    Deno.exit(1);
  }

  return strategyName;
}
