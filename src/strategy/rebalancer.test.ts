import { assertEquals } from "@std/assert";
import { rebalancer } from "./rebalancer.ts";

Deno.test("creates strategy", () => {
  const s = rebalancer(5);
  assertEquals(typeof s, "function");
});

Deno.test("names strategy", () => {
  const s = rebalancer(5);
  assertEquals(s.name, "rebalancer");
});
