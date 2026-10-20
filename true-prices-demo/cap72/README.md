# CAP-72 agent wallet demo

An AI agent pays an x402 API from a wallet whose spending rules ($1 per payment,
$2 a day, one allowed seller) are enforced by the network, not by the agent's
code. A buggy or prompt-injected agent can try whatever it likes; the policy
contract says no.

Three versions, from what runs today to what CAP-72 would add:

| Version | Wallet | Runs | What it shows |
| --- | --- | --- | --- |
| **B** | `agent_policy` itself, a smart account | testnet | Onchain spending rules a misbehaving agent can't get around |
| **B+** | `agent_wallet`, a smart account that delegates to `agent_policy` through CAP-71-01 | testnet | The same, through the exact delegation mechanism and credential type CAP-72 reuses |
| **A** | a plain G-account with `agent_policy` as a delegated signer ([CAP-72](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0072.md)) | local network, not built yet | What CAP-72 adds: an exchange funds the wallet with a classic payment |

B+ is the one to present. The only thing it can't show is the step CAP-72
itself adds: a G-account taking the contract as a signer. Version A's host patch
and the plan for the rest are in [`version-a/`](version-a/).

| Read | For |
| --- | --- |
| [The slides](https://claude.ai/artifact/6HJq4iDijBRNoxR5Cwqqp2) | The deck: what we built, what it showed, why CAP-72 stalled, next steps (private until shared) |
| This page | Running it, what you'll see, what we found |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How every piece connects, versions B, B+ and A, the local CAP-72 network |
| [version-a/CAP72-OBJECTIONS-AND-IMPROVEMENTS.md](version-a/CAP72-OBJECTIONS-AND-IMPROVEMENTS.md) | Why CAP-72 stalled, what we'd change (CAP-72a), a pitch for the thread |
| [version-a/HOST-PATCH.md](version-a/HOST-PATCH.md) | The soroban-env-host patch that implements CAP-72a |
| [../vendor/x402-stellar/PORT.md](../vendor/x402-stellar/PORT.md) | Our port of `@x402/stellar` to `@stellar/stellar-sdk` 17, with delegated credentials and custom-account signers |
| [CAP72-demo-spec.md](CAP72-demo-spec.md) | The original build spec |

## Run it

You need Node 20+, Rust with the `wasm32v1-none` target, and the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli) (tested with 28.1.0).

```bash
cd true-prices-demo && npm install && cd cap72 && npm install
NETWORK=testnet ./setup-b.sh --plus   # B+: identities, 30 testnet USDC, deploys both contracts, writes .env
npm run demo                          # four steps, press Enter between them
```

