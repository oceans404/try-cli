# CAP-72 host patch: delegated (contract) signers for G-accounts

A research prototype of CAP-72 in `soroban-env-host`, behind the `next` feature, written for review by a core engineer (Dmytro Kozhevin). It implements the scope this project proposes as "CAP-72a": the new `SignerKey` arm, host-side authentication of delegated signers for Soroban authorization entries, and nothing else. There is no G-account contract (GAC), no `AccountEntry` write from the host, no reserve or sponsorship logic. Signers are added with `SetOptionsOp`, which is a stellar-core change and is listed in [REMAINING-WORK.md](REMAINING-WORK.md).

It has not run on any network. It has run in the host's own test suite (results below).

## What is in the patch

Three repos, three patch files in `patches/`, all `git diff` against the upstream default branches at these commits:

| Repo | Upstream commit | Patch | Size |
| --- | --- | --- | --- |
| `stellar/stellar-xdr` | `4f524bbac80c781c06e4fb5fc93a2d0d331d6705` (main) | `patches/stellar-xdr.patch` | 2 files, 36 lines added |
| `stellar/rs-stellar-xdr` | `3c2aa43d2ab54d429ae44aa5143d805bf5dba7e2` (main, v30.0.0) | `patches/rs-stellar-xdr.patch` | 16 files, about 200 lines, almost all generated |
| `stellar/rs-soroban-env` | `0c99950e96128beba3319aa96b116646ce974e69` (main, v30.0.0) | `patches/rs-soroban-env.patch` | 9 files, 1133 insertions, 16 deletions, of which 857 lines are the new test file |

### XDR (`stellar-xdr.patch`)

Follows the CAP's XDR diff, with the CAP's exact names, gated by a preprocessor feature `CAP_0072_DELEGATED_SIGNERS` (the same mechanism `TEST_FEATURE` uses on main, and that `CAP_0084_MUXED_CONTRACT` and `CAP_0087_ML_DSA` used until stellar-xdr PR 321 ungated them):

- `Stellar-types.x`: `SIGNER_KEY_TYPE_SC_DELEGATED = 4` in `SignerKeyType`, and `case SIGNER_KEY_TYPE_SC_DELEGATED: SCAddress delegatedSCSigner;` in `SignerKey`.
- `Stellar-transaction.x`: `SET_OPTIONS_SIGNER_TYPE_NOT_SUPPORTED = -11` plus its `SetOptionsResult` arm, and `txACCOUNT_DELEGATED_SIGNER_NOT_SUPPORTED` plus its arms in `TransactionResult` and `InnerTransactionResult`.

Two things differ from the CAP text and need Dmytro's eye:

1. The CAP assigns `txACCOUNT_DELEGATED_SIGNER_NOT_SUPPORTED = -18`, but `-18` is now `txFROZEN_KEY_ACCESSED` on main. The patch uses `-19`. The CAP's XDR section is based on stellar-xdr commit `4b7a2ef` and needs a rebase either way.
2. `SignerKey` lives in `Stellar-types.x` and `SCAddress` in `Stellar-contract.x`, which includes `Stellar-types.h`. The Rust generator resolves names across all input files, so this is fine for `rs-stellar-xdr`. For stellar-core's `xdrc` (C++ headers, declaration order matters) it may not be: either `SCAddress` moves into `Stellar-types.x`, or `SignerKey` grows a forward declaration, or the arm becomes `Hash delegatedContract` (which the contracts-only rule below would allow). Marked (inference), I did not build core.

The transaction result codes are not used by the host. They are in the patch because the CAP's XDR is one unit, and the generator must see the whole set to produce consistent code.

### Rust XDR crate (`rs-stellar-xdr.patch`)

