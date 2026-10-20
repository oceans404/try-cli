# CAP-72 agent wallet demo

An AI agent pays an x402 API from a wallet whose spending rules ($1 per payment,
$2 a day, one allowed seller) are enforced by the network, not by the agent's
code. A buggy or prompt-injected agent can try whatever it likes; the policy
contract says no.

This folder is the working **version B**: it runs today on Stellar testnet, with
the wallet as a smart account (a C-address). **Version A** is the same demo on a
local network patched with [CAP-72](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0072.md),
where the wallet is a plain G-account that any exchange can fund. Its host patch
and the plan for the rest are in [`version-a/`](version-a/).

| Read | For |
| --- | --- |
| [The slides](https://claude.ai/artifact/6HJq4iDijBRNoxR5Cwqqp2) | 12 slides: what we built, what it showed, CAP-72a, next steps (private until shared) |
| This page | Running it, what you'll see, what we found |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How every piece connects, versions A and B, the local CAP-72 network |
| [version-a/CAP72-OBJECTIONS-AND-IMPROVEMENTS.md](version-a/CAP72-OBJECTIONS-AND-IMPROVEMENTS.md) | Why CAP-72 stalled, what we'd change (CAP-72a), a pitch for the thread |
| [version-a/HOST-PATCH.md](version-a/HOST-PATCH.md) | The soroban-env-host patch that implements CAP-72a |
| [../vendor/x402-stellar/PORT.md](../vendor/x402-stellar/PORT.md) | Our port of `@x402/stellar` to `@stellar/stellar-sdk` 17, with delegated credentials and custom-account signers |
| [CAP72-demo-spec.md](CAP72-demo-spec.md) | The original build spec |

## Run it

You need Node 20+, Rust with the `wasm32v1-none` target, and the
[Stellar CLI](https://developers.stellar.org/docs/tools/cli) (tested with 28.1.0).

```bash
cd true-prices-demo && npm install && cd cap72 && npm install
NETWORK=testnet ./setup-b.sh      # identities, 30 testnet USDC, deploys agent_policy, writes .env
npm run demo                      # four steps, press Enter between them
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

`setup-b.sh` is safe to re-run. `./setup-b.sh --redeploy` deploys a fresh
contract, which also resets the day's spending: do that before each
presentation so the numbers match the run below.

Everything is testnet. `.env` holds testnet secrets and is git-ignored.

## What you'll see

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
npm run test:contract                        # agent_policy unit tests (7)
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

## Known limits

* Version B's wallet is a C-address, so step 1 has to fund it with a contract
  `transfer`. That's the step CAP-72 fixes, and version A shows it.
* `__check_auth` traps (it doesn't return `BadSignature`) when the public key
  matches but the signature is wrong, because `ed25519_verify` panics. A
  rotated-out key gets the typed error because the public key no longer matches.
* The facilitator is local and single-process. It's a demo, not a service.
