// Pay for the hello message over x402 and print the result.
// Usage: STELLAR_SECRET=... node buy.mjs [url] [USDC|USDT0]
// STELLAR_NETWORK defaults to stellar:testnet; use stellar:pubnet for mainnet.
// The optional asset picks which of the seller's accepted assets to pay with.
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const ASSETS = {
  USDC: ["CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA", "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"],
  USDT0: ["CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF"],
};

const [url = "http://localhost:3004/hello", payWith] = process.argv.slice(2);
if (!process.env.STELLAR_SECRET) throw new Error("STELLAR_SECRET is required");
if (payWith && !ASSETS[payWith]) throw new Error(`asset must be one of ${Object.keys(ASSETS).join(", ")}`);
const network = process.env.STELLAR_NETWORK || "stellar:testnet";

const signer = createEd25519Signer(process.env.STELLAR_SECRET, network);
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "stellar:*", client: new ExactStellarScheme(signer) }],
  // Keep only the options in the requested asset.
  policies: payWith ? [(_v, reqs) => reqs.filter((r) => ASSETS[payWith].includes(r.asset))] : [],
  // The client only pays each network's default asset (USDC) unless others are
  // allow-listed, so allow the requested one, capped at MAX_UNITS (default 0.10).
  ...(payWith && {
    spendControls: {
      allowedAssets: ASSETS[payWith].map((asset) => ({ network, asset, maxAmountPerPayment: process.env.MAX_UNITS || "1000000" })),
    },
  }),
});

const res = await fetchWithPayment(url);
console.log("status:", res.status);
const header = res.headers.get("payment-response");
if (header) console.log("payment-response:", decodePaymentResponseHeader(header));
console.log("body:", await res.text());
