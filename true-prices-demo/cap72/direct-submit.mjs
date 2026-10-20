// Goes around the facilitator: lands a policy-breaking $2.00 payment on chain so
// there's a failed transaction to point at.
//
// A failing __check_auth also fails simulation, so the $2 payment has no
// footprint or resource estimate of its own. Instead:
//   1. prepare(): build a valid $1 payment and simulate it signed, in enforcing
//      mode, so the footprint includes the policy's code, instance, rules and day
//      bucket. Never submit it. This must run while a $1 payment is still within
//      the daily cap, which is why the demo runner calls it at the start of step 4.
//   2. submit(): rebuild the same invocation for $2, re-sign the auth entry for
//      the new payload (same nonce), reuse that footprint with padded resources,
//      and send it straight to RPC.
// Usage: node direct-submit.mjs [amount-in-stroops]   (default 20000000, $2.00)
import { SorobanDataBuilder, TransactionBuilder, Operation, nativeToScVal, xdr, rpc } from "@stellar/stellar-sdk";
import { PASSPHRASE, server, env, policyError, POLICY_ERRORS, usd, txLink } from "./config.mjs";
import { createPolicySigner } from "./signer.mjs";
import { buildPayment } from "./payment.mjs";

const ONE_DOLLAR = 10_000_000n;

export async function prepare({ payTo = env.seller } = {}) {
  const signer = createPolicySigner(env.agent, env.policy, PASSPHRASE);
  const latest = await server.getLatestLedger();
  const validUntilLedger = latest.sequence + 1000; // about 80 minutes
  const template = await buildPayment({ signer, asset: env.usdc, payTo, amount: ONE_DOLLAR, validUntilLedger });
  if (!template.ok) throw new Error(`the $1 template payment didn't pass the policy (${template.policyError || template.error})`);
  return { signer, validUntilLedger, template };
}

function withAmount(entry, amount) {
  const clone = xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR());
  const args = clone.rootInvocation().function().contractFn().args();
  args[2] = nativeToScVal(amount, { type: "i128" });
  clone.credentials().address().signature(xdr.ScVal.scvVoid());
  return clone;
}

/** Find a contract error code in diagnostic events. */
function errorFromEvents(events = []) {
  for (const e of events) {
    const body = e.event().body().v0();
    for (const v of [...body.topics(), body.data()]) {
      if (v.switch().name === "scvError" && v.error().switch().name === "sceContract") {
        const code = v.error().contractCode();
        return POLICY_ERRORS[code] || `contract error #${code}`;
      }
    }
  }
}

export async function submit({ signer, validUntilLedger, template }, { amount = 2n * ONE_DOLLAR, submitter = env.funder } = {}) {
  const auth = await Promise.all(template.auth.map((e) => (signer.owns(e) ? signer.authorize(withAmount(e, amount), validUntilLedger) : e)));
  const func = template.transaction.operations[0].func;
  func.invokeContract().args()[2] = nativeToScVal(amount, { type: "i128" });

  const data = template.enforcing.transactionData.build();
  const r = data.resources();
  const resourceFee = Math.ceil(Number(data.resourceFee().toBigInt()) * 1.5);
  const sorobanData = new SorobanDataBuilder(data)
    .setResources(Math.ceil(r.instructions() * 1.5), r.diskReadBytes(), r.writeBytes() + 1000)
    .setResourceFee(resourceFee)
    .build();

  const account = await server.getAccount(submitter.publicKey());
  const tx = new TransactionBuilder(account, { fee: String(resourceFee + 1000), networkPassphrase: PASSPHRASE, sorobanData })
    .addOperation(Operation.invokeHostFunction({ func, auth }))
    .setTimeout(120)
    .build();
  tx.sign(submitter);

  // What the policy says about it, from a simulation (the runner prints this).
  const sim = await server.simulateTransaction(tx);
  const simulated = rpc.Api.isSimulationSuccess(sim) ? undefined : policyError(sim.error);

  const sent = await server.sendTransaction(tx);
  if (sent.status !== "PENDING") {
    return { hash: sent.hash, status: sent.status, error: sent.errorResult?.result().switch().name, simulated };
  }
  const result = await server.pollTransaction(sent.hash, { attempts: 30 });
  return {
    hash: sent.hash,
    status: result.status,
    result: result.resultXdr?.result().results()?.[0]?.tr().invokeHostFunctionResult().switch().name,
    onchain: errorFromEvents(result.diagnosticEventsXdr),
    simulated,
    fee: result.feeCharged ?? result.resultXdr?.feeCharged().toString(),
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
