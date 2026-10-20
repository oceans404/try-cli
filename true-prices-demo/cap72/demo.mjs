// The demo runner (version B, testnet). Starts the facilitator and three sellers
// in the background, then walks through the four steps, pausing for Enter.
//
//   npm run demo                              steps 1 to 4 (run ./setup-b.sh --redeploy first for a clean run)
//   npm run demo -- --rules max=3,daily=10    owner changes the caps, then step 4 again
//   npm run demo -- --allow <G-address>       owner allowlists a seller, then step 4 again
//   npm run demo -- --agent-key new           owner rotates the agent key; the old key is refused
//   add --yes to skip the pauses
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { HERE, FACILITATOR_URL, SELLERS, env, usd, usdc, short, txLink, need } from "./config.mjs";
import { balanceOf, rules as readRules, spentToday, policyOwner, rulesToCliJson } from "./chain.mjs";
import { buy } from "./buy-agent.mjs";
import * as direct from "./direct-submit.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1] ?? true;
};
const YES = argv.includes("--yes");
const CLI_NETWORK = process.env.CLI_NETWORK || "testnet-relay";
const children = [];

// ---------- output ----------
const B = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const row = (label, value, width = 15) => console.log(`  ${label.padEnd(width)}${value}`);
const rl = createInterface({ input: process.stdin, output: process.stdout });
async function pause() {
  if (YES) return console.log();
  await rl.question(dim("[Enter to continue]"));
  console.log();
}

// ---------- background services ----------
async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`${url} didn't come up; see logs/`);
}

function start(name, script, cwd, extraEnv) {
  mkdirSync(join(HERE, "logs"), { recursive: true });
  const out = openSync(join(HERE, "logs", `${name}.log`), "w");
  const child = spawn(process.execPath, [script], { cwd, env: { ...process.env, ...extraEnv }, stdio: ["ignore", out, out] });
  children.push(child);
}

async function startServices() {
  start("facilitator", "facilitator.mjs", HERE, {});
  await waitFor(`${FACILITATOR_URL}/supported`);
  const seller = (port, payTo, price) =>
    start(`seller-${port}`, "server.js", join(HERE, ".."), {
      PORT: String(port),
      STELLAR_RECIPIENT: payTo,
      PRICE: price,
      FACILITATOR_URL,
      STELLAR_NETWORK: process.env.STELLAR_NETWORK || "stellar:testnet",
    });
  seller(3001, env.seller, "$1.00"); // the allowed seller
  seller(3002, env.otherSeller, "$1.00"); // not on the allowlist
  seller(3003, env.seller, "$2.00"); // allowed seller, but over the per-payment cap
  await Promise.all([3001, 3002, 3003].map((p) => waitFor(`http://localhost:${p}/`)));
}

function stopServices() {
  for (const c of children) c.kill();
  rl.close();
}

async function facilitatorReason(since) {
  const log = await (await fetch(`${FACILITATOR_URL}/log`)).json();
  const v = log.filter((e) => e.kind === "verify" && e.at >= since).at(-1);
  return v && !v.isValid ? v.invalidReason : undefined;
}

