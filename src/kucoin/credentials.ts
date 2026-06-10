export function getKucoinCredentials(): {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
} {
  const apiKey = Deno.env.get("KUCOIN_API_KEY") || "";
  const apiSecret = Deno.env.get("KUCOIN_API_SECRET") || "";
  const apiPassphrase = Deno.env.get("KUCOIN_API_PASSPHRASE") || "";

  if (!apiKey || !apiSecret || !apiPassphrase) {
    console.error("Missing KuCoin API credentials.");
    Deno.exit(1);
  }

  return { apiKey, apiSecret, apiPassphrase };
}
