import { assertEquals } from "@std/assert";
import { MacdTimed } from "./macd-timed.ts";

Deno.test("creates strategy", () => {
  const s = MacdTimed();
  assertEquals(typeof s, "function");
});

Deno.test("names strategy", () => {
  const s = MacdTimed();
  assertEquals(s.name, "macd-timed");
});
