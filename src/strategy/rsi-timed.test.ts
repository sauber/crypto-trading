import { assertEquals } from "@std/assert";
import { RsiTimed } from "./rsi-timed.ts";

Deno.test("creates strategy", () => {
  const s = RsiTimed();
  assertEquals(typeof s, "function");
});

Deno.test("names strategy", () => {
  const s = RsiTimed();
  assertEquals(s.name, "rsi-timed");
});
