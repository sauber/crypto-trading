import { assertEquals, assert } from "@std/assert";
import { getKucoinCredentials } from "./credentials.ts";

Deno.test("reads credentials", () => {
  const originalGet: typeof Deno.env.get = Deno.env.get.bind(Deno.env);

  Deno.env.get = ((key: string): string | undefined => {
    if (key === "KUCOIN_API_KEY") return "key";
    if (key === "KUCOIN_API_SECRET") return "secret";
    if (key === "KUCOIN_API_PASSPHRASE") return "passphrase";
    return undefined;
  }) as typeof Deno.env.get;

  const creds = getKucoinCredentials();
  assertEquals(creds.apiKey, "key");
  assertEquals(creds.apiSecret, "secret");
  assertEquals(creds.apiPassphrase, "passphrase");

  Deno.env.get = originalGet;
});