In a Claude Code cloud session, run `scripts/session-start.sh` from the repo root
first and leave `NETWORK` unset: it defaults to `testnet-relay`, the local relay
the CLI needs to get through the cloud proxy (see the repo's `CLAUDE.md`). The
Node scripts talk to RPC over HTTPS directly: the npm scripts set
`NODE_USE_ENV_PROXY=1`, which routes them through the cloud proxy and does
nothing on a machine without one.

Everything runs on `@stellar/stellar-sdk` 17.2.1 and `@x402/*` 2.28.0, one copy
of each. `@x402/stellar` itself comes from `../vendor/x402-stellar`, our port to
SDK 17 (upstream is still on SDK 16). The `.npmrc` sets `install-links=true` so
npm copies it in and dedupes the SDK.

Leave out `--plus` for version B. `setup-b.sh` is safe to re-run and keeps the
mode of the existing setup. `./setup-b.sh --plus --redeploy` deploys fresh
contracts, which also resets the day's spending: do that before each
presentation so the numbers match the runs below.

Everything is testnet. `.env` holds testnet secrets and is git-ignored.

## What you'll see (version B)

A real run from Oct 20, 2026, on SDK 17 (contract
[`CBASZP…VQYT`](https://stellar.expert/explorer/testnet/contract/CBASZP7456DMYUENQU2DOUXFBBNDLYDVN7HFA47EICAUDNOBUL3FVQYT)):

```text
STEP 1  Fund the agent wallet
  agent wallet     CBASZP…VQYT  (agent_policy, a smart account C-address)
  classic Payment  FAILED  can't build it: destination is invalid (PaymentOp.destination is a MuxedAccount, G or M only)
  This is the step CAP-72 turns into a plain payment.
  sent             10.00 USDC via the USDC contract's transfer (not a classic payment)
  balance          10.00 USDC

STEP 2  Owner attaches the spending policy
  wallet             CBASZP…VQYT  agent_policy
  owner              GBLCAV…EMQL  (the only key that can change the rules)
  rules              max $1.00 per payment, $2.00 per day
                     allowed sellers: GAPVK6…4XQD (Price check demo)
  agent key          GC6SWR…UC6J  held by the agent only, NOT a signer on any account

STEP 3  Agent buys a price check ($1.00)
  402 terms        1.00 USDC to GAPVK6…4XQD
  policy check     seller allowed, $1.00 <= $1.00, today $1.00 of $2.00
  result           200 OK  Best price for airpods-pro-3: $174.50 at Costco
  tx               …/tx/bc47a335…  SUCCESS  1.00 USDC agent -> seller
  balance          9.00 USDC

STEP 4  Agent tries to break the rules
  The agent skips its own policy check here, like a buggy or prompt-injected agent would.
  $2.00 lookup             REFUSED by facilitator   policy: PaymentTooLarge   invalid_exact_stellar_payload_simulation_failed
  unapproved seller        REFUSED by facilitator   policy: SellerNotAllowed   invalid_exact_stellar_payload_simulation_failed
  2nd $1.00 lookup         200 OK                   today $2.00 of $2.00   …/tx/ebd49fec…
  3rd $1.00 lookup         REFUSED by facilitator   policy: DailyCapExceeded   invalid_exact_stellar_payload_simulation_failed
  direct submit ($2.00)    FAILED onchain          policy: PaymentTooLarge   …/tx/b1c0a891…
  balance                  8.00 USDC
```

Step 3 is a well-behaved agent, so it pays with the stock x402 client (through
the ported package's custom-signer support). Step 4 uses `PolicyExactScheme`,
which sends the payment even after its own simulation fails.

The transactions:

| What | Transaction |
| --- | --- |
| Step 3, first $1.00 purchase | [bc47a335…](https://stellar.expert/explorer/testnet/tx/bc47a33520186971e61ea514c31a508ec15e180fd75d9a54b3d43f6b97ef4d05) |
| Step 4, second $1.00 purchase | [ebd49fec…](https://stellar.expert/explorer/testnet/tx/ebd49fec0dd653ed44ea333ab42a75a81ba7a76a537d0cdfb75d3310ee991ac3) |
| Step 4, $2.00 direct submission, failed in `__check_auth` | [b1c0a891…](https://stellar.expert/explorer/testnet/tx/b1c0a8915c62d7fc38c716744c3340a837f5da6903613e7a06cb965ab67d8754) |

The three refusals never reach the chain: the facilitator simulates each payment,
the policy fails it, and the seller answers 402 again. That's how x402 is meant
to behave. The direct submission goes around the facilitator, so the network
itself has to say no, and it does: the transaction is in a ledger, marked
failed, and its diagnostic events carry the policy's `PaymentTooLarge` error.

## Version B+: real CAP-71 delegation

In B+ the money sits in `agent_wallet`, which stands in for a CAP-72a
G-account. Its `__check_auth` checks no signature of its own. It reads the
delegates attached to the auth entry, checks each is one of its signers with
enough weight, and hands the decision to them with CAP-71-01's
`delegate_auth`. `agent_policy` is its one delegated signer, added by the owner
with `set_signer` (CAP-72a's `SetOptionsOp`). Each payment carries
`SorobanCredentialsAddressWithDelegates`: a void signature for the wallet and
the agent's signature on the `agent_policy` delegate. That's the credential a
CAP-72 G-account payment would carry, on testnet today.

Step 2 shows the wallet's signer list (Oct 20, 2026, wallet
[`CDUS6U…MNY7`](https://stellar.expert/explorer/testnet/contract/CDUS6UQBANQRTNR2BC5VNJKA27U5OCXVGTJQOYLXBX7VQHKAWZWZMNY7)):

```text
STEP 2  Owner attaches the spending policy
  signers on CDUS6U…MNY7
    owner key        GBLCAV…EMQL  (changes signers, like a master key)
    delegated signer CCINYL…NNE6 (agent_policy), weight 1, threshold 1   <- CAP-72 makes this a G-account signer
                     delegates approve payments only, never changes to the wallet (CAP-72a)
  rules              max $1.00 per payment, $2.00 per day
```

Every other step and live edit prints the same results as B. The B+ run's
transactions, each with delegated credentials onchain:

| What | Transaction | Fee (stroops) |
| --- | --- | --- |
| Step 3, first $1.00 purchase | [77360577…](https://stellar.expert/explorer/testnet/tx/773605777569de8f7743141c52b61621770247e8da17bb20eae253a0a5867772) | 26,836 |
| Step 4, second $1.00 purchase | [9797a62e…](https://stellar.expert/explorer/testnet/tx/9797a62e82b47ec926f8e24cf2d37d0bd337a6dd374ede2c779f005ff320f53f) | 13,568 |
| Step 4, $2.00 direct submission, failed in `agent_policy` | [1db561b7…](https://stellar.expert/explorer/testnet/tx/1db561b78efec215b6300e0970ca7a1797193eab53b43e05930fda06852529c7) | 12,558 |

Delegation adds about 450 stroops to a payment (13,568 against 13,115 in B).

`agent_wallet` follows the CAP-72a rules: delegates must be Wasm contracts, and
it refuses delegated authorization for any call on the wallet itself, so the
policy can approve payments but never change the wallet. Its 8 unit tests run
`agent_policy` as a real delegate with delegated credentials (`npm run
test:contract`).

## Live edits

Each one changes the rules onchain with the owner's key (`update_rules`), then
reruns step 4. They spend testnet USDC, so the runner tops the wallet up from the
funder when it runs low. Spending accumulates within a UTC day.

```bash
npm run demo -- --rules max=3,daily=10    # the $2.00 lookup and the 3rd $1.00 now pass
npm run demo -- --allow <G-address>       # the second seller now passes (needs room under the daily cap)
npm run demo -- --agent-key new           # rotate the agent key: the old key gets BadSignature
npm run demo -- --yes                     # no pauses
```

Run in that order after a fresh `--redeploy`, they print (abridged):

```text
--rules max=3,daily=10
  $2.00 lookup             200 OK                   today $4.00 of $10.00
  unapproved seller        REFUSED by facilitator   policy: SellerNotAllowed
  2nd $1.00 lookup         200 OK                   today $5.00 of $10.00
  3rd $1.00 lookup         200 OK                   today $6.00 of $10.00
  direct submit skipped: with these rules a $2.00 payment is allowed and would move real money

--allow <second seller>
  $2.00 lookup             200 OK                   today $8.00 of $10.00
  unapproved seller        200 OK                   today $9.00 of $10.00
  2nd $1.00 lookup         200 OK                   today $10.00 of $10.00
  3rd $1.00 lookup         REFUSED by facilitator   policy: DailyCapExceeded

--agent-key new
  old key pays     REFUSED  policy: BadSignature
  new key pays     REFUSED  policy: DailyCapExceeded (the signature passed; another rule said no)
```

## Pieces you can run alone

```bash
npm run facilitator                          # the local facilitator on :4022
(cd .. && PORT=3001 STELLAR_RECIPIENT=G… npm start)   # a seller
npm run buy:agent -- http://localhost:3001/price-check [--no-local-check]
npm run direct-submit                        # lands one failing $2.00 payment
npm run test:contract                        # agent_policy (7) and agent_wallet (8) unit tests
```

## What we found building it

Things the spec assumed that turned out differently, all checked on testnet:

1. **SDK version.** `@x402/stellar` (2.27 and the newest, 2.28) is built
   against `@stellar/stellar-sdk` 16.3. SDK 17 rebuilt the XDR layer as
   immutable classes with properties (`entry.credentials` is a property,
   `credentials.type` a string), which breaks x402's facilitator and client
   code. We first pinned 16.3, then ported the package to SDK 17
   (`../vendor/x402-stellar`, 192 unit tests and the live testnet integration
   suite pass). The port also accepts CAP-71-01 delegated credentials, which
   version A's payments use, and lets a signer supply its own
   `authorizeEntry` (next item).
2. **Where a bad payment gets stopped first.** The stock x402 client re-simulates
   after signing and refuses locally, and its spend controls cap payments at $1
   by default. Both are the agent's own software, so step 4 turns them off to
   act like a misbehaving agent. The facilitator and the network are the parts a
   compromised agent can't switch off.
3. **The custom signature.** `AssembledTransaction.signAuthEntries` can't pass a
   custom account's `signatureScVal` through its `signAuthEntry` callback, so
   stock `@x402/stellar` can't pay from a smart account with its own signature
   type. `authorizeEntry` can, so the port lets a signer provide one, and
   `signer.mjs` does. A well-behaved agent now pays with the stock client.
4. **The facilitator's refusal reason is generic.** For every policy failure it
   returns `invalid_exact_stellar_payload_simulation_failed`, and its log shows
   the host error `Error(Auth, InvalidAction)`. The runner gets the specific
   policy error from its own simulation, `Error(Contract, #n)`.
5. **Direct submission.** A payment that fails `__check_auth` can't be fully
   simulated, so it has no footprint of its own. `direct-submit.mjs` signs the
   $2 payment's recording simulation (which never runs `__check_auth`) and adds
   the policy's ledger entries from a valid $1 payment's enforcing simulation.
   Verified: the $2 transaction fails in `__check_auth`, not on footprint. The
   $1 template can't be simulated once the daily cap is used up, so the runner
   prepares it at the start of step 4.
6. **Fees, and the facilitator fee ceiling.** With a persistent day-bucket entry,
   the first payment each day cost 409,731 stroops, because a new persistent
   entry pays rent for the network's long minimum TTL. The bucket now lives in
   temporary storage (it only matters for a day), and the same payment costs
   about 26,600. So the stock facilitator's 50,000-stroop ceiling isn't a blocker for
   this design, and `facilitator.mjs` runs `ExactStellarScheme` with stock
   settings. The spec's 290k figure came from the heavier OpenZeppelin stack.

Fees on testnet (fee charged, stroops, SDK 17 run):

| Payment | Fee |
| --- | --- |
| Plain G-account x402 payment, same facilitator, for comparison | 11,656 |
| Policy payment, not the first of the day | 13,115 |
| Policy payment, first of the day (creates the day bucket) | 26,644 |
| Failed direct submission | 12,020 |

So the onchain policy adds about 1,500 stroops (0.00015 XLM) to a normal
payment.

7. **Delegated credentials and the stock client.** SDK 17's
   `needsNonInvokerSigningBy` counts an entry with a void top-level signature as
   unsigned even when its delegates have signed. For a delegating account that
   is always the case (`agent_wallet`'s signature type is `()`), so the stock
   x402 client refused every B+ payment. The port now treats an entry signed
   through its delegates as signed (2 new tests, 194 total). Worth reporting to
   js-stellar-sdk.

## Known limits

* Version B's wallet is a C-address, so step 1 has to fund it with a contract
  `transfer`. That's the step CAP-72 fixes, and version A shows it.
* `__check_auth` traps (it doesn't return `BadSignature`) when the public key
  matches but the signature is wrong, because `ed25519_verify` panics. A
  rotated-out key gets the typed error because the public key no longer matches.
* The facilitator is local and single-process. It's a demo, not a service.
