// Builds and signs an x402 "exact" payment from the policy wallet. This replaces
// @x402/stellar's client createPaymentPayload, which can't sign for a custom
// account (see signer.mjs). Same steps: simulate in recording mode to get the
// auth entry, sign it, then simulate again in enforcing mode so __check_auth
// actually runs. Only the second simulation's footprint includes the policy
// contract's code, instance, rules and day bucket.
import {
  Account,
  BASE_FEE,
  Contract,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { getEstimatedLedgerCloseTimeSeconds, findDefaultAsset } from "@x402/stellar";
import { PASSPHRASE, server, policyError } from "./config.mjs";

// Simulation needs a source account; the facilitator replaces it with its own.
const NULL_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

function transferTx(source, asset, from, to, amount, auth) {
  const call = new Contract(asset).call(
    "transfer",
    nativeToScVal(from, { type: "address" }),
    nativeToScVal(to, { type: "address" }),
    nativeToScVal(BigInt(amount), { type: "i128" }),
  );
  const op = auth ? Operation.invokeHostFunction({ func: call.body().invokeHostFunctionOp().hostFunction(), auth }) : call;
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(op)
    .setTimeout(300)
    .build();
}

/** The last ledger a signature may be valid for, matching the facilitator's check. */
export async function signatureDeadline(network, maxTimeoutSeconds = 60) {
  const latest = await server.getLatestLedger();
  const secs = await getEstimatedLedgerCloseTimeSeconds(network);
  return latest.sequence + Math.ceil(maxTimeoutSeconds / secs);
}

/**
 * Build and sign transfer(policy, payTo, amount) on `asset`.
 * Returns the signed transaction plus both simulations. `ok` is false when the
 * enforcing simulation fails, and `policyError` names the policy's error.
 */
export async function buildPayment({ signer, asset, payTo, amount, validUntilLedger, source }) {
  const src = source || new Account(NULL_ACCOUNT, "0");
  const unsigned = transferTx(src, asset, signer.address, payTo, amount);
  const recording = await server.simulateTransaction(unsigned);
  if (!rpc.Api.isSimulationSuccess(recording)) {
    // Fails before any auth check, e.g. the wallet can't cover the amount.
    const why = /balance is not sufficient/.test(recording.error) ? "the wallet's balance is too low" : recording.error.split("\n")[0];
    throw new Error(`can't build the payment: ${why}`);
  }
  const auth = await Promise.all(
    recording.result.auth.map((e) => (signer.owns(e) ? signer.authorize(e, validUntilLedger) : e)),
  );

  const signed = transferTx(src, asset, signer.address, payTo, amount, auth);
  const enforcing = await server.simulateTransaction(signed);
  const ok = rpc.Api.isSimulationSuccess(enforcing);
  // assembleTransaction keeps our signed auth entries and adds footprint and fees.
  const transaction = rpc.assembleTransaction(signed, ok ? enforcing : recording).build();
  return {
    ok,
    transaction,
    auth,
    recording,
    enforcing,
    error: ok ? undefined : enforcing.error,
    policyError: ok ? undefined : policyError(enforcing.error),
  };
}

export class PolicyRefused extends Error {
  constructor(payment) {
    super(`policy refused the payment: ${payment.policyError || payment.error}`);
    this.payment = payment;
  }
}

/**
 * An x402 client scheme ("exact" on Stellar) that pays from the policy wallet.
 * With localCheck (the default) it refuses locally when the enforcing simulation
 * fails, like the stock client. With localCheck off it sends the payment anyway,
 * which is what a buggy or prompt-injected agent would do, so the facilitator
 * and the network have to stop it.
 */
export class PolicyExactScheme {
  constructor(signer, { localCheck = true } = {}) {
    this.scheme = "exact";
    this.signer = signer;
    this.localCheck = localCheck;
    this.last = undefined;
    // x402Client's spend controls only allow assets the scheme recognizes (USDC).
    this.findDefaultAsset = findDefaultAsset;
  }

  async createPaymentPayload(x402Version, requirements) {
    const { network, payTo, asset, amount, maxTimeoutSeconds, extra } = requirements;
    if (!extra?.areFeesSponsored) throw new Error("exact scheme requires areFeesSponsored");
    const validUntilLedger = await signatureDeadline(network, maxTimeoutSeconds);
    const payment = await buildPayment({ signer: this.signer, asset, payTo, amount, validUntilLedger });
    this.last = { requirements, payment };
    if (!payment.ok && this.localCheck) throw new PolicyRefused(payment);
    return { x402Version, payload: { transaction: payment.transaction.toXDR() } };
  }
}
