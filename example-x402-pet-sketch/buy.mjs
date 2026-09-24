// Pay for a pet sketch over x402 and save the SVG.
// Usage: STELLAR_SECRET="$(stellar keys secret <IDENTITY>)" node buy.mjs <photo> [url] [out.svg]
// Network defaults to stellar:testnet; set STELLAR_NETWORK=stellar:pubnet for mainnet.
import fs from "node:fs";
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const [photo, url = "http://localhost:3002/sketch", out = "pet-portrait.svg"] = process.argv.slice(2);
if (!photo) throw new Error("usage: node buy.mjs <photo> [url] [out.svg]");
if (!process.env.STELLAR_SECRET) throw new Error("STELLAR_SECRET is required");

const signer = createEd25519Signer(process.env.STELLAR_SECRET, process.env.STELLAR_NETWORK || "stellar:testnet");
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "stellar:*", client: new ExactStellarScheme(signer) }],
});

const ext = photo.split(".").pop().toLowerCase().replace("jpg", "jpeg");
const image = `data:image/${ext};base64,${fs.readFileSync(photo).toString("base64")}`;

// Each call pays again, so save the result from this one response.
const res = await fetchWithPayment(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ image }),
});
console.log("status:", res.status);
const header = res.headers.get("payment-response");
if (header) console.log("payment-response:", decodePaymentResponseHeader(header));
if (!res.ok) {
  console.log("body:", await res.text());
  process.exit(1);
}
fs.writeFileSync(out, await res.text());
console.log("saved:", out);
