// Shared settings for the demo scripts. setup-b.sh writes .env (git-ignored).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { Keypair, rpc } from "@stellar/stellar-sdk";
import { getNetworkPassphrase } from "@x402/stellar";

export const HERE = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(HERE, ".env"), quiet: true });

export const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
export const PASSPHRASE = getNetworkPassphrase(NETWORK);
export const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
export const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:4022";
export const EXPLORER = process.env.EXPLORER || "https://stellar.expert/explorer/testnet";

export const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });

export function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Run ./setup-b.sh first.`);
  return v;
}

export const env = {
  get usdc() { return need("USDC_SAC"); },
  get policy() { return need("POLICY_ID"); },
  // Version B+: agent_wallet pays and delegates to agent_policy. Version B:
  // agent_policy is the wallet itself.
  get plus() { return Boolean(process.env.WALLET_ID); },
  get wallet() { return process.env.WALLET_ID || need("POLICY_ID"); },
  get seller() { return need("SELLER_ADDRESS"); },
  get otherSeller() { return need("OTHER_SELLER_ADDRESS"); },
  get owner() { return need("OWNER_ADDRESS"); },
  get agent() { return Keypair.fromSecret(need("AGENT_SECRET")); },
  get funder() { return Keypair.fromSecret(need("FUNDER_SECRET")); },
  get facilitator() { return Keypair.fromSecret(need("FACILITATOR_SECRET")); },
};

export const SELLERS = {
  allowed: "http://localhost:3001/price-check",
  unapproved: "http://localhost:3002/price-check",
  expensive: "http://localhost:3003/price-check",
};

// The policy's typed errors, by contract error code.
export const POLICY_ERRORS = {
  1: "PaymentTooLarge",
  2: "SellerNotAllowed",
  3: "DailyCapExceeded",
  4: "BadSignature",
  5: "CallNotAllowed",
  6: "InvalidRules",
  // agent_wallet (version B+)
  101: "NoDelegates",
  102: "UnknownDelegate",
  103: "BelowThreshold",
  104: "DelegatesCantManageWallet",
  105: "NotAContract",
};

/** Pull "Error(Contract, #n)" out of a simulation or result message. */
export function policyError(message) {
  const m = /Error\(Contract, #(\d+)\)/.exec(message || "");
  return m ? POLICY_ERRORS[m[1]] || `contract error #${m[1]}` : undefined;
}

export const usd = (stroops) => `$${(Number(stroops) / 1e7).toFixed(2)}`;
export const usdc = (stroops) => `${(Number(stroops) / 1e7).toFixed(2)} USDC`;
export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
export const txLink = (hash) => `${EXPLORER}/tx/${hash}`;
