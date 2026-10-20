// The agent: buys from an x402 seller, paying from the policy wallet.
// Usage: node buy-agent.mjs [URL] [--no-local-check]
//   --no-local-check  send the payment even if the agent's own simulation says
//                     the policy refuses it (what a misbehaving agent would do)
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import { PASSPHRASE, RPC_URL, SELLERS, env, usdc, short, txLink, policyError } from "./config.mjs";
import { walletSigner } from "./signer.mjs";
import { PolicyExactScheme } from "./payment.mjs";

// Retry once if a pooled keep-alive connection was closed by the seller meanwhile.
async function get(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e.cause?.code !== "UND_ERR_SOCKET") throw e;
    return fetch(url, init);
  }
}

/**
 * One purchase. Returns { stage, status, terms, payment, settle, body, refusal }:
 * stage is "paid", "agent" (refused locally) or "seller" (seller answered 402
 * again because the facilitator refused).
 */
export async function buy(url, { localCheck = true, agent = env.agent } = {}) {
  const signer = walletSigner(agent);
  // A well-behaved agent uses the stock x402 client: the signer's authorizeEntry
  // lets it pay from the policy wallet. A misbehaving one uses PolicyExactScheme,
  // which sends the payment even when its own simulation says the policy refuses.
  const scheme = localCheck
    ? new ExactStellarScheme(signer, { url: RPC_URL })
    : new PolicyExactScheme(signer, { localCheck: false });
  const client = new x402Client().register("stellar:*", scheme);
  // x402's client has its own spend controls (by default, at most $1 per payment).
  // They live in the agent's software, so a misbehaving agent can turn them off.
  if (!localCheck) client.setSpendControls(false);
  const http = new x402HTTPClient(client);

  const first = await get(url);
  if (first.status !== 402) return { stage: "free", status: first.status, body: await first.text() };
  const paymentRequired = http.getPaymentRequiredResponse((n) => first.headers.get(n), await first.json().catch(() => undefined));
  const terms = paymentRequired.accepts[0];

  let payload;
  try {
    payload = await http.createPaymentPayload(paymentRequired);
  } catch (e) {
    if (scheme.last && !scheme.last.payment.ok) return { stage: "agent", status: 402, terms, payment: scheme.last.payment };
    if (/spendControls/.test(e.message)) return { stage: "agent", status: 402, terms, reason: e.message.split(". ")[0] };
    const refused = policyError(e.message);
    if (refused) return { stage: "agent", status: 402, terms, payment: { ok: false, policyError: refused, error: e.message } };
    throw e;
  }

  const res = await get(url, { headers: http.encodePaymentSignatureHeader(payload) });
  const payment = scheme.last?.payment;
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (res.ok) {
    return { stage: "paid", status: res.status, terms, payment, settle: http.getPaymentSettleResponse((n) => res.headers.get(n)), body };
  }
  let refusal;
  try { refusal = http.getPaymentRequiredResponse((n) => res.headers.get(n), body).error; } catch {}
  return { stage: "seller", status: res.status, terms, payment, body, refusal: refusal || body?.error };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--")) || SELLERS.allowed;
  const r = await buy(url, { localCheck: !args.includes("--no-local-check") });
  if (r.terms) console.log(`402 terms      ${usdc(r.terms.amount)} to ${short(r.terms.payTo)}`);
  console.log(`payer          ${env.wallet} (${env.plus ? "agent_wallet, delegating to agent_policy" : "agent_policy wallet"})`);
  console.log(`status         ${r.status} (${r.stage})`);
  if (r.reason) console.log(`refused by      ${r.reason}`);
  if (r.payment?.policyError) console.log(`policy         ${r.payment.policyError}`);
  if (r.refusal) console.log(`refusal        ${r.refusal}`);
  if (r.settle?.transaction) console.log(`tx             ${txLink(r.settle.transaction)}`);
  console.log(`body           ${typeof r.body === "string" ? r.body : JSON.stringify(r.body)}`);
}
