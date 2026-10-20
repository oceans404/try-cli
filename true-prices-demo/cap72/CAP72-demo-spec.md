# CAP-72 agent wallet demo: build spec

Written Oct 19, 2026 for a Claude Code cloud session. Every technical claim cites a repo, file or URL. Anything marked (inference) was reasoned from the sources rather than verified by running code.

## Goal

Show that a Stellar agent wallet can be a plain G-account, funded by a classic payment from any exchange or ramp, while its spending policy (a $1 cap per payment, a $2 daily cap, an allowlist of sellers) is enforced by the network rather than by the agent's software. The agent pays the `true-prices-demo/` x402 seller through a policy contract, and a payment that breaks policy is rejected onchain. The demo exists to revive [CAP-72](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0072.md) with agent wallets as its second use case.

## Background (read this if you have nothing else)

Agentic payments on Stellar are short on buyers. Most AI agents can't pay for anything, because they have no wallet and no spending policy their owner trusts. The ideal agent wallet enforces its owner's rules onchain: a cap per payment, a daily budget, allowed sellers. Stellar smart accounts (C-addresses) can do that today. But exchanges, ramps and most wallets send only classic `Payment` operations, and those can't reach a C-address, so nobody can fund a smart account the easy way. SDF engineers call this "The Big Issue" for C-address adoption.

[CAP-72](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0072.md) (Draft, owner Dmytro Kozhevin) fixes it. A classic G-account can add a contract as a "delegated signer," and the contract's `__check_auth` then decides what the account authorizes for Soroban actions. An agent wallet becomes a normal G-account that anyone can fund, and the policy contract enforces its spending. x402 payments on Stellar are Soroban authorization entries for a USDC `transfer`, which is exactly the path delegated signers cover. CAP-72 builds on [CAP-71](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0071.md) ([CAP-71-01](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0071-01.md), authentication delegation), which is Final and live. On Oct 19, 2026, Dmytro said CAP-72 "didn't get much support, and got postponed indefinitely." Tyler (SDF) asked for a demo to build support. A second use case, the [Nido passkey wallet](https://github.com/nidohq/nido/issues/165), also needs it.

