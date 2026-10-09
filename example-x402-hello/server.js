// Proof of concept: sell a fixed "hello world <network>" message over x402 on
// Stellar through the Built on Stellar facilitator (OpenZeppelin Channels).
// Testnet accepts USDC. Mainnet accepts USDC or USDT0; the buyer picks one.
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const NETWORKS = {
  "stellar:testnet": {
    name: "testnet",
    facilitator: "https://channels.openzeppelin.com/x402/testnet",
    keyVar: "OZ_API_KEY_TESTNET",
    assets: { USDC: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA" },
  },
  "stellar:pubnet": {
    name: "mainnet",
    facilitator: "https://channels.openzeppelin.com/x402",
    keyVar: "OZ_API_KEY_MAINNET",
    // Verified 2026-09-28: `stellar contract id asset` for USDC:GA5ZSEJY… and
    // USDT0:GATISXX6…, and `token symbol`/`decimals` against mainnet (7 decimals).
    assets: {
      USDC: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      USDT0: "CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF",
    },
  },
};

const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
const net = NETWORKS[NETWORK];
if (!net) throw new Error(`STELLAR_NETWORK must be one of ${Object.keys(NETWORKS).join(", ")}`);
const PORT = Number(process.env.PORT || 3004);
// Price per call in 7-decimal units: 10000 = 0.001 USDC / USDT0.
const PRICE_UNITS = process.env.PRICE_UNITS || "10000";

for (const name of ["STELLAR_RECIPIENT", net.keyVar]) {
  if (!process.env[name]) throw new Error(`${name} is required for ${NETWORK} (see .env.example)`);
}

const facilitator = new HTTPFacilitatorClient({
  url: net.facilitator,
  createAuthHeaders: async () => {
    const h = { Authorization: `Bearer ${process.env[net.keyVar]}` };
    return { verify: h, settle: h, supported: h };
  },
});
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactStellarScheme());

const app = express();
app.set("trust proxy", true); // https:// resource URLs behind a TLS proxy (Render)

app.use(
  paymentMiddleware(
    {
      "GET /hello": {
        // One option per accepted asset; the buyer's client chooses.
        accepts: Object.values(net.assets).map((asset) => ({
          scheme: "exact",
          price: { amount: PRICE_UNITS, asset },
          network: NETWORK,
          payTo: process.env.STELLAR_RECIPIENT,
          maxTimeoutSeconds: 60,
        })),
        description: `A fixed hello-world message, paid per call in ${Object.keys(net.assets).join(" or ")} on Stellar ${net.name}.`,
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.get("/hello", (_req, res) => res.json({ message: `hello world ${net.name}` }));

app.get("/health", (_req, res) =>
  res.json({ ok: true, network: NETWORK, accepts: Object.keys(net.assets), priceUnits: PRICE_UNITS }));

app.listen(PORT, () =>
  console.log(`hello seller on http://localhost:${PORT} (${NETWORK}, accepts ${Object.keys(net.assets).join(", ")})`));
