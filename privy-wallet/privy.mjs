#!/usr/bin/env node
// A Stellar wallet whose private key lives in Privy's TEE. The Stellar CLI builds
// transactions; this tool shows what they do and, only with --yes, has Privy sign.
//
//   node privy.mjs create                       make the wallet once, save wallet.json
//   node privy.mjs address                      print its G... address
//   <unsigned XDR> | node privy.mjs sign --network testnet [--yes]
//   node privy.mjs buy <url> --network testnet [--max 0.10] [--yes]
//
// Needs PRIVY_APP_SECRET in the environment (never printed). The App ID and wallet
// id are not secret; they live in wallet.json.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Address, Keypair, Networks, TransactionBuilder, FeeBumpTransaction, scValToNative, StrKey } from "@stellar/stellar-sdk";

const PRIVY_API = "https://api.privy.io";
const WALLET_FILE = process.env.PRIVY_WALLET_FILE || join(dirname(fileURLToPath(import.meta.url)), "wallet.json");

const NETWORKS = {
  testnet: { passphrase: Networks.TESTNET, caip2: "stellar:testnet", rpc: "https://soroban-testnet.stellar.org/" },
  mainnet: { passphrase: Networks.PUBLIC, caip2: "stellar:pubnet", rpc: "https://mainnet.sorobanrpc.com/" },
};

function fail(msg, code = 1) {
  console.error(`error: ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes") opts.yes = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

function network(opts) {
  const n = NETWORKS[opts.network];
  if (!n) fail("pass --network testnet or --network mainnet");
  return { name: opts.network, ...n, rpc: opts["rpc-url"] || process.env.STELLAR_RPC_URL || n.rpc };
}

function loadWallet() {
  if (!existsSync(WALLET_FILE)) fail(`no wallet yet (${WALLET_FILE}); run: node privy.mjs create`);
  return JSON.parse(readFileSync(WALLET_FILE, "utf8"));
}

async function privy(appId, method, path, body) {
  const secret = process.env.PRIVY_APP_SECRET;
  if (!secret) fail("PRIVY_APP_SECRET is not set in this environment");
  const res = await fetch(`${PRIVY_API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`,
      "privy-app-id": appId,
      "Content-Type": "application/json",
    },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Privy ${method} ${path} -> ${res.status}: ${text}`);
  return JSON.parse(text);
}

// Privy's Tier-2 primitive: Ed25519-sign exactly this 32-byte hash, no re-hashing.
// The signature is checked against the wallet's address before it's used.
async function rawSign(wallet, hash) {
  const hash32 = Buffer.from(hash); // stellar-sdk 17 hands out Uint8Arrays, which have no hex toString
  if (hash32.length !== 32) throw new Error(`expected a 32-byte hash, got ${hash32.length}`);
  const r = await privy(wallet.appId, "POST", `/v1/wallets/${wallet.id}/raw_sign`, {
    params: { hash: `0x${hash32.toString("hex")}` },
  });
  const hex = r.data?.signature ?? r.signature;
  if (!hex) throw new Error(`unexpected raw_sign response: ${JSON.stringify(r)}`);
  const sig = Buffer.from(hex.replace(/^0x/, ""), "hex");
  if (!Keypair.fromPublicKey(wallet.address).verify(hash32, sig)) {
    throw new Error("Privy's signature does not verify against the wallet address");
  }
  return sig;
}

// --- create / address --------------------------------------------------------

async function create(opts) {
  if (existsSync(WALLET_FILE)) fail(`${WALLET_FILE} already exists; one wallet is enough`);
  const appId = opts["app-id"] || process.env.PRIVY_APP_ID;
  if (!appId) fail("pass --app-id <PRIVY_APP_ID>");
  const w = await privy(appId, "POST", "/v1/wallets", { chain_type: "stellar" });
  if (!w.id || !StrKey.isValidEd25519PublicKey(w.address ?? "")) throw new Error(`unexpected response: ${JSON.stringify(w)}`);
  const wallet = { appId, id: w.id, address: w.address, owner: w.owner_id ?? null, createdAt: new Date().toISOString() };
  writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 2) + "\n");
  console.error(`created Privy Stellar wallet ${wallet.id}, saved to ${WALLET_FILE}`);
  console.log(wallet.address);
}

// --- sign ----------------------------------------------------------------------

