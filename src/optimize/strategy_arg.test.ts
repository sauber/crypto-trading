import { assertEquals, assert } from "@std/assert";
import { parseStrategyArg } from "./strategy_arg.ts";

Deno.test("parses strategy", () => {
  const originalArgs = Deno.args;
  const originalExit = Deno.exit;

  Object.defineProperty(Deno, "args", {
    value: ["--strategy=rsi-timed"],
    writable: false,
  });
  Deno.exit = ((_code?: number) => {
    throw new Error("exited");
  }) as typeof Deno.exit;

  const result = parseStrategyArg();
  assertEquals(result, "rsi-timed");

  Object.defineProperty(Deno, "args", { value: originalArgs, writable: false });
  Deno.exit = originalExit;
});
