import { assertEquals } from "@std/assert";
import { EmaAdxTimed } from "./ema-adx-timed.ts";

Deno.test("creates strategy", () => {
  const s = EmaAdxTimed();
  assertEquals(typeof s, "function");
});

Deno.test("names strategy", () => {
  const s = EmaAdxTimed();
  assertEquals(s.name, "ema-adx-timed");
});
