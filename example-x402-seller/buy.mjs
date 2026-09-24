// Buy from an x402 endpoint on Stellar and print what came back.
// Usage: STELLAR_SECRET="$(stellar keys secret <IDENTITY>)" node buy.mjs <URL>
// Network defaults to stellar:testnet; set STELLAR_NETWORK=stellar:pubnet for mainnet.
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const url = process.argv[2] || "http://localhost:3001/fortune";
if (!process.env.STELLAR_SECRET) throw new Error("STELLAR_SECRET is required");

const signer = createEd25519Signer(process.env.STELLAR_SECRET, process.env.STELLAR_NETWORK || "stellar:testnet");
const fetchWithPayment = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "stellar:*", client: new ExactStellarScheme(signer) }],
});

// Each call pays again, so capture everything from this one response.
const res = await fetchWithPayment(url);
console.log("status:", res.status);
const header = res.headers.get("payment-response");
if (header) console.log("payment-response:", decodePaymentResponseHeader(header));
console.log("body:", await res.text());
