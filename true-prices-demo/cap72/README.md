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
| This page | Running it, what you'll see, what we found |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How every piece connects, versions A and B, the local CAP-72 network |
| [version-a/CAP72-OBJECTIONS-AND-IMPROVEMENTS.md](version-a/CAP72-OBJECTIONS-AND-IMPROVEMENTS.md) | Why CAP-72 stalled, what we'd change (CAP-72a), a pitch for the thread |
| [version-a/HOST-PATCH.md](version-a/HOST-PATCH.md) | The soroban-env-host patch that implements CAP-72a |
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
the CLI needs to get through the cloud proxy (see the repo's `CLAUDE.md`).

`setup-b.sh` is safe to re-run. `./setup-b.sh --redeploy` deploys a fresh
contract, which also resets the day's spending: do that before each
presentation so the numbers match the run below.

Everything is testnet. `.env` holds testnet secrets and is git-ignored.

## What you'll see

A real run from Oct 20, 2026 (contract
[`CAU4AQ…VUN4`](https://stellar.expert/explorer/testnet/contract/CAU4AQFFURISTXHQ3SO3AMAR4FSRZGID3BWWRE5HLM2GJR7QQHPNVUN4)):

```text
STEP 1  Fund the agent wallet
  agent wallet     CAU4AQ…VUN4  (agent_policy, a smart account C-address)
  classic Payment  FAILED  can't build it: destination is invalid (PaymentOp.destination is a MuxedAccount, G or M only)
  This is the step CAP-72 turns into a plain payment.
  sent             10.00 USDC via the USDC contract's transfer (not a classic payment)
  balance          10.00 USDC

STEP 2  Owner attaches the spending policy
  wallet             CAU4AQ…VUN4  agent_policy
  owner              GBLCAV…EMQL  (the only key that can change the rules)
  rules              max $1.00 per payment, $2.00 per day
                     allowed sellers: GAPVK6…4XQD (Price check demo)
  agent key          GC6SWR…UC6J  held by the agent only, NOT a signer on any account

STEP 3  Agent buys a price check ($1.00)
  402 terms        1.00 USDC to GAPVK6…4XQD
  policy check     seller allowed, $1.00 <= $1.00, today $1.00 of $2.00
  result           200 OK  Best price for airpods-pro-3: $174.50 at Costco
  tx               …/tx/7b6d4a2b…  SUCCESS  1.00 USDC agent -> seller
  balance          9.00 USDC

STEP 4  Agent tries to break the rules
  The agent skips its own policy check here, like a buggy or prompt-injected agent would.
  $2.00 lookup             REFUSED by facilitator   policy: PaymentTooLarge   invalid_exact_stellar_payload_simulation_failed
  unapproved seller        REFUSED by facilitator   policy: SellerNotAllowed   invalid_exact_stellar_payload_simulation_failed
  2nd $1.00 lookup         200 OK                   today $2.00 of $2.00   …/tx/50ac2838…
  3rd $1.00 lookup         REFUSED by facilitator   policy: DailyCapExceeded   invalid_exact_stellar_payload_simulation_failed
  direct submit ($2.00)    FAILED onchain          policy: PaymentTooLarge   …/tx/9b5bd027…
  balance                  8.00 USDC
```

The transactions:

| What | Transaction |
| --- | --- |
| Step 3, first $1.00 purchase | [7b6d4a2b…](https://stellar.expert/explorer/testnet/tx/7b6d4a2bdfb0c7a1a525f13d3f91108bdfeb59230ff6e2c5b7edeeba4c3eab45) |
| Step 4, second $1.00 purchase | [50ac2838…](https://stellar.expert/explorer/testnet/tx/50ac28385f5ae74775258412f7f91c11e509d4a54d50ef52bf1b89b11c4e1b60) |
| Step 4, $2.00 direct submission, failed in `__check_auth` | [9b5bd027…](https://stellar.expert/explorer/testnet/tx/9b5bd02771b0345ff9a704d7576b0146a9f4054b96ba62538f8d8916b2563373) |

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

1. **SDK version.** `@x402/stellar` 2.27.0 is built against
   `@stellar/stellar-sdk` 16.3, not 17. SDK 17 replaced the XDR object model
   (`entry.credentials` is a property, not a method), which breaks x402's
   facilitator and client code. Both packages here pin one 16.3.0 copy with npm
   `overrides`. The same mechanism is how version A swaps in a patched SDK.
2. **Where a bad payment gets stopped first.** The stock x402 client re-simulates
   after signing and refuses locally, and its spend controls cap payments at $1
   by default. Both are the agent's own software, so step 4 turns them off to
   act like a misbehaving agent. The facilitator and the network are the parts a
   compromised agent can't switch off.
3. **The custom signature.** `AssembledTransaction.signAuthEntries` can't pass a
   custom account's `signatureScVal` through its `signAuthEntry` callback.
   `authorizeEntry` can, so `payment.mjs` replaces the client's
   `createPaymentPayload` and calls it directly.
4. **The facilitator's refusal reason is generic.** For every policy failure it
   returns `invalid_exact_stellar_payload_simulation_failed`, and its log shows
   the host error `Error(Auth, InvalidAction)`. The runner gets the specific
   policy error from its own simulation, `Error(Contract, #n)`.
5. **Direct submission timing.** The footprint borrowed from a valid $1 payment
   works (verified: the $2 transaction fails in `__check_auth`, not on footprint).
   But a valid $1 can't be simulated once the daily cap is used up, so the
   runner prepares it at the start of step 4.
6. **Fees, and the facilitator fee ceiling.** With a persistent day-bucket entry,
   the first payment each day cost 409,731 stroops, because a new persistent
   entry pays rent for the network's long minimum TTL. The bucket now lives in
   temporary storage (it only matters for a day), and the same payment costs
   26,328. So the stock facilitator's 50,000-stroop ceiling isn't a blocker for
   this design, and `facilitator.mjs` runs `ExactStellarScheme` with stock
   settings. The spec's 290k figure came from the heavier OpenZeppelin stack.

Fees on testnet (fee charged, stroops):

| Payment | Fee |
| --- | --- |
| Plain G-account x402 payment, same facilitator, for comparison | 11,656 |
| Policy payment, not the first of the day | 13,111 |
| Policy payment, first of the day (creates the day bucket) | 26,328 |
| Failed direct submission | 10,429 |

So the onchain policy adds about 1,500 stroops (0.00015 XLM) to a normal
payment.

## Known limits

* Version B's wallet is a C-address, so step 1 has to fund it with a contract
  `transfer`. That's the step CAP-72 fixes, and version A shows it.
* `__check_auth` traps (it doesn't return `BadSignature`) when the public key
  matches but the signature is wrong, because `ed25519_verify` panics. A
  rotated-out key gets the typed error because the public key no longer matches.
* The facilitator is local and single-process. It's a demo, not a service.
