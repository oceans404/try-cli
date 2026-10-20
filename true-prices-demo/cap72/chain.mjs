// Small read helpers: call a contract function in simulation and decode the result.
import { Account, BASE_FEE, Contract, TransactionBuilder, nativeToScVal, scValToNative, rpc } from "@stellar/stellar-sdk";
import { PASSPHRASE, server, env } from "./config.mjs";

const NULL_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export async function read(contractId, method, ...args) {
  const tx = new TransactionBuilder(new Account(NULL_ACCOUNT, "0"), { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) throw new Error(`${method} failed: ${sim.error}`);
  return scValToNative(sim.result.retval);
}

export const addr = (a) => nativeToScVal(a, { type: "address" });
export const balanceOf = (who) => read(env.usdc, "balance", addr(who));
export const rules = () => read(env.policy, "rules");
export const spentToday = () => read(env.policy, "spent_today");
export const policyOwner = () => read(env.policy, "owner");
// Version B+ only: agent_wallet's delegated signers and threshold.
export const walletSigners = () => read(env.wallet, "signers");
export const walletThreshold = () => read(env.wallet, "threshold");

/** Rules as the JSON the Stellar CLI takes for `update_rules --rules`. */
export function rulesToCliJson(r) {
  return JSON.stringify({
    agent_pubkey: Buffer.from(r.agent_pubkey).toString("hex"),
    token: r.token,
    max_per_payment: String(r.max_per_payment),
    daily_cap: String(r.daily_cap),
    allowed_sellers: r.allowed_sellers,
  });
}
