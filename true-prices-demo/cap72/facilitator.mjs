// The demo's own x402 facilitator: @x402/stellar's ExactStellarScheme, unmodified,
// in a small Express app. It runs locally so the demo doesn't depend on a shared
// facilitator's uptime and latency, and so version A can patch in the delegated
// credential type later. It keeps a log of verify results at GET /log so the
// demo runner can print the exact refusal reasons.
//
// Fee ceiling: the stock default (50,000 stroops). agent_policy keeps its day
// bucket in temporary storage, so a payment costs about 13k to 26k stroops and
// fits. Set MAX_FEE_STROOPS to raise it for heavier policies.
import express from "express";
import { x402Facilitator } from "@x402/core/facilitator";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/facilitator";
import { NETWORK, RPC_URL, need } from "./config.mjs";

const PORT = Number(process.env.FACILITATOR_PORT || 4022);
const signer = createEd25519Signer(need("FACILITATOR_SECRET"), NETWORK);

const facilitator = new x402Facilitator().register(
  NETWORK,
  new ExactStellarScheme([signer], {
    rpcConfig: { url: RPC_URL },
    ...(process.env.MAX_FEE_STROOPS && { maxTransactionFeeStroops: Number(process.env.MAX_FEE_STROOPS) }),
  }),
);

const log = [];
const record = (kind, body, result) => {
  const accepted = body.paymentRequirements || {};
  log.push({ at: new Date().toISOString(), kind, payTo: accepted.payTo, amount: accepted.amount, ...result });
  if (log.length > 100) log.shift();
  console.log(kind, JSON.stringify(log.at(-1)));
};

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/supported", async (_req, res) => res.json(facilitator.getSupported()));

app.post("/verify", async (req, res) => {
  try {
    const result = await facilitator.verify(req.body.paymentPayload, req.body.paymentRequirements);
    record("verify", req.body, result);
    res.json(result);
  } catch (e) {
    record("verify", req.body, { isValid: false, invalidReason: "facilitator_error", invalidMessage: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

app.post("/settle", async (req, res) => {
  try {
    const result = await facilitator.settle(req.body.paymentPayload, req.body.paymentRequirements);
    record("settle", req.body, result);
    res.json(result);
  } catch (e) {
    record("settle", req.body, { success: false, errorReason: "facilitator_error", errorMessage: String(e) });
    res.status(500).json({ error: String(e) });
  }
});

app.get("/log", (_req, res) => res.json(log));

app.listen(PORT, () => console.log(`facilitator on http://localhost:${PORT} (${NETWORK}, fee payer ${signer.address}, rpc ${RPC_URL})`));
