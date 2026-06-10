import { assertEquals } from "@std/assert";
import { BlankPositionLoader } from "./blank.ts";

Deno.test("empty positions", async () => {
  const loader = BlankPositionLoader();
  const positions = await loader();
  assertEquals(positions.length, 0);
});