- New cargo feature `cap_0072_delegated_signers` in `Cargo.toml`, and its entry in `VERSION.features` in `src/lib.rs`, mirroring how `cap_0084_muxed_contract` was wired before PR 606 ungated it.
- `src/generated/**` regenerated with the repo's own generator (`make generate-files`, which runs `xdr-generator-rust/generator` on `xdr/*.x`). The `xdr/` submodule was not initialized in this clone, so the patched `.x` files were copied in from the `stellar-xdr` clone (same commit as `xdr-version`). The generated code is real generator output, not hand-edited. The new arm is `SignerKey::ScDelegated(ScAddress)` and `SignerKeyType::ScDelegated`, each under `#[cfg(feature = "cap_0072_delegated_signers")]`.
- Hand-written code that matches on `SignerKey` exhaustively had to learn the arm: `src/str.rs` (`Display` renders the delegate's own strkey, `FromStr` parses a `C...` strkey into `ScDelegated(Contract)` when the feature is on). `xdr-json/`, `xdr-definitions-json/` and `xdr-version` were not regenerated (not needed by the host; `make generate` does all of them).

`cargo check` passes with default features and with `--all-features`.

### Host (`rs-soroban-env.patch`)

- `Cargo.toml`: the commented-out `[patch.crates-io] stellar-xdr = { path = "../rs-stellar-xdr" }` is enabled, so the workspace builds against the local XDR crate. `Cargo.lock` changes by two lines for the same reason.
- `soroban-env-common/Cargo.toml`: `next = ["soroban-env-macros/next", "stellar-xdr/cap_0072_delegated_signers"]`. The `next` feature is how this repo builds unreleased protocol code (`soroban-env-macros` sets `LEDGER_PROTOCOL_VERSION = 31` under it, and stellar-core passes `--features next` to the host it labels `p30` when configured with `--enable-next-protocol-version-unsafe-for-production`). Everything new in the host is under `#[cfg(feature = "next")]`, and additionally behind a runtime check that the ledger protocol is at least 31 (`DELEGATED_SIGNERS_PROTOCOL_VERSION` in `account_contract.rs`), because a `next` host may also close protocol 30 ledgers.
- `soroban-env-host/src/builtin_contracts/account_contract.rs`: the algorithm, below.
- `soroban-env-host/src/host/data_helper.rs`: `get_delegated_signer_weight_from_account` (new, next to `get_signer_weight_from_account`, which is unchanged and still only matches `SignerKey::Ed25519`).
- `soroban-env-host/src/auth.rs`: `check_account_authentication` now takes the `AuthorizationManager` (both call sites, `authenticate` and `delegate_account_auth`, already had it), plus two small accessors on the manager: `has_delegated_signers_for_current_auth_check` and `get_context_for_current_auth_check`.
- `soroban-env-host/src/host/metered_clone.rs`: `Signer::charge_for_substructure` gets the new arm (`ScAddress` is shallow).
- `soroban-env-host/src/test.rs` and `soroban-env-host/src/test/account_delegated_signers.rs`: the tests, compiled only with `next`.

## The algorithm

Entry point: `check_account_authentication(host, authorization_manager, account_id, signature_payload, signature)` in `soroban-env-host/src/builtin_contracts/account_contract.rs` (line 293 in the patched file). The host calls it for every `SorobanAuthorizationEntry` whose address is a G-account, from `AccountAuthorizationTracker::authenticate` (`auth.rs`, line 2715) and from `AuthorizationManager::delegate_account_auth` when a contract account delegates to a G-account (`auth.rs`, line 1054). The CAP-71-01 machinery (`DelegatedAccountAuthTracker`, the authentication frame stack) is reused unchanged.

1. `delegated_signers_enabled` (line 185): `next` build and ledger protocol >= 31. Otherwise the function behaves exactly as before the patch, including metering.
2. If the credentials of the current authentication frame are `SorobanCredentialsAddressWithDelegates` (`has_delegated_signers_for_current_auth_check`, a free check, line 313), fetch the delegate addresses with the CAP-71 getter `get_delegated_signers_for_current_auth_check`. The tracker that produced the list already rejected unsorted and duplicate addresses when the entry was parsed (`DelegatedAccountAuthSignerTreeNode::from_xdr`), which covers the CAP's "sorted, no duplicates" rule.
3. The top-level `signature` may be `void` when delegates are present (line 333). This is what the demo's signer emits. Otherwise it must be the usual vector of `AccountEd25519Signature`.
4. Count check (lines 340 to 357): ed25519 signatures plus delegates must be between 1 and `MAX_ACCOUNT_SIGNATURES` (20), as in the CAP.
5. Load the `AccountEntry`.
6. If delegates are present (line 374):
   - Compute the required threshold from the auth context (`required_threshold_index`, line 271): `High` if any `AuthorizationContext::Contract` targets a G-address, else `Med`. If it is `High`, fail with "delegated signers can't authorize account management". See departure 1 below.
   - `authenticate_delegated_signers` (line 216), for each delegate in order: it must be a contract address (departure 2); it must have a non-zero weight as a `SignerKey::ScDelegated` signer on the account (`get_delegated_signer_weight_from_account`, `data_helper.rs` line 573, which only matches `ScDelegated(ScAddress::Contract(_))`); then `authorization_manager.delegate_account_auth(host, delegate)` runs the delegate's `__check_auth` with the account's own signature payload and context, through CAP-71-01's frame handling, marking the delegate as used. Any error propagates. Weights are summed with `saturating_add`.
7. The ed25519 signatures are processed exactly as before (ordering, verification, `get_signer_weight_from_account`, which never matches a delegated signer) and added to the same weight.
8. The total is compared against `Med` (line 400). The ed25519-only path never evaluates the context, so its budget usage is unchanged (the full `next` suite's metering snapshots stayed green after that was made explicit).

Errors are `ContractError::AuthenticationError` as for every other account authentication failure. The host wraps them into `Error(Auth, InvalidAction)` in `maybe_authorize_invocation` and reports the inner error (for example the delegate's `Error(Crypto, InvalidInput)`) in a "failed account authentication with error" diagnostic event.

Recording mode and the simulation's "dummy signature" path (`auth.rs` around line 2770, which fakes one ed25519 signature to estimate fees) are untouched: both use `SorobanCredentials::Address`, so no delegate list exists and the new code is skipped.

## Deliberate departures from the CAP-72 text

These come from the analysis in [CAP72-OBJECTIONS-AND-IMPROVEMENTS.md](CAP72-OBJECTIONS-AND-IMPROVEMENTS.md), sections 2 and 3. They are proposals for a revised CAP, implemented here so the prototype demonstrates the revised rules rather than the stalled ones.

### 1. Delegated signer weight counts toward Medium only, never High

CAP-72 says: add every delegated signer's weight to the total, and raise the required threshold to High when a G-account contract call is in the context. So a delegate with enough weight could call the GAC and change signers, thresholds or the master weight.

This patch: when the authorization context contains a call on a G-address (which is what account management through a GAC would look like), delegated signers are refused outright, even with weight 255 (`test_delegated_signers_never_count_toward_high_threshold`). The account's ed25519 keys keep sole control of its configuration. The threshold used for the comparison is always Med; with no GAC in this scope there is no other operation that would need High.

Why (from the objections doc, improvement 2): it removes the "buggy or compromised delegate takes over the account" reading of Tomer Weller's objection and the CAP's own security concern ("every contract signer added to the account has to be a trusted and audited contract"); the delegate can only authorize transfers and contract calls. It also answers the "cognitive overhead / classic semantics" worry: a delegated signer behaves like a Medium-level co-signer and nothing more, which is easy to state.

I chose an explicit error over silently ignoring the delegates when High is required, so a client that lists a delegate for an account-management call gets a clear failure instead of an unexplained weight shortfall. That is a judgment call; see open questions.

### 2. Contracts only

CAP-72 allows delegated signers of type `SC_ADDRESS_TYPE_ACCOUNT` and `SC_ADDRESS_TYPE_CONTRACT`.

This patch: a delegate in the credentials must be a contract address, and a `SignerKey::ScDelegated` on the `AccountEntry` that holds a G-address is treated as absent (weight 0), so even if a `SetOptionsOp` let one onto the account it does nothing (`test_g_account_delegated_signer_is_rejected`). `delegate_account_auth` itself still supports G-account delegates for contract accounts (CAP-71-01), that is unchanged.

Why (improvement 3): Leigh McCulloch's strkey concern. A contract delegate displays as the C strkey it already has, in Horizon, the CLI, Lab and every SDK, so no new strkey is needed. A G-account co-signer of a G-account is already expressible with plain ed25519 signers. In `rs-stellar-xdr`, `SignerKey`'s `Display` renders the delegate's address and `FromStr` accepts a `C...` strkey, which is all the string layer needs under this rule.

### 3. Scope: CAP-72a, no GAC

The CAP's GAC (implicit contract per account, six management functions, `AccountEntry` updates and reserve accounting from the host) is left out on purpose, and this is proposed as the split in improvement 1 of the objections doc: CAP-72a is the signer arm, `SetOptionsOp` support, the `extraSigners` rejection and the host authentication; CAP-72b, if ever, adds the GAC. Consequences that follow and are intentional here:

- Delegated signers are only consulted for Soroban authorization entries. Classic transaction signatures are checked by stellar-core, which must ignore the new arm (REMAINING-WORK, stellar-core).
- A delegated signer can't change the account's signers or thresholds: there is no Soroban path to do that, and departure 1 keeps it that way if a GAC is added later.
- Adding or removing a delegated signer is a `SetOptionsOp`, so it can be sponsored like any other signer, and the host never touches reserves.

## How to apply and test

Rust stable (this ran on 1.99.1; the workspace's `rust-version` is 1.87), targets `wasm32-unknown-unknown` and `wasm32v1-none` as `rust-toolchain.toml` asks (not needed for these tests). The three clones must be siblings, because the host's `[patch.crates-io]` points at `../rs-stellar-xdr`.

```bash
mkdir work && cd work
git clone https://github.com/stellar/stellar-xdr && git -C stellar-xdr checkout 4f524bbac80c781c06e4fb5fc93a2d0d331d6705
git clone https://github.com/stellar/rs-stellar-xdr && git -C rs-stellar-xdr checkout 3c2aa43d2ab54d429ae44aa5143d805bf5dba7e2
git clone https://github.com/stellar/rs-soroban-env && git -C rs-soroban-env checkout 0c99950e96128beba3319aa96b116646ce974e69

git -C stellar-xdr apply ../version-a/patches/stellar-xdr.patch
git -C rs-stellar-xdr apply ../version-a/patches/rs-stellar-xdr.patch
git -C rs-soroban-env apply ../version-a/patches/rs-soroban-env.patch

# Optional: regenerate instead of trusting the generated files in the patch.
# (cd rs-stellar-xdr && mkdir -p xdr && cp ../stellar-xdr/*.x xdr/ && make generate-files)

(cd rs-stellar-xdr && cargo check --all-features)
(cd rs-soroban-env && cargo test -p soroban-env-host --features next account_delegated_signers)
(cd rs-soroban-env && cargo test -p soroban-env-host --features next)             # whole suite, next
(cd rs-soroban-env && cargo test -p soroban-env-host --features testutils auth)   # default build, auth tests
```

The repo's `Makefile` runs `cargo hack --locked --each-feature test`; `--locked` will not pass with the `Cargo.lock` change, which is expected for a path patch.

## Test results (actually run)

The new tests, `cargo test -p soroban-env-host --features next account_delegated_signers`:

```
test test::account_delegated_signers::test_contract_that_is_not_a_signer_is_rejected ... ok
test test::account_delegated_signers::test_delegate_rejection_propagates ... ok
test test::account_delegated_signers::test_g_account_delegated_signer_is_rejected ... ok
test test::account_delegated_signers::test_delegated_contract_signer_authorizes_transfer ... ok
test test::account_delegated_signers::test_delegated_signers_never_count_toward_high_threshold ... ok
test test::account_delegated_signers::test_delegate_weight_below_threshold_is_rejected ... ok
test test::account_delegated_signers::test_plain_ed25519_account_is_unchanged ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 840 filtered out; finished in 0.08s
```

What they cover (file `soroban-env-host/src/test/account_delegated_signers.rs`; the delegate is the repo's `SIMPLE_ACCOUNT_CONTRACT` test wasm, a custom account whose `__check_auth` verifies an ed25519 signature over the payload, the token is a Stellar Asset Contract, the wallet is a G-account with a trustline):

- `test_delegated_contract_signer_authorizes_transfer`: the demo wallet (master weight 2, delegate weight 1, thresholds 1/1/2) authorizes `transfer` with a void top-level signature and one delegate entry; balances move. An empty signature vector works too. The agent key behind the delegate is rejected as a plain ed25519 signature (it is not a signer on the account).
- `test_delegate_rejection_propagates`: a delegate signature from the wrong key makes `__check_auth` trap; the transfer fails with `Error(Auth, InvalidAction)` and the delegate's `Error(Crypto, InvalidInput)` in diagnostics; balances unchanged. A delegates-only entry with no delegate at all fails.
- `test_contract_that_is_not_a_signer_is_rejected`: a valid custom account that is not on the account fails, alone and next to a valid delegate.
- `test_delegate_weight_below_threshold_is_rejected`: med threshold 2: one weight-1 delegate fails; delegate plus weight-1 ed25519 co-signer passes; two delegates pass; two delegates where one fails fails.
- `test_plain_ed25519_account_is_unchanged`: master key through stock `SorobanCredentials::Address`, and through `AddressWithDelegates` with an empty delegate list; void without delegates still fails; an account with no delegated signers behaves as before and rejects a delegate it never added.
- `test_g_account_delegated_signer_is_rejected`: departure 2.
- `test_delegated_signers_never_count_toward_high_threshold`: departure 1. The G-account call is a sub-invocation on the G-address in the auth entry, since no GAC exists to call. The last branch of that test (master key alone with such a sub-invocation) tolerates a non-authentication error, because unused sub-invocations are outside what the test is about; in the run it took the success path (inference from the pass and from the absence of an "unused sub-invocation" check in `auth.rs`).

Full host suite with `next` (`cargo test -p soroban-env-host --features next`), after the metering fix in step 8:

```
test result: ok. 847 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 15.31s
```

(847 = the 840 existing tests plus the 7 new ones. A first run before step 8's metering guard failed two `expect!` metering snapshots in `test::auth`, `test_two_authorized_trees` and `test_require_auth_within_check_auth`, because every G-account authentication was charging for the context conversion; the guard removed the cost for accounts without delegates and the snapshots pass unchanged.)

The new tests also pass under `--profile test-opt`:

```
test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 850 filtered out; finished in 0.01s
```

Default build, unchanged behavior (`cargo test -p soroban-env-host --features testutils auth` and `... stellar_asset_contract`):

```
test result: ok. 92 passed; 0 failed; 0 ignored; 0 measured; 752 filtered out; finished in 11.51s
test result: ok. 70 passed; 0 failed; 0 ignored; 0 measured; 774 filtered out; finished in 3.52s
```

Not run: `cargo hack --each-feature`, clippy, the `wasm32-unknown-unknown` build of the host, `soroban-simulation` tests, anything in stellar-core.

## Open questions for Dmytro

1. Refuse or ignore delegates when the context requires High? The patch refuses (explicit error). Ignoring them (count ed25519 only, leave the delegates unconsumed, which CAP-71-01 permits) would let a mixed entry with a sufficient master signature go through. Which reads better as a normative rule?
2. Is a sub-invocation on a G-address the right proxy for "account-management call in context" in a world without a GAC, or should CAP-72a drop the context rule and simply say "delegated weight counts toward Med" (which is what the patch's comparison does anyway)?
3. Void signature: the patch accepts `ScVal::Void` or an empty vector as the top-level signature when delegates are present. Should the CAP pin one form? The demo's JS signer emits `scvVoid`.
4. `SIGNER_KEY_TYPE_SC_DELEGATED = 4` with `SCAddress` payload versus `Hash delegatedContract` under the contracts-only rule. `Hash` avoids the `Stellar-types.x`/`Stellar-contract.x` ordering problem for `xdrc` and makes the "contracts only" rule structural; `SCAddress` keeps the door open for other address types (muxed contracts) without another XDR change.
5. String form: `rs-stellar-xdr` renders the signer as its contract strkey and parses `C...` back. XDR-JSON treats `SignerKey` as a string, so this is also its JSON form. Fine for contracts only; if G-account delegates ever come back this is ambiguous with `Ed25519`.
6. The transaction result code value (`-19` here; CAP says `-18`, now taken).
7. Protocol gating: the patch checks `protocol >= 31` at runtime inside a `next` build. Is that the convention you want, or is the `next` cfg alone enough until the protocol number is fixed?
8. Metering: the delegate path does a `HostVec` conversion of the context and the delegate list per authentication. Anything here you'd want charged differently, or covered by `metering_benchmark`?
9. Is there any place other than `check_account_authentication` where the host inspects account signers that should learn the arm? I found only `get_signer_weight_from_account` (left matching ed25519 only) and `MeteredClone for Signer`.

## Files

- `patches/stellar-xdr.patch`, `patches/rs-stellar-xdr.patch`, `patches/rs-soroban-env.patch`
- `HOST-PATCH.md` (this file), `REMAINING-WORK.md`
