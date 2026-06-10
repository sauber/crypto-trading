import { assertEquals } from "@std/assert";
import { KucoinClient } from "./client.ts";

Deno.test("constructs client", () => {
  const client = new KucoinClient({
    apiKey: "test-key",
    apiSecret: "test-secret",
    apiPassphrase: "test-passphrase",
  });
  assertEquals(client instanceof KucoinClient, true);
});
