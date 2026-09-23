// Minimal x402 seller on Stellar, settled through the OZ Channels facilitator.
// Based on the Agentic Payments skill (skills.stellar.org, x402.md).
// Network comes from .env: stellar:testnet now, stellar:pubnet later.
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
const PORT = Number(process.env.PORT || 3001);

for (const name of ["OZ_API_KEY", "STELLAR_RECIPIENT"]) {
  if (!process.env[name]) throw new Error(`${name} is required (see .env.example)`);
}

const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://channels.openzeppelin.com/x402/testnet",
  // OZ Channels requires Bearer auth on both testnet and mainnet.
  createAuthHeaders: async () => {
    const h = { Authorization: `Bearer ${process.env.OZ_API_KEY}` };
    return { verify: h, settle: h, supported: h };
  },
});

const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactStellarScheme());

const FORTUNES = [
  "A trustline today saves an op_no_trust tomorrow.",
  "Read the challenge before you pay it.",
  "Seven decimals, not six.",
  "Never retry a timed-out write blindly.",
];

const app = express();

app.use(
  paymentMiddleware(
    {
      "GET /fortune": {
        accepts: {
          scheme: "exact",
          price: "$0.01", // converted to 7-decimal USDC units
          network: NETWORK,
          payTo: process.env.STELLAR_RECIPIENT,
        },
        description: "A Stellar fortune, paid with x402",
      },
    },
    resourceServer,
  ),
);

app.get("/fortune", (_req, res) => {
  res.json({ fortune: FORTUNES[Math.floor(Math.random() * FORTUNES.length)], network: NETWORK });
});

app.listen(PORT, () => console.log(`x402 seller on http://localhost:${PORT} (${NETWORK})`));
