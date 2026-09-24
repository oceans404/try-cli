// Minimal x402 seller on Stellar. Settles through OZ Channels by default, or
// through Rail402's facilitator (which also lists the route in its Bazaar).
// Based on the Agentic Payments skill (skills.stellar.org, x402.md) and the
// Rail402 seller quickstart (docs.rail402.dev/sellers/quickstart).
// Network and facilitator come from .env: stellar:testnet now, stellar:pubnet later.
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { describeEndpoint } from "@rail402.dev/sdk";
import { FORTUNES, TOPICS, luckyNumbers } from "./fortunes.js";

const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://channels.openzeppelin.com/x402/testnet";
const PORT = Number(process.env.PORT || 3001);

// OZ Channels needs an API key on testnet and mainnet; Rail402 needs none.
const isOZ = FACILITATOR_URL.includes("channels.openzeppelin.com");
const required = ["STELLAR_RECIPIENT", ...(isOZ ? ["OZ_API_KEY"] : [])];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required (see .env.example)`);
}

const facilitator = new HTTPFacilitatorClient({
  url: FACILITATOR_URL,
  ...(isOZ && {
    createAuthHeaders: async () => {
      const h = { Authorization: `Bearer ${process.env.OZ_API_KEY}` };
      return { verify: h, settle: h, supported: h };
    },
  }),
});

const resourceServer = new x402ResourceServer(facilitator)
  .register(NETWORK, new ExactStellarScheme())
  // Discovery metadata; Rail402 catalogs it when a payment settles.
  .registerExtension(bazaarResourceServerExtension);



const app = express();
// Behind a TLS-terminating proxy (Render, Fly, etc.), trust X-Forwarded-Proto so
// the challenge advertises https://. @x402/express builds the resource URL from
// req.protocol, and Rail402's Bazaar lists whatever URL the paid challenge carries.
app.set("trust proxy", true);

app.use(
  paymentMiddleware(
    {
      "GET /fortune": {
        accepts: {
          scheme: "exact",
          price: "$0.01", // converted to 7-decimal USDC units
          network: NETWORK,
          payTo: process.env.STELLAR_RECIPIENT,
          maxTimeoutSeconds: 60,
        },
        // serviceName and tags are the highest-weighted fields in Rail402's search,
        // and the explorer's registered-sellers list shows named services.
        serviceName: "Stellar Fortunes",
        tags: ["fortune", "fortune-cookie", "lucky-numbers", "wisdom", "fun"],
        description: "A fortune-cookie fortune with six lucky numbers. Pick a topic (wisdom, luck, love, work, adventure) or get a random one.",
        mimeType: "application/json",
        extensions: describeEndpoint({
          params: {
            topic: {
              description: "Kind of fortune: wisdom, luck, love, work, or adventure. Random if omitted.",
              type: "string",
              required: false,
              example: "luck",
              enum: TOPICS,
            },
          },
          outputExample: { fortune: "A pleasant surprise is waiting for you.", topic: "luck", luckyNumbers: [3, 12, 19, 27, 34, 41] },
        }),
      },
    },
    resourceServer,
  ),
);

app.get("/fortune", (req, res) => {
  const topic = TOPICS.includes(req.query.topic) ? req.query.topic : TOPICS[Math.floor(Math.random() * TOPICS.length)];
  const list = FORTUNES[topic];
  res.json({ fortune: list[Math.floor(Math.random() * list.length)], topic, luckyNumbers: luckyNumbers() });
});

app.listen(PORT, () => console.log(`x402 seller on http://localhost:${PORT} (${NETWORK}, facilitator ${FACILITATOR_URL})`));
