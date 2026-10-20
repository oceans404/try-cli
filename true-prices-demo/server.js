// True Prices: an x402 price-check API on Stellar. GET /price-check?item=<item>
// returns made-up best prices. Adapted from ../example-x402-seller.
// Settings come from the environment (or .env):
//   STELLAR_RECIPIENT  payTo address (required)
//   PRICE              price per lookup, default $1.00
//   PORT               default 3001
//   FACILITATOR_URL    default http://localhost:4022, the demo's own facilitator
//   STELLAR_NETWORK    default stellar:testnet
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:4022";
const PORT = Number(process.env.PORT || 3001);
const PRICE = process.env.PRICE || "$1.00";
if (!process.env.STELLAR_RECIPIENT) throw new Error("STELLAR_RECIPIENT is required");

const ITEMS = {
  "airpods-pro-3": { name: "AirPods Pro 3", best: 174.5, store: "Costco" },
  "dyson-v15": { name: "Dyson V15 Detect", best: 529.99, store: "Best Buy" },
  "flight-sfo-lis": { name: "Flight SFO to LIS, round trip", best: 612.0, store: "TAP Air Portugal" },
};

const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR_URL })).register(
  NETWORK,
  new ExactStellarScheme(),
);

const app = express();
app.use(
  paymentMiddleware(
    {
      "GET /price-check": {
        accepts: {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: process.env.STELLAR_RECIPIENT,
          maxTimeoutSeconds: 60,
        },
        description: `Best current price for one item (${Object.keys(ITEMS).join(", ")})`,
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.get("/price-check", (req, res) => {
  const item = ITEMS[req.query.item] ? req.query.item : "airpods-pro-3";
  res.json({ item, ...ITEMS[item], checkedAt: new Date().toISOString() });
});

app.listen(PORT, () =>
  console.log(`True Prices on http://localhost:${PORT} (${PRICE}, payTo ${process.env.STELLAR_RECIPIENT}, ${NETWORK}, facilitator ${FACILITATOR_URL})`),
);
