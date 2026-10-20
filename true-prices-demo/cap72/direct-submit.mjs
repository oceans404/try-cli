// Goes around the facilitator: lands a policy-breaking $2.00 payment on chain so
// there's a failed transaction to point at.
//
// A failing __check_auth also fails enforcing simulation, so the $2 payment has
// no complete footprint of its own. Instead:
//   1. prepare(): build a valid $1 payment and simulate it signed, in enforcing
//      mode, so its footprint includes the policy's code, instance, rules and day
//      bucket. Never submit it. This must run while a $1 payment still fits under
//      the daily cap, which is why the demo runner calls it at the start of step 4.
//   2. submit(): simulate the $2 payment in recording mode (that never runs
//      __check_auth, so it succeeds) to get its auth entry and the rest of its
//      footprint, sign the entry, add the policy's entries from step 1's
//      footprint, pad the resources, and send it straight to RPC.
// Usage: node direct-submit.mjs [amount-in-stroops]   (default 20000000, $2.00)
import { SorobanDataBuilder, TransactionBuilder, rpc } from "@stellar/stellar-sdk";
import { PASSPHRASE, server, env, policyError, POLICY_ERRORS, usd, txLink } from "./config.mjs";
import { walletSigner } from "./signer.mjs";
import { buildPayment } from "./payment.mjs";

const ONE_DOLLAR = 10_000_000n;

export async function prepare({ payTo = env.seller } = {}) {
  const signer = walletSigner();
  const latest = await server.getLatestLedger();
  const validUntilLedger = latest.sequence + 1000; // about 80 minutes
  const template = await buildPayment({ signer, asset: env.usdc, payTo, amount: ONE_DOLLAR, validUntilLedger });
  if (!template.ok) throw new Error(`the $1 template payment didn't pass the policy (${template.policyError || template.error})`);
  return { signer, payTo, validUntilLedger, template };
}

/** Union of two lists of ledger keys, by their XDR bytes. */
function union(a, b) {
  const seen = new Map();
  for (const k of [...a, ...b]) seen.set(k.toXdr("base64"), k);
  return [...seen.values()];
}

/** Find a contract error code in diagnostic events. */
function errorFromEvents(events = []) {
  for (const e of events) {
    const body = e.event.body.v0;
    for (const v of [...body.topics, body.data]) {
      if (v.type === "scvError" && v.error.type === "sceContract") {
        const code = Number(v.error.contractCode);
        return POLICY_ERRORS[code] || `contract error #${code}`;
      }
    }
  }
}

export async function submit({ signer, payTo, validUntilLedger, template }, { amount = 2n * ONE_DOLLAR, submitter = env.funder } = {}) {
  const account = await server.getAccount(submitter.publicKey());
  // buildPayment signs the recording simulation's entry; its enforcing
  // simulation fails (that's the point), so its transaction carries the
  // recording footprint, which lacks the policy's entries.
  const bad = await buildPayment({ signer, asset: env.usdc, payTo, amount, validUntilLedger, source: account });

  const good = template.enforcing.transactionData.build();
  const mine = bad.recording.transactionData.build();
  const r = good.resources;
  const resourceFee = Math.ceil(Number(good.resourceFee) * 1.5);
  const sorobanData = new SorobanDataBuilder(mine)
    .setFootprint(union(r.footprint.readOnly, mine.resources.footprint.readOnly), union(r.footprint.readWrite, mine.resources.footprint.readWrite))
    .setResources(Math.ceil(r.instructions * 1.5), r.diskReadBytes + 1000, r.writeBytes + 1000)
    .setResourceFee(resourceFee)
    .build();

  const tx = TransactionBuilder.cloneFrom(bad.transaction, { fee: String(resourceFee + 1000), sorobanData }).build();
  tx.sign(submitter);

  const sent = await server.sendTransaction(tx);
  if (sent.status !== "PENDING") {
    return { hash: sent.hash, status: sent.status, error: sent.errorResult?.result?.type, simulated: bad.policyError };
  }
  const result = await server.pollTransaction(sent.hash, { attempts: 30 });
  return {
    hash: sent.hash,
    status: result.status,
    result: result.resultXdr?.result?.results?.[0]?.tr?.invokeHostFunctionResult?.type,
    onchain: errorFromEvents(result.diagnosticEventsXdr),
    simulated: bad.policyError,
    fee: result.resultXdr?.feeCharged?.toString(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const amount = BigInt(process.argv[2] || 2n * ONE_DOLLAR);
  const prepared = await prepare();
  console.log(`template       valid $1.00 payment simulated in enforcing mode, resource fee ${prepared.template.enforcing.minResourceFee} stroops`);
  const r = await submit(prepared, { amount });
  console.log(`direct submit  ${usd(amount)}  ${r.status}  ${r.result || r.error || ""}`);
  console.log(`policy         ${r.onchain || r.simulated || "(none)"}${r.onchain ? " (from onchain diagnostics)" : " (from simulation)"}`);
  console.log(`tx             ${txLink(r.hash)}`);
}