The seller in this demo is a small x402 price-check API: `GET /price-check?item=<item>` costs 1 USDC on Stellar testnet and returns made-up prices. It's adapted from [try-cli's example-x402-seller](https://github.com/oceans404/try-cli/tree/main/example-x402-seller) (Express, `@x402/express`, `@x402/stellar` 2.27.0). If `true-prices-demo/` isn't in your workspace, rebuild it from that example: swap the `/fortune` route for `/price-check` with three hard-coded items (`airpods-pro-3`, `dyson-v15`, `flight-sfo-lis`), read the price from a `PRICE` env var (default `$1.00`) and the port from `PORT`, and drop the Rail402 Bazaar extension. The demo runs three seller instances. Port 3001 is the allowed seller at $1.00. Port 3002 is the unapproved seller, at $1.00 with a different `payTo`. Port 3003 is the $2.00 lookup, with `PRICE=$2.00` and the same `payTo` as the allowed seller, so its only violation is the amount.

## Recommendation: version A, with B as the test harness

Build version A, the real one: a local network with CAP-72 patched into stellar-core and soroban-env-host, where the agent wallet is a real G-account. It's the only version that shows the thing CAP-72 adds. A plain classic payment funds a wallet whose spending the protocol enforces. Version B, a C-address stand-in on testnet, narrates exactly that step, which is why Steph chose A.

Be clear about the cost. CAP-72 has no implementation anywhere. Its Implementation section says TBD, and a GitHub code search for `SC_DELEGATED` across the `stellar` org and for `update_delegated_signer` across GitHub returns only the CAP text (plus `soroban-env-host/src/test/auth_delegation.rs`, which is CAP-71 test material). Version A is protocol engineering across at least four repos. It's 4 to 8 weeks for an engineer who already works in core and host, and it needs that engineer in the loop.

Version B is still worth building first, as the test harness rather than the demo, for three reasons:
1. The protocol piece CAP-72 depends on already shipped. CAP-71-01 (`delegate_account_auth`, `get_delegated_signers_for_current_auth_check`, `SOROBAN_CREDENTIALS_ADDRESS_WITH_DELEGATES`) is Final in protocol 27, live on mainnet since July 8, 2026, and the network is now on protocol 29 ([software versions](https://developers.stellar.org/docs/networks/software-versions)). So a C-address policy contract built today exercises the same `__check_auth` path CAP-72 would call.
2. One contract serves both versions. A custom account whose `__check_auth` verifies the agent's key and enforces the rules is the wallet in B and the delegated signer in A. CAP-71-01 says a delegate's `__check_auth` receives "the same signature payload and the same context" as the top-level account, so the rules code doesn't change between versions.
3. The policy contract, facilitator, signer and demo runner can all be built and debugged in 4 to 6 days on testnet while the core and host patch is in progress. Version A then swaps the network and the funding step.

B is also the fallback if the core work stalls or Dima decides the CAP shouldn't be revived.

## The demo experience

This is a run-of-show for version A. Version B differs only where noted. TODO: confirm the presenter and audience with Steph Orpilla (SDF product, who requested this demo). This assumes Tyler or Steph presents to SDF protocol folks and ecosystem builders, live on a call or as a recording.

The demo uses a $1 cap per payment and a $2 daily cap, so the daily limit is reached on screen in two purchases, with nothing happening off screen.

### What the presenter touches

The presenter runs one command, `npm run demo`, in a terminal. The runner prints each step, then waits for Enter before the next one, so the presenter controls the pace and can talk over each step. A single paused script beats separate commands, because nobody has to remember flags live. It also beats a web page, because the terminal output is the evidence protocol engineers trust. The seller and the local facilitator start automatically in the background, with their logs written to files so the screen stays clean.

Version A doesn't use Stellar Lab or the stock CLI to show the account. Both decode accounts with the stock XDR, so neither can read the new `SIGNER_KEY_TYPE_SC_DELEGATED` signer arm, and `stellar tx new set-options` can't build one. The runner reads and prints account state itself, using the patched JS SDK, and prints transaction hashes with results fetched from the local RPC (`getTransaction`). Version B can link to stellar.expert testnet instead.

### What's on screen, step by step

Step 1, funding. The runner creates the agent's G-account and sends it 10 USDC with a plain classic `Payment` operation, the same operation an exchange sends. A stock tool can build this step, because nothing CAP-72-specific is on the account yet.

```text
STEP 1  Fund the agent wallet with a normal payment
  agent wallet   GAGENT…7Q2X  (a regular Stellar account)
  sent           10.00 USDC via classic Payment op
  balance        10.00 USDC
  tx             3f9c…a1  SUCCESS
[Enter to continue]
```

Narration: "This is a plain payment, the kind every exchange and ramp already sends. A smart account can't receive this today."

Step 2, policy. The runner builds a `SetOptionsOp` with the patched JS SDK that adds `agent_policy` as a delegated signer with weight 1, sets the master key to weight 2, and sets thresholds to low 1, med 1, high 2. It then prints the account's signers, decoded with the patched SDK, and the rules read back from the contract.

```text
STEP 2  Owner attaches the spending policy
  signers on GAGENT…7Q2X
    master key         weight 2 (owner, the only key that can change signers)
    delegated signer   CPOLICY…9KD1 (agent_policy), weight 1   <- new in CAP-72
  rules              max $1.00 per payment, $2.00 per day
                     allowed sellers: GSELLR…2IZS (Price check demo)
  agent key          held by the agent only, NOT a signer on the account
[Enter to continue]
```

Narration: "The account now asks this contract before it approves any payment. The agent's key only works through the contract."

Step 3, an allowed purchase. The agent calls the price-check seller, gets the 402, and pays through the policy.

```text
STEP 3  Agent buys a price check ($1.00)
  402 terms      1.00 USDC to GSELLR…2IZS
  policy check   seller allowed, $1.00 <= $1.00, today $1.00 of $2.00
  result         200 OK  Best price for airpods-pro-3: $174.50
  tx             8b21…7e  SUCCESS  1.00 USDC agent -> seller
  balance        9.00 USDC
[Enter to continue]
```

Narration: "The agent paid with no signup and no API key at the seller, and the network checked the owner's rules."

Step 4, the rules hold. In x402 the facilitator submits the transaction, not the agent. It checks every payment by simulating it, and a payment that breaks policy fails `__check_auth` in simulation. So in normal x402 flow a bad payment never reaches the chain. The facilitator refuses it, and the seller answers 402 again. That's the real behavior, so the runner shows it first. Then it makes one handcrafted direct submission, so there's a failed onchain transaction to point at.

```text
STEP 4  Agent tries to break the rules
  $2.00 lookup             REFUSED by facilitator   policy: PaymentTooLarge
  unapproved seller        REFUSED by facilitator   policy: SellerNotAllowed
  2nd $1.00 lookup         200 OK                   today $2.00 of $2.00
  3rd $1.00 lookup         REFUSED by facilitator   policy: DailyCapExceeded
  direct submit ($2.00)    FAILED onchain           tx c40d…19  policy: PaymentTooLarge
  balance                  8.00 USDC (only the two allowed purchases left)
```

For each refusal, the runner prints the facilitator's verify reason and the policy error. It gets the policy error by running the same simulation itself and reading the contract error from the diagnostic events, because the facilitator may return only a generic simulation failure. TODO: record the facilitator's exact verify reason string and the exact host error text for a failed `__check_auth`, and print those rather than the enum names if they differ.

The direct submission works like this. A failing `__check_auth` also fails simulation, so there's no footprint or resource estimate to submit with. The runner builds a valid $1 payment and simulates it twice. The first simulation runs in recording auth mode, which never calls `__check_auth`, so its footprint leaves out the policy contract's code, its instance, and its rules and day-bucket entries. The runner then signs the $1 auth entry and simulates again in enforcing mode. That second footprint includes the policy's entries, and it's the one to copy. (The x402 client may already do this second pass. That's unverified, so `direct-submit.ts` should do it explicitly.) The runner never submits the $1 transaction. It rebuilds the same invocation with amount $2, re-signs the auth entry for the new payload, reuses the enforcing-mode footprint, pads the resources, and submits it directly to RPC. The transaction lands and fails in `__check_auth` with `PaymentTooLarge`. If it fails with a footprint error instead, the footprint came from the recording-mode simulation. (Inference: the enforcing-mode footprint covers the $2 call too, because it touches the same two USDC balance entries plus the same policy code, instance, rules and day-bucket entries, and the day bucket key doesn't change within the day. Verify this before relying on it.)

Narration: "The facilitator won't even submit it. And if someone goes around the facilitator, the protocol says no. Even a prompt-injected agent can't break the rules."

In version B, step 1 instead shows the classic payment to a C-address failing, then funds with a contract `transfer`. The presenter says, "This is the step CAP-72 turns into a plain payment." Step 2 shows the C-address's rules and its owner. Everything else matches.

### What a viewer can change live

Three edits prove it isn't scripted:
1. Change the rules. `npm run demo -- --rules max=3,daily=10` calls the owner-only `update_rules`, then reruns step 4 without the direct submission, because the $2 transaction would now succeed and move real money. On the same day, starting from $2.00 already spent and an 8.00 USDC balance, the rerun prints: $2.00 lookup 200 OK (today $4.00 of $10.00), unapproved seller still REFUSED (`SellerNotAllowed`), second $1.00 lookup 200 OK ($5.00 of $10.00), third $1.00 lookup 200 OK ($6.00 of $10.00), balance 4.00 USDC. The runner prints a line saying the direct submission was skipped because the rules now allow it.
2. Add a seller. `--allow <G-address>` adds the second seller (port 3002), and the unapproved-seller payment then goes through.
3. Swap the agent key. `--agent-key new` rotates the agent key in the policy, and the old key's payment is refused with `BadSignature`.

### Running it yourself

```bash
git clone <repo> && cd true-prices-demo/cap72
./setup-a.sh        # pulls stellar/quickstart:cap72, starts the local network, deploys agent_policy
npm run demo
```

TODO: decide where the repo and the `stellar/quickstart:cap72` image are published. `setup-b.sh` does the same for version B on testnet. The README states plainly what each version proves and which step B narrates.

## The policy contract (both versions)

A Soroban contract `agent_policy` (soroban-sdk 28.0.0, which the [software versions](https://developers.stellar.org/docs/networks/software-versions) page lists for protocol 29, checked Oct 19, 2026. Protocol 29 was a security release with no new CAPs, so the SDK major didn't bump. crates.io already has soroban-sdk 29.0.1, so check whether version A's local next-protocol network needs it) implementing `CustomAccountInterface::__check_auth(signature_payload, signature, auth_contexts: Vec<Context>)`. The `Context::Contract(ContractContext { contract, fn_name, args })` type in [`soroban-sdk/src/auth.rs`](https://github.com/stellar/rs-soroban-sdk/blob/main/soroban-sdk/src/auth.rs) carries the token contract, the function name and the full argument list, and the host builds it from the invocation tree in [`account_contract.rs`](https://github.com/stellar/rs-soroban-env/blob/main/soroban-env-host/src/builtin_contracts/account_contract.rs) (`ContractAuthorizationContext`). So the policy can see token, destination (`args[1]`) and amount (`args[2]`).

Rules, stored at init by the owner: `agent_pubkey: BytesN<32>`, `token: Address` (USDC SAC), `max_per_payment: i128` (10_000_000), `daily_cap: i128` (20_000_000, so the cap is reached on screen), `allowed_sellers: Vec<Address>`, `wallet: Address` (the account this policy speaks for). `__check_auth` verifies an ed25519 signature from `agent_pubkey` over `signature_payload`, then requires every context to be `transfer(wallet, to, amount)` on `token` with `to` allowlisted and `amount <= max_per_payment`, and keeps a spent total for the current day in persistent storage, keyed on `env.ledger().timestamp() / 86400`, that must stay at or under `daily_cap`. A fixed day bucket is simpler to build and explain than a rolling window, which would need to store every payment's time. It also doesn't depend on ledger close time, which has been changing. It emits no events (see the facilitator finding below for why). Errors are typed (`PaymentTooLarge`, `SellerNotAllowed`, `DailyCapExceeded`, `BadSignature`) so the failure is readable in diagnostics. Owner-only `update_rules` requires the owner's G-address auth.

Alternative: the OpenZeppelin smart account ([stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) `packages/accounts`, crate `stellar-accounts` 0.7.1) with a `CallContract(USDC)` rule, an `External` ed25519 signer and the `SpendingLimit` policy. That policy covers only the daily cap, so a custom `Policy` (`packages/accounts/src/policies/mod.rs`) is still needed for the per-payment max and allowlist; `spending_limit.rs` emits `SpendingLimitEnforced` on every transfer, which facilitators reject (below); and [smart-account-kit](https://github.com/stellar/smart-account-kit) pins `@stellar/stellar-sdk@^16.3.0` while the demo's `@x402/stellar` 2.27.0 uses 17.x. Use it only if an audited stack matters more than a week of extra work.

## Critical risk: facilitator compatibility

Verified from source. Both public facilitators will reject these payments, so the demo must run its own facilitator in process.

The reference facilitator that x402.org runs ([`typescript/packages/mechanisms/stellar/src/exact/facilitator/scheme.ts`](https://github.com/x402-foundation/x402/blob/main/typescript/packages/mechanisms/stellar/src/exact/facilitator/scheme.ts), wired in `typescript/site/app/facilitator/index.ts`) does not check ed25519 signatures itself. `validateAuthEntries` only requires that the payer's credential signature is not `scvVoid` (`gatherAuthEntrySignatureStatus` in `shared.ts`); validity comes from `simulateTransaction`. So a C-address payer is accepted in principle. Three checks still block the demo:

1. `validateSimulationEvents` rejects any contract event whose first topic is not `transfer` (`invalid_exact_stellar_payload_event_not_transfer`). Open issue [x402#3764](https://github.com/x402-foundation/x402/issues/3764) (Oct 10, 2026) reproduces this with the OZ spending-limit policy against both the reference facilitator and OZ Channels testnet.
2. The fee ceiling `DEFAULT_MAX_TRANSACTION_FEE_STROOPS = 50_000` (step 8). The same issue measured about 290k stroops for a smart-account payment. The ceiling is a constructor option (`maxTransactionFeeStroops`), so a self-hosted facilitator just raises it.
3. `getAddressCredentials` in `shared.ts` returns `undefined` for `sorobanCredentialsAddressWithDelegates`, and `validateAuthEntries` then returns `invalid_exact_stellar_payload_unsupported_credential_type`. CAP-72 payments use exactly that credential type (CAP-72, "G-account authentication"), so version A needs a one-function patch.

The OpenZeppelin plugin ([relayer-plugin-x402-facilitator](https://github.com/OpenZeppelin/relayer-plugin-x402-facilitator), `src/stellar/verify.ts` and `utils.ts`) has the same three: `ACCEPTED_CREDENTIAL_TYPES` is only `sorobanCredentialsAddress` and `AddressV2`, `validateSimulationEvents` fails on `nonTransferContractEventDetected`, and `maxTransactionFeeStroops` is checked against `transaction.fee`.

Decision: run `ExactStellarScheme` from `@x402/stellar/exact/facilitator` in a local Express app (template: `examples/typescript/facilitator/advanced/all_networks.ts` in the x402 repo) with `maxTransactionFeeStroops: 2_000_000` and a funded fee-payer G-key, and point the seller's `FACILITATOR_URL` environment variable at it. The seller needs no other change. Version B needs no patch because `agent_policy` emits no events. Version A subclasses the scheme to accept delegated credentials. This also removes the shared testnet facilitator's latency, which measured 5.7 to 20.5 seconds per paid request on Oct 19, 2026.

## Version A: real CAP-72 on a local network

Architecture: forks of `stellar/rs-soroban-env` and `stellar/stellar-core` built into a `stellar/quickstart` image, a patched `stellar-rpc` for simulation, patched XDR in the JS SDK, the same `agent_policy`, the same facilitator with one patch.

Host changes (rs-soroban-env, `soroban-env-host/src`):
1. `builtin_contracts/account_contract.rs::check_account_authentication` today verifies only `AccountEd25519Signature` entries against `ThresholdIndexes::Med`. Add the CAP-72 algorithm: read delegates via the `DelegatedAccountAuthTracker` in `auth.rs`, check each is a `SIGNER_KEY_TYPE_SC_DELEGATED` signer on the `AccountEntry`, authenticate each through `AuthorizationManager::delegate_account_auth`, add weights, and require `High` when a G-account contract call is in context.
2. `host/data_helper.rs::get_signer_weight_from_account` must return weights for the new signer key arm.
3. The G-account contract (GAC) in the CAP is optional for the demo. CAP-72 says delegated signers "can be managed via `SetOptionsOp`", so skip GAC and its reserve accounting entirely (inference: this halves the work).

Core changes (stellar-core): the CAP-72 XDR diff in `rs-stellar-xdr` and `src/protocol-curr/xdr`; `src/transactions/SetOptionsOpFrame.cpp` (`doCheckValid`, `addOrChangeSigner`) to accept the new signer type; `TransactionFrame::checkSignature` to ignore delegated signers; `extraSigners` to return `txACCOUNT_DELEGATED_SIGNER_NOT_SUPPORTED`; all behind the `next` feature (`src/rust/Cargo.toml` already carries `soroban-env-host-p30` with `features = ["next"]`). For scale, the core side of CAP-71 (PR [#5272](https://github.com/stellar/stellar-core/pull/5272)) was a host submodule bump plus about 400 lines of tests in `src/transactions/test/InvokeHostFunctionTests.cpp`; CAP-72 also touches classic operation code, which CAP-71 did not.

Tooling: add an image to `quickstart/images.json` whose `core` dep points at the fork with `configure_flags: --enable-next-protocol-version-unsafe-for-production` (as the `future` tag does), `make build TAG=cap72` (README, "Building Custom Images"), then `docker run -p 8000:8000 stellar/quickstart:cap72 --local --protocol-version 30 --enable-soroban-diagnostic-events` (30 is an inference from the `next` host label). `stellar-rpc` embeds the host for simulation (inference, verify), so fork it too. The JS SDK needs regenerated XDR for the new `SignerKey` arm. `@x402/stellar` and `@x402/fetch` pull in their own `@stellar/stellar-sdk`, so the runner, signer and facilitator must all resolve to the one patched copy. Use npm `overrides` in `package.json` (for example `"overrides": { "@stellar/stellar-sdk": "file:../vendor/js-stellar-sdk" }`) and check with `npm ls @stellar/stellar-sdk` that only one version is installed. Otherwise the facilitator and runner decode XDR differently. The demo's runner uses that patched SDK to build the `SetOptionsOp` and to decode the account. The stock Stellar CLI and Stellar Lab can't decode or build the new signer type, so either patch both (the CLI uses rs-stellar-xdr, and Lab uses the JS SDK) or do what this spec does and keep them out of version A. Horizon also ingests account signers, so either patch it or run quickstart without Horizon (TODO: confirm quickstart's flag for enabling only core and RPC), and `@x402/stellar` `utils.ts` knows only `stellar:testnet` and `stellar:pubnet` (inference; add a local entry).

Demo script differences: step 1 is a real `stellar tx new payment` of 10 USDC to the agent G-account after friendbot and a trustline. Step 2 is a `SetOptionsOp` adding `agent_policy` as a delegated signer with weight 1 and thresholds low 1, med 1, high 2, master weight 2; the runner prints the account's signers with the patched SDK, as shown in the demo experience section. Step 3's signer emits `SorobanAddressCredentialsWithDelegates` with a `scvVoid` top-level signature and one delegate entry `{ address: agent_policy, signature, nestedDelegates: [] }`, signed over the `ENVELOPE_TYPE_SOROBAN_AUTHORIZATION_WITH_ADDRESS` preimage (CAP-71-01, "Signature payload"). Step 4's direct submission uses the same delegated credentials.

Acceptance: the four steps on the local network; `stellar-core` and host test suites pass with `next` on; a diff small enough for Dima to review.

Effort: 4 to 8 weeks for an engineer who already works in core and host, with the GAC omitted; 2 to 3 months for the full CAP plus review (inference). A cloud session can draft the host patch and the tests, but the core C++ build and the multi-repo XDR plumbing need a human core engineer in the loop.

## Version B: test harness and fallback on testnet

Architecture: `agent_policy` deployed as a C-address and holding the USDC; the owner's G-key; the agent's ed25519 key held only by the buyer script; the local facilitator; the existing seller.

Components to build, all under `true-prices-demo/cap72/`:
1. `contracts/agent_policy/` (Rust, soroban-sdk 28.0.0).
2. `facilitator.ts` as described above.
3. `signer.ts`: a `ClientStellarSigner` (`signer.ts` in `@x402/stellar` declares `address` plus `signAuthEntry`, and its comment says it supports C accounts). `authorizeEntry` in js-stellar-sdk `src/base/auth.ts` accepts a callback returning `{ signatureScVal }` for custom accounts (DeepWiki summary of stellar/js-stellar-sdk; verify that `AssembledTransaction.signAuthEntries` in `src/contract/assembled_transaction.ts` passes it through in 17.x). If it does not, copy the 100-line `createPaymentPayload` from `exact/client/scheme.ts` into `buy-agent.ts` and call `authorizeEntry` directly.
4. `buy-agent.ts`: the x402 buyer (the pattern in try-cli's [`buy.mjs`](https://github.com/oceans404/try-cli/blob/main/example-x402-seller/buy.mjs), which wraps `fetch` with `@x402/fetch`) with the custom signer, plus `direct-submit.ts` for the handcrafted failing transaction described in step 4 of the demo experience section.
5. `setup-b.sh`: deploy, init, fund.

Dependencies: `@x402/*` 2.27.0 (2.28.0 is current per the issue; either works), `@stellar/stellar-sdk` 17.1, Stellar CLI 28.1.0 (the latest release on crates.io and the version listed for protocol 29; if you build the CLI from `main`, record the commit), testnet USDC `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (SAC id via `stellar contract id asset`). Get testnet USDC by adding a trustline, then buying it on the DEX with `stellar tx new path-payment-strict-receive --send-asset native` (about 1 XLM per USDC).

Demo script:
1. Funding. Run `stellar tx new payment --destination <C-address>`; it fails because `PaymentOp.destination` is a `MuxedAccount`. Then fund with `stellar contract invoke -- transfer` of 10 USDC. Narrate: "This is the step CAP-72 turns into a plain payment."
2. Policy. `setup-b.sh` prints the rules read back from the contract: $1 per payment, $2 per day, one allowed seller, agent key present, and shows the owner key is the only admin.
3. Payment. `npm run buy:agent` prints the 402 terms, the signed auth entry's address (the C-address), the 200 and a stellar.expert link showing the 1 USDC transfer from the C-address.
4. Rejection. As in the demo experience section: the facilitator refuses the $2.00 lookup on port 3003, which pays the allowed seller's address (`PaymentTooLarge`), and the unapproved seller on port 3002 with a different `payTo` (`SellerNotAllowed`), a second $1 lookup succeeds, and the third is refused (`DailyCapExceeded`). Then `direct-submit.ts` lands one failing $2.00 transaction, with a stellar.expert link and the policy error from diagnostics.

Acceptance: steps 3 and 4 succeed and fail as listed on testnet through the local facilitator, and the final balance is 8.00 USDC; the agent key is not a signer on any G-account; a fresh clone runs `setup-b.sh` and the four steps in under 15 minutes; `README.md` states plainly which step is narrated.

Effort: 4 to 6 engineer-days (inference).

## Risks and unknowns

1. Facilitators: both public facilitators reject policy events, fees above 50k stroops and delegated credentials (see above). Self-hosting fixes the demo but the CAP pitch must say facilitators need the three changes in issue #3764 plus delegated-credential support.
2. SDK signing path: whether `AssembledTransaction.signAuthEntries` in stellar-sdk 17 passes a custom `signatureScVal` through (unverified). Fallback is copying the client scheme.
3. Reserve cost: CAP-72 forbids sponsorship for signers added via GAC and requires the account to hold the XLM; with `SetOptionsOp` the signer can be sponsored. The demo should print the agent account's reserve so this is visible.
4. Rejections happen at the facilitator, not onchain. x402's facilitator simulates before it submits, so a policy-breaking payment never reaches the chain in normal flow. The only onchain failure is the handcrafted direct submission, which depends on reusing the footprint from a valid payment's signed, enforcing-mode simulation (inference, verify).
5. Version A scope creep: GAC and reserve accounting from Soroban are the hard parts of the CAP; keep them out of the demo.
6. CAP status: the author said on Oct 19 it is postponed indefinitely. Confirm with Dima that a demo would change that before funding version A.

## References

Protocol: [CAP-72](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0072.md) and its [discussion](https://github.com/orgs/stellar/discussions/1763), [CAP-71](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0071.md), [CAP-71-01](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0071-01.md), [CAP-71-02](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0071-02.md), [software versions](https://developers.stellar.org/docs/networks/software-versions), and [CAP-71 core PR #5272](https://github.com/stellar/stellar-core/pull/5272) for scale.

Code to patch for version A: [rs-soroban-env](https://github.com/stellar/rs-soroban-env), especially [`account_contract.rs`](https://github.com/stellar/rs-soroban-env/blob/main/soroban-env-host/src/builtin_contracts/account_contract.rs), [`auth.rs`](https://github.com/stellar/rs-soroban-env/blob/main/soroban-env-host/src/auth.rs) and [`data_helper.rs`](https://github.com/stellar/rs-soroban-env/blob/main/soroban-env-host/src/host/data_helper.rs). Also [stellar-core](https://github.com/stellar/stellar-core), [rs-stellar-xdr](https://github.com/stellar/rs-stellar-xdr), [stellar-rpc](https://github.com/stellar/stellar-rpc), [js-stellar-sdk](https://github.com/stellar/js-stellar-sdk), and [quickstart](https://github.com/stellar/quickstart) (see "Building Custom Images" in its README).

Policy contract: the [custom account example](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/custom-account) and its [source](https://github.com/stellar/soroban-examples/tree/main/account), [`soroban-sdk/src/auth.rs`](https://github.com/stellar/rs-soroban-sdk/blob/main/soroban-sdk/src/auth.rs) for `Context`, and [OpenZeppelin stellar-contracts accounts](https://github.com/OpenZeppelin/stellar-contracts/tree/main/packages/accounts) as the audited alternative.

x402: [Stellar x402 docs](https://developers.stellar.org/docs/build/agentic-payments/x402) (including the facilitators section), the [x402 quickstart guide](https://developers.stellar.org/docs/build/agentic-payments/x402/quickstart-guide), the reference [facilitator scheme](https://github.com/x402-foundation/x402/blob/main/typescript/packages/mechanisms/stellar/src/exact/facilitator/scheme.ts), [`shared.ts`](https://github.com/x402-foundation/x402/blob/main/typescript/packages/mechanisms/stellar/src/shared.ts), the [client scheme](https://github.com/x402-foundation/x402/blob/main/typescript/packages/mechanisms/stellar/src/exact/client/scheme.ts), the [facilitator example](https://github.com/x402-foundation/x402/blob/main/examples/typescript/facilitator/advanced/all_networks.ts), issue [#3764](https://github.com/x402-foundation/x402/issues/3764), and the [OpenZeppelin facilitator plugin](https://github.com/OpenZeppelin/relayer-plugin-x402-facilitator).

Tooling and examples: the [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli), [try-cli](https://github.com/oceans404/try-cli) (the seller example and the Privy-wallet pattern), and the [Nido onboarding workaround](https://github.com/nidohq/nido/issues/165), which shows the cost of not having CAP-72.

## Prompt to hand the cloud session

"Read the CAP-72 demo spec (`CAP72-demo-spec.md`, pasted below or committed alongside this work). It's self-contained, and its Background and References sections give you the context and links. The target is version A, and the demo experience section is the acceptance test. Work in two phases.

Phase 1, about one week: build the shared pieces under `true-prices-demo/cap72/` and prove them on testnet as version B. If `true-prices-demo/` isn't present, rebuild the seller first as the Background section describes. Build the `agent_policy` contract, `facilitator.ts`, `signer.ts`, `buy-agent.ts`, `direct-submit.ts`, `setup-b.sh`, and a `demo` runner that pauses between the four steps and prints the output shown in the spec. Use soroban-sdk 28.0.0, `@x402/*` 2.27.0 and `@stellar/stellar-sdk` 17.1. Before writing the signer, check whether `AssembledTransaction.signAuthEntries` passes `signatureScVal` through. If it doesn't, copy `createPaymentPayload` from the client scheme. Don't use the x402.org or OpenZeppelin facilitators, for the reasons in the spec. Create fresh testnet identities with `stellar keys generate --fund` for the owner, the funder and the seller. Never commit secret keys. Report the transaction hashes for the two allowed purchases and the failed direct submission, the facilitator's exact verify reason for each refusal, the resource fee per payment, and anything the spec got wrong.

Phase 2: draft the version A host patch in a fork of `stellar/rs-soroban-env` (`account_contract.rs::check_account_authentication`, `data_helper.rs::get_signer_weight_from_account`) with tests, behind the `next` feature, and leave the GAC out. List the stellar-core, stellar-rpc, XDR and JS SDK changes still needed, and stop there. A human core engineer has to own the stellar-core build and review the patch before anything runs on a local network."