function describeOp(op) {
  const out = { type: op.type };
  if (op.source) out.source = op.source;
  for (const k of ["destination", "amount", "startingBalance", "limit", "sendMax", "sendAmount", "destAmount", "destMin", "selling", "buying", "price", "offerId",
    "liquidityPoolId", "maxAmountA", "maxAmountB", "minPrice", "maxPrice", "minAmountA", "minAmountB"]) {
    if (op[k] !== undefined) out[k] = String(op[k]);
  }
  for (const k of ["asset", "line", "sendAsset", "destAsset"]) {
    if (op[k] !== undefined) out[k] = op[k].toString();
  }
  if (op.type === "invokeHostFunction") {
    // stellar-sdk 17 decodes XDR into plain objects (no .switch()/.value() accessors).
    const c = op.func.invokeContract;
    if (c) {
      out.contract = Address.fromScAddress(c.contractAddress).toString();
      out.function = Buffer.from(c.functionName.bytes ?? c.functionName).toString();
      out.args = c.args.map((a) => scValToNative(a));
    } else {
      out.function = op.func.type;
    }
  }
  return out;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.on("error", reject);
  });
}

async function sign(opts) {
  const wallet = loadWallet();
  const net = network(opts);
  const xdr = opts._[1] || (await readStdin());
  if (!xdr) fail("pipe an unsigned transaction XDR into stdin");
  const tx = TransactionBuilder.fromXDR(xdr, net.passphrase);
  if (tx instanceof FeeBumpTransaction) fail("fee-bump transactions aren't supported");

  const summary = {
    network: net.name,
    signer: wallet.address,
    txSource: tx.source,
    feeXlm: (Number(tx.fee) / 1e7).toFixed(7),
    operations: tx.operations.map(describeOp),
  };
  console.error(JSON.stringify(summary, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  if (tx.source !== wallet.address) console.error(`warning: the transaction source is not this wallet`);
  if (!opts.yes) fail("not signed; re-run with --yes once the summary above is approved", 3);

  const hash = Buffer.from(tx.hash());
  const sig = await rawSign(wallet, hash);
  tx.addSignature(wallet.address, sig.toString("base64"));
  console.error(`signed tx ${hash.toString("hex")}`);
  console.log(tx.toXDR());
}

// --- buy (x402) -------------------------------------------------------------------

function privySigner(wallet) {
  return {
    address: wallet.address,
    // The x402 client passes the base64 auth-entry preimage; Stellar signs its SHA-256.
    signAuthEntry: async (preimageB64) => {
      const hash = createHash("sha256").update(Buffer.from(preimageB64, "base64")).digest();
      const sig = await rawSign(wallet, hash);
      return { signedAuthEntry: sig.toString("base64"), signerAddress: wallet.address };
    },
  };
}

async function buy(opts) {
  const wallet = loadWallet();
  const net = network(opts);
  const url = opts._[1];
  if (!url) fail("usage: node privy.mjs buy <url> --network testnet [--max 0.10] [--yes]");
  const maxStroops = BigInt(Math.round(Number(opts.max ?? "0.10") * 1e7));

  // Look at the price first, without paying.
  const probe = await fetch(url);
  const header = probe.headers.get("payment-required");
  if (probe.status !== 402 || !header) fail(`expected HTTP 402 with a payment-required header, got ${probe.status}`);
  const terms = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  const offers = (terms.accepts ?? []).filter((a) => a.network === net.caip2);
  if (offers.length === 0) fail(`the seller doesn't accept ${net.caip2}`);
  console.error(JSON.stringify({ url, network: net.caip2, payer: wallet.address, offers: offers.map((a) => ({ scheme: a.scheme, amountUsdc: Number(a.amount) / 1e7, asset: a.asset, payTo: a.payTo })) }, null, 2));
  const tooPricey = offers.filter((a) => BigInt(a.amount) > maxStroops);
  if (tooPricey.length) fail(`price is above --max ${Number(maxStroops) / 1e7}`);
  if (!opts.yes) fail("not paid; re-run with --yes once the price above is approved", 3);

  const { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } = await import("@x402/fetch");
  const { ExactStellarScheme } = await import("@x402/stellar/exact/client");
  const payFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: net.caip2, client: new ExactStellarScheme(privySigner(wallet), { url: net.rpc }) }],
  });
  const res = await payFetch(url);
  console.error(`status: ${res.status}`);
  const receipt = res.headers.get("payment-response");
  if (receipt) console.error("payment-response:", JSON.stringify(decodePaymentResponseHeader(receipt)));
  console.log(await res.text());
}

// --- main -------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
const commands = { create, address: async () => console.log(loadWallet().address), sign, buy };
const cmd = commands[opts._[0]];
if (!cmd) fail("usage: node privy.mjs <create|address|sign|buy> (see README.md)");
await cmd(opts).catch((e) => fail(e.message));
