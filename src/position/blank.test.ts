import { BlankPositionLoader } from "./blank.ts";

Deno.test("BlankPositionLoader returns empty array", async () => {
  const loader = BlankPositionLoader();
  const positions = await loader();
  if (positions.length !== 0) {
    throw new Error(`expected [], got ${positions.length} positions`);
  }
});
