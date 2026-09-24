// Offline check of create + sign against the Privy mock with a throwaway key:
// the signed envelope must verify, and nothing is signed without --yes.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kp = Keypair.random();
const env = {
  ...process.env,
  PRIVY_MOCK_SECRET: kp.secret(),
  PRIVY_APP_SECRET: "test-secret",
  PRIVY_WALLET_FILE: join(mkdtempSync(join(tmpdir(), "privy-")), "wallet.json"),
};
const run = (args, input) =>
  spawnSync("node", ["--import", "./test/mock-privy.mjs", "privy.mjs", ...args], { cwd: root, env, input, encoding: "utf8" });
const check = (ok, msg) => {
  if (!ok) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
};

const created = run(["create", "--app-id", "test-app"]);
check(created.status === 0 && created.stdout.trim() === kp.publicKey(), "create saves the wallet and prints its address");
check(run(["create", "--app-id", "test-app"]).status !== 0, "create refuses to overwrite an existing wallet");

const tx = new TransactionBuilder(new Account(kp.publicKey(), "1"), { fee: "100", networkPassphrase: Networks.TESTNET })
  .addOperation(Operation.payment({ destination: Keypair.random().publicKey(), asset: Asset.native(), amount: "1.5" }))
  .setTimeout(300)
  .build()
  .toXDR();

const dry = run(["sign", "--network", "testnet"], tx);
check(dry.status === 3 && dry.stdout === "" && dry.stderr.includes('"amount": "1.5000000"'), "sign without --yes shows the summary and signs nothing");

const signed = run(["sign", "--network", "testnet", "--yes"], tx);
check(signed.status === 0, `sign --yes succeeds${signed.status ? ": " + signed.stderr.split("\n").slice(-2).join(" ") : ""}`);
// Ed25519 is deterministic, so signing locally with the same key must give the same envelope.
const signLocally = (passphrase) => {
  const t = TransactionBuilder.fromXDR(tx, passphrase);
  t.sign(kp);
  return t.toXDR();
};
check(signed.stdout.trim() === signLocally(Networks.TESTNET), "the envelope matches one signed locally with the same key");

const mainnet = run(["sign", "--network", "mainnet", "--yes"], tx);
check(mainnet.stdout.trim() === signLocally(Networks.PUBLIC) && mainnet.stdout !== signed.stdout, "signing is bound to the chosen network");

const noSecret = spawnSync("node", ["--import", "./test/mock-privy.mjs", "privy.mjs", "sign", "--network", "testnet", "--yes"], {
  cwd: root, env: { ...env, PRIVY_APP_SECRET: "" }, input: tx, encoding: "utf8",
});
check(noSecret.status !== 0 && noSecret.stdout === "", "without PRIVY_APP_SECRET nothing is signed");
console.log("all passed");
