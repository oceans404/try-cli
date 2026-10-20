// The agent: buys from an x402 seller, paying from the policy wallet.
// Usage: node buy-agent.mjs [URL] [--no-local-check]
//   --no-local-check  send the payment even if the agent's own simulation says
//                     the policy refuses it (what a misbehaving agent would do)
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { PASSPHRASE, SELLERS, env, usdc, short, txLink } from "./config.mjs";
import { createPolicySigner } from "./signer.mjs";
import { PolicyExactScheme } from "./payment.mjs";

/**
 * One purchase. Returns { stage, status, terms, payment, settle, body, refusal }:
 * stage is "paid", "agent" (refused locally) or "seller" (seller answered 402
 * again because the facilitator refused).
 */
export async function buy(url, { localCheck = true, agent = env.agent } = {}) {
  const signer = createPolicySigner(agent, env.policy, PASSPHRASE);
  const scheme = new PolicyExactScheme(signer, { localCheck });
  const http = new x402HTTPClient(new x402Client().register("stellar:*", scheme));

  const first = await fetch(url);
  if (first.status !== 402) return { stage: "free", status: first.status, body: await first.text() };
  const paymentRequired = http.getPaymentRequiredResponse((n) => first.headers.get(n), await first.json().catch(() => undefined));
  const terms = paymentRequired.accepts[0];

  let payload;
  try {
    payload = await http.createPaymentPayload(paymentRequired);
  } catch (e) {
    if (scheme.last && !scheme.last.payment.ok) return { stage: "agent", status: 402, terms, payment: scheme.last.payment };
    throw e;
  }

  const res = await fetch(url, { headers: http.encodePaymentSignatureHeader(payload) });
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
  console.log(`payer          ${env.policy} (agent_policy wallet)`);
  console.log(`status         ${r.status} (${r.stage})`);
  if (r.payment?.policyError) console.log(`policy         ${r.payment.policyError}`);
  if (r.refusal) console.log(`refusal        ${r.refusal}`);
  if (r.settle?.transaction) console.log(`tx             ${txLink(r.settle.transaction)}`);
  console.log(`body           ${typeof r.body === "string" ? r.body : JSON.stringify(r.body)}`);
}
