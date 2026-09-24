// Test stand-in for Privy: `node --import ./test/mock-privy.mjs privy.mjs ...` answers
// Privy's create-wallet and raw_sign calls with a local keypair (PRIVY_MOCK_SECRET),
// so everything except the real HTTP round trip to Privy can be exercised. Other
// requests pass through untouched. Never use this for a real wallet.
import { Keypair } from "@stellar/stellar-sdk";

const secret = process.env.PRIVY_MOCK_SECRET;
if (!secret) throw new Error("PRIVY_MOCK_SECRET is required for the Privy mock");
const kp = Keypair.fromSecret(secret);
const realFetch = globalThis.fetch;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.origin !== "https://api.privy.io") return realFetch(input, init);
  const headers = new Headers(init.headers);
  if (!headers.get("authorization")?.startsWith("Basic ") || !headers.get("privy-app-id")) {
    return json({ error: "missing auth" }, 401);
  }
  if (init.method === "POST" && url.pathname === "/v1/wallets") {
    return json({ id: "mock-wallet", address: kp.publicKey(), chain_type: "stellar", owner_id: null });
  }
  if (init.method === "POST" && /^\/v1\/wallets\/[^/]+\/raw_sign$/.test(url.pathname)) {
    const hash = Buffer.from(JSON.parse(init.body).params.hash.slice(2), "hex");
    if (hash.length !== 32) return json({ error: "hash must be 32 bytes" }, 400);
    return json({ method: "raw_sign", data: { signature: `0x${Buffer.from(kp.sign(hash)).toString("hex")}`, encoding: "hex" } });
  }
  return json({ error: `mock has no route for ${init.method} ${url.pathname}` }, 404);
};