// ---------- the CLI, for the owner's and funder's actions ----------
function cli(args, { allowFail = false } = {}) {
  try {
    return execFileSync("stellar", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    if (!allowFail) throw new Error(`stellar ${args.join(" ")}\n${e.stderr || e.message}`);
    return { failed: true, stderr: (e.stderr || e.message).trim() };
  }
}

function updateRules(next) {
  cli(["contract", "invoke", "--id", env.policy, "--source", "cap72-owner", "--network", CLI_NETWORK, "--", "update_rules", "--rules", rulesToCliJson(next)]);
}

// ---------- steps ----------
async function step1() {
  console.log(B("STEP 1  Fund the agent wallet"));
  const before = await balanceOf(env.policy);
  if (before > 0n) console.log(dim(`  (the wallet already holds ${usdc(before)}; run ./setup-b.sh --redeploy for a clean run)`));
  row("agent wallet", `${short(env.policy)}  (agent_policy, a smart account C-address)`);

  const classic = cli(
    ["tx", "new", "payment", "--source", "cap72-funder", "--network", CLI_NETWORK, "--destination", env.policy,
      "--asset", `USDC:${need("USDC_ISSUER")}`, "--amount", "100000000"],
    { allowFail: true },
  );
  const why = classic.failed ? classic.stderr.split("\n").find((l) => /error/i.test(l)) || classic.stderr.split("\n")[0] : "it went through?";
  row("classic Payment", `${red("FAILED")}  ${why}`);
  console.log(dim("  A classic Payment can't send to a C-address. This is the step CAP-72 turns into a plain payment."));

  const out = cli(["contract", "invoke", "--id", env.usdc, "--source", "cap72-funder", "--network", CLI_NETWORK, "--",
    "transfer", "--from", env.funder.publicKey(), "--to", env.policy, "--amount", "100000000"]);
  void out;
  const after = await balanceOf(env.policy);
  row("sent", "10.00 USDC via the USDC contract's transfer (not a classic payment)");
  row("balance", usdc(after));
  await pause();
}

async function step2() {
  const r = await readRules();
  const owner = await policyOwner();
  console.log(B("STEP 2  Owner attaches the spending policy"));
  row("wallet", `${short(env.policy)}  agent_policy`, 19);
  row("owner", `${short(owner)}  (the only key that can change the rules)`, 19);
  row("rules", `max ${usd(r.max_per_payment)} per payment, ${usd(r.daily_cap)} per day`, 19);
  row("", `allowed sellers: ${r.allowed_sellers.map((s) => `${short(s)}${s === env.seller ? " (Price check demo)" : ""}`).join(", ")}`, 19);
  const agentG = StrKey.encodeEd25519PublicKey(Buffer.from(r.agent_pubkey));
  row("agent key", `${short(agentG)}  held by the agent only, NOT a signer on any account`, 19);
  await pause();
}

async function step3() {
  console.log(B("STEP 3  Agent buys a price check ($1.00)"));
  const r = await readRules();
  const spent = await spentToday();
  const res = await buy(`${SELLERS.allowed}?item=airpods-pro-3`);
  row("402 terms", `${usdc(res.terms.amount)} to ${short(res.terms.payTo)}`);
  row("policy check", `seller allowed, ${usd(res.terms.amount)} <= ${usd(r.max_per_payment)}, today ${usd(spent + BigInt(res.terms.amount))} of ${usd(r.daily_cap)}`);
  if (res.stage === "paid") {
    row("result", `${green("200 OK")}  Best price for ${res.body.item}: $${res.body.best} at ${res.body.store}`);
    row("tx", `${txLink(res.settle.transaction)}  SUCCESS  ${usdc(res.terms.amount)} agent -> seller`);
  } else {
    row("result", red(`${res.status} ${res.payment?.policyError || res.refusal || ""}`));
  }
  row("balance", usdc(await balanceOf(env.policy)));
  await pause();
  return res;
}

async function attempt(label, url, { localCheck = false } = {}) {
  const since = new Date().toISOString();
  const r = await buy(url, { localCheck });
  const spent = await spentToday();
  const cap = (await readRules()).daily_cap;
  if (r.stage === "paid") {
    console.log(`  ${label.padEnd(25)}${green("200 OK")}                   today ${usd(spent)} of ${usd(cap)}   ${dim(txLink(r.settle.transaction))}`);
  } else if (r.stage === "agent") {
    console.log(`  ${label.padEnd(25)}${red("REFUSED by the agent")}     policy: ${r.payment.policyError}`);
  } else {
    const reason = (await facilitatorReason(since)) || r.refusal;
    console.log(`  ${label.padEnd(25)}${red("REFUSED by facilitator")}   policy: ${r.payment?.policyError || "?"}   ${dim(reason || "")}`);
  }
  return r;
}

async function step4({ directSubmit = true } = {}) {
  console.log(B("STEP 4  Agent tries to break the rules"));
  console.log(dim("  The agent skips its own policy check here, like a buggy or prompt-injected agent would."));
  // The direct submission borrows a valid $1 payment's footprint, which can only
  // be simulated while $1 still fits under today's cap, so take it now.
  const prepared = directSubmit ? await direct.prepare() : undefined;
  const results = [];
  results.push(await attempt("$2.00 lookup", `${SELLERS.expensive}?item=dyson-v15`));
  results.push(await attempt("unapproved seller", `${SELLERS.unapproved}?item=flight-sfo-lis`));
  results.push(await attempt("2nd $1.00 lookup", `${SELLERS.allowed}?item=dyson-v15`));
  results.push(await attempt("3rd $1.00 lookup", `${SELLERS.allowed}?item=flight-sfo-lis`));
  if (prepared) {
    const d = await direct.submit(prepared);
    const status = d.status === "SUCCESS" ? green("SUCCESS onchain") : red(`${d.status} onchain`);
    console.log(`  ${"direct submit ($2.00)".padEnd(25)}${status.padEnd(33)}policy: ${d.onchain || d.simulated || "?"}   ${dim(txLink(d.hash))}`);
    results.push({ direct: d });
  } else {
    console.log(dim("  direct submit skipped: with these rules a $2.00 payment is allowed and would move real money"));
  }
  console.log(`  ${"balance".padEnd(25)}${usdc(await balanceOf(env.policy))}`);
  return results;
}

// ---------- live edits ----------
async function edits() {
  let r = await readRules();
  let edited = false;
  const rulesFlag = flag("--rules");
  if (typeof rulesFlag === "string") {
    const kv = Object.fromEntries(rulesFlag.split(",").map((p) => p.split("=")));
    if (kv.max) r.max_per_payment = BigInt(Math.round(Number(kv.max) * 1e7));
    if (kv.daily) r.daily_cap = BigInt(Math.round(Number(kv.daily) * 1e7));
    edited = true;
  }
  const allow = flag("--allow");
  if (typeof allow === "string") {
    if (!StrKey.isValidEd25519PublicKey(allow) && !StrKey.isValidContract(allow)) throw new Error(`not an address: ${allow}`);
    if (!r.allowed_sellers.includes(allow)) r.allowed_sellers.push(allow);
    edited = true;
  }
  if (flag("--agent-key")) {
    const old = env.agent;
    const fresh = Keypair.random();
    r.agent_pubkey = fresh.rawPublicKey();
    updateRules(r);
    const envPath = join(HERE, ".env");
    writeFileSync(envPath, readFileSync(envPath, "utf8").replace(/^AGENT_SECRET=.*$/m, `AGENT_SECRET=${fresh.secret()}`), { mode: 0o600 });
    console.log(B("LIVE EDIT  Owner rotates the agent key"));
    row("old key", short(old.publicKey()));
    row("new key", `${short(fresh.publicKey())}  (saved to .env)`);
    const res = await buy(`${SELLERS.allowed}?item=airpods-pro-3`, { localCheck: false, agent: old });
    row("old key pays", res.stage === "paid" ? red("200 OK (unexpected)") : `${red("REFUSED")}  policy: ${res.payment?.policyError}`);
    return { done: true };
  }
  if (!edited) return { done: false };
  updateRules(r);
  r = await readRules();
  console.log(B("LIVE EDIT  Owner updates the rules (update_rules, owner auth)"));
  row("rules", `max ${usd(r.max_per_payment)} per payment, ${usd(r.daily_cap)} per day`);
  row("allowed", r.allowed_sellers.map(short).join(", "));
  console.log();
  // Rerun step 4. Skip the direct submission whenever $2.00 would now pass.
  await step4({ directSubmit: r.max_per_payment < 20_000_000n });
  return { done: true };
}

// ---------- main ----------
try {
  await startServices();
  console.log(dim(`facilitator and sellers running; logs in ${join(HERE, "logs")}\n`));
  const live = await edits();
  if (!live.done) {
    await step1();
    await step2();
    await step3();
    await step4();
  }
} catch (e) {
  console.error(red(e.stack || String(e)));
  process.exitCode = 1;
} finally {
  stopServices();
}
