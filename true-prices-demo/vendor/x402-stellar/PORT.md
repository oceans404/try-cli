# @x402/stellar 2.28.0-sdk17.0: port to @stellar/stellar-sdk 17

This folder is a vendored build of the upstream `@x402/stellar` package
(`typescript/packages/mechanisms/stellar` in https://github.com/x402-foundation/x402),
ported to `@stellar/stellar-sdk` 17.x and extended with two features our CAP-72
demo needs. Install it with a `file:` dependency:

```json
"@x402/stellar": "file:./vendor/x402-stellar"
```

`package.json` here is the upstream one with `@x402/core` changed from
`workspace:~` to `~2.28.0` and the version set to `2.28.0-sdk17.0`. `dist/`
is the tsup build (ESM + CJS + types), `src/` is the ported TypeScript,
`sdk17.patch` is the full diff against upstream.

## Why the port exists

Upstream 2.27 and 2.28 depend on `@stellar/stellar-sdk ^16.3.0` and use the
sdk 16 XDR object model: `entry.credentials()`, `credentials.switch()`,
`.address()`, `.signature()`, `rootInvocation().subInvocations()`,
`event.body().v0().topics()`, `toXDR()` / `fromXDR()`, and so on. sdk 17
replaced that model: XDR fields are readonly properties, union arms are
narrowed by a string `type` (`"sorobanCredentialsAddress"`,
`"scvVoid"`, ...), enum members are static singletons, int64 values are native
bigints, and the encode/decode helpers are `toXdr` / `fromXdr`. An app that pins
sdk 17 (ours does, for the CAP-71-01 and CAP-72 helpers) therefore crashes inside
`@x402/stellar` with errors like `credentials.switch is not a function`, and
having both sdk 16 and sdk 17 in one `node_modules` breaks `instanceof` checks.

## Base

Upstream commit: `faa1c694c66a3732aaabbce93bdae140e521a67d`
(`security: update security.md (#3823)`, main, 2026-10-15), package version 2.28.0.
Work branch in the clone: `stellar-sdk-17` (five commits on top of that hash).

## API changes made for sdk 17, file by file

`package.json`
: `@stellar/stellar-sdk` `^16.3.0` to `^17.2.1`; version `2.28.0-sdk17.0`.

`src/shared.ts`
: `getAddressCredentials` switches on `credentials.type` and reads
  `credentials.address` / `credentials.addressV2` (properties, not methods).
  `gatherAuthEntrySignatureStatus` reads `entry.credentials`,
  `addressCredentials.address` and `.signature`, and tests `signature.type !== "scvVoid"`
  instead of `signature.switch().name`. `assembleTransaction(...).build()` is unchanged.
  New helpers for feature A (below): `getDelegateSignatures`, `isSignaturePresent`,
  `areAllDelegatesSigned`, `collectDelegateAddresses`, `isAuthEntrySigned`.

`src/exact/facilitator/scheme.ts`
: `func.switch().name` to `func.type`; `func.invokeContract()` to `func.invokeContract`
  (TypeScript narrows the union after the type check); `invokeContractArgs.contractAddress()`,
  `.functionName()`, `.args()` to properties. Diagnostic events:
  `diagnosticEvent.event`, `event.type.name`, `event.body.v0.topics` / `.data`,
  `topic.type === "scvSymbol"`, `topic.sym.toString()`, `event.contractId` (a
  `ContractId`, passed straight to `xdr.ScAddress.scAddressTypeContract`). Auth
  entries: `auth.credentials`, `addressCredentials.signatureExpirationLedger`,
  `auth.rootInvocation.subInvocations`. Settle path: `rebuiltTx.toXdr()`,
  `feeBumpTx.toXdr()`, `TransactionBuilder.fromXdr(...)` (the uppercase forms still
  exist in 17 but are deprecated). `scValToNative`, `SignerKey.encodeSignerKey`,
  `transaction.extraSigners`, `simResponse.transactionData.build()` and
  `Operation.invokeHostFunction(invokeOp)` work as before.

`src/exact/client/scheme.ts`
: `tx.built!.toXDR()` to `tx.built!.toXdr()`. `AssembledTransaction.build`,
  `needsNonInvokerSigningBy`, `signAuthEntries` and `simulate` keep their shape.
  Feature B branch added (below). `findDefaultAsset` stays a public field on the
  class, since x402 core's spend controls read it from the client scheme.

`src/signer.ts`
: unchanged runtime (`basicNodeSigner` is still exported from
  `@stellar/stellar-sdk/contract`). New `ClientAuthorizeEntry` type and optional
  `authorizeEntry` on `ClientStellarSigner`; `isClientStellarSigner` additionally
  requires `authorizeEntry` to be a function when present.

`src/exact/server/scheme.ts`, `src/utils.ts`, `src/constants.ts`,
`src/defaultAssets.ts`, `src/types.ts`, `src/index.ts`
: no changes needed. `Horizon.Server`, `rpc.Server` and the ledger query builder
  are the same in 17.

Tests (`test/unit/*.ts`, `test/integrations/exact-stellar.test.ts`)
: fixtures use the 17 constructors: `nonce: 1n` instead of `new xdr.Int64(1)`,
  `xdr.ContractEventType.contract` (static member, no call),
  `xdr.ContractEventBody.v0(v0)` and `xdr.ExtensionPoint.v0()` instead of the
  old `toXDR`/`fromXDR` round trip, `xdr.ContractId` instead of `xdr.Hash`,
  `new xdr.Int128Parts({ lo: bigint, hi: bigint })`, `envelope.type === "envelopeTypeTx"`
  narrowing to reach `v1.tx.ext.sorobanData`, `preimage.type` instead of
  `preimage.switch().name`, `hash(preimage.toXdr())`, and property access for
  `credentials`, `rootInvocation`, `address`, `nonce`, `signature`,
  `signatureExpirationLedger`, `function`. The ed25519 signature ScVal is read as
  `vec[0].map.find(key.sym === "signature").val.bytes.value`. In the integration
  test, `replaceAuthEntries` rebuilds the envelope through
  `TransactionBuilder.cloneFrom(...).clearOperations().addOperation(...)`
  because sdk 17 XDR values are immutable (no `auth(newAuth)` setter). The mocked
  `AssembledTransaction.built` exposes `toXdr`. Every existing assertion is
  kept; no test had to be dropped. One pre-existing test typing issue (the
  `_verify` spy cast in `facilitator-settle.test.ts`) was tightened so
  `tsc --noEmit` is clean for `src` and `test`.

Behavior, exports, reason strings and checks are otherwise identical to 2.28.0.

## Feature A: CAP-71-01 delegated credentials (`sorobanCredentialsAddressWithDelegates`)

Upstream rejected this credential arm with
`invalid_exact_stellar_payload_unsupported_credential_type`. CAP-72 G-account
payments sign through delegates, so the facilitator now treats the arm like an
address entry:

- `getAddressCredentials` returns the top-level `addressCredentials` for it (this
  is the one deliberate change to an existing function's result; upstream returned
  `undefined`). `getDelegateSignatures` returns the delegate tree.
- The payer is the top-level address.
- Expiration checks use the top-level `signatureExpirationLedger`.
- An entry counts as signed when the top-level signature is not `scvVoid`, or
  when the top-level signature is void, at least one delegate is present, and
  every delegate (recursively through `nestedDelegates`) has a non-void
  signature (`isAuthEntrySigned`). Otherwise the payer is pending and verify
  returns `invalid_exact_stellar_payload_missing_payer_signature`, exactly as
  for an unsigned plain entry.
- Facilitator safety: the facilitator (settlement signers and the fee bump
  signer) must not be the top-level address nor any delegate at any depth
  (`invalid_exact_stellar_payload_facilitator_in_auth`).
- Plain `sorobanCredentialsAddress` / `AddressV2` entries behave as before.

Client side, a G-account delegating to another key signs with the sdk's own
helpers and hands the finished entry to the client through feature B:

```ts
import { authorizeEntry, buildWithDelegatesEntry } from "@stellar/stellar-sdk";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const signer = {
  address: gAccount,                 // the payer (top-level address)
  signAuthEntry: async () => { throw new Error("not used"); },
  authorizeEntry: async (entry, validUntil, passphrase) => {
    const withDelegates = buildWithDelegatesEntry({
      entry,
      validUntilLedgerSeq: validUntil,
      delegates: [{ address: delegateKeypair.publicKey() }],
    });
    // top-level signature stays scvVoid; the delegate signs the shared preimage
    return authorizeEntry(withDelegates, delegateKeypair, validUntil, passphrase,
      delegateKeypair.publicKey());
  },
};
const client = new ExactStellarScheme(signer);
```

Facilitator side nothing changes: `new ExactStellarScheme([facilitatorSigner])`
verifies and settles such a payload.

## Feature B: custom-account signers in the client (`authorizeEntry`)

Upstream `ExactStellarScheme` (client) always calls
`tx.signAuthEntries({ address, signAuthEntry, expiration })`, and a SEP-43
`signAuthEntry` can only return raw signature bytes, which the sdk wraps in the
ed25519 `{public_key, signature}` structure. A smart account (C-address) with a
custom `__check_auth` (passkeys, multisig contracts) cannot pay that way.

`ClientStellarSigner` now has an optional

```ts
authorizeEntry?: (
  entry: xdr.SorobanAuthorizationEntry,
  validUntilLedgerSeq: number,
  networkPassphrase: string,
) => Promise<xdr.SorobanAuthorizationEntry>;
```

When present, the client calls
`tx.signAuthEntries({ address, expiration, authorizeEntry: wrapper })` where the
wrapper adapts the sdk's four-argument `authorizeEntry` signature to this
three-argument one, and `signAuthEntry` is never called. The sdk only routes
entries whose top-level address equals `signer.address` to the override, and the
usual post-signing `simulate()` plus `needsNonInvokerSigningBy()` checks still
run. `signAuthEntry` stays required by the type for API compatibility (give it a
stub for smart accounts).

```ts
import { authorizeEntry, xdr } from "@stellar/stellar-sdk";

const signer = {
  address: "C...",                   // the smart account
  signAuthEntry: async () => { throw new Error("not used"); },
  authorizeEntry: (entry, validUntil, passphrase) =>
    authorizeEntry(
      entry,
      async (_preimage, payload) => ({
        signatureScVal: xdr.ScVal.scvBytes(await passkey.sign(payload)), // your __check_auth shape
      }),
      validUntil,
      passphrase,
    ),
};
```

## Test results

Commands run in `typescript/packages/mechanisms/stellar` on the `stellar-sdk-17`
branch with `@stellar/stellar-sdk` 17.2.1 installed.

Typecheck (`npx tsc --noEmit -p tsconfig.json`, covers `src` and `test`): 0 errors.

Lint and format (`pnpm lint:check`, `pnpm format:check`): clean.

Unit tests (`pnpm test`, vitest with v8 coverage):

```
 Test Files  10 passed (10)
      Tests  192 passed (192)
   Duration  7.27s (transform 1.27s, setup 0ms, collect 9.06s, tests 5.24s, environment 4ms, prepare 1.97s)
All files          |   92.26 |     88.8 |      88 |   92.26 |
```

Upstream had 163 tests (123 run, 35 skipped by the random facilitator selection
plus 5 failing on sdk 17 before the port); the port adds 29: delegate tests in
`shared.test.ts` (3) and `facilitator-verify.test.ts` (7, replacing the one
"reject delegated credentials" test), custom `authorizeEntry` tests in
`client.test.ts` (3) plus a `findDefaultAsset` check, and an `isClientStellarSigner`
check in `signer.test.ts`.

Integration tests (`pnpm test:integration`, live testnet with three throwaway
friendbot-funded keys, `NODE_USE_ENV_PROXY=1`):

```
 ✓ test/integrations/exact-stellar.test.ts (11 tests) 28062ms
 Test Files  1 passed (1)
      Tests  11 passed (11)
```

Settlements from that run, for reference:
https://stellar.expert/explorer/testnet/tx/468bfce4cd5640b9c64e0f047f698b0c961c913e90211f3660cee8b5f7ef8758
https://stellar.expert/explorer/testnet/tx/f6708a1abfcc60f04cd72dc6603628394f6c661220478aa6ee4337ac559f8b9c
https://stellar.expert/explorer/testnet/tx/e3ed5fc3b74dd75dde92f1e823caaf52636ba818338005456f3a398125298b59

Build (`pnpm build`, tsup ESM + CJS + d.ts, then `mirror-cjs-dts`): success.

Smoke test of this vendored folder in a fresh `npm init -y` project
(`npm install --install-links ./vendor/x402-stellar @stellar/stellar-sdk@17.2.1 @x402/core@2.28.0`):

```
+-- @stellar/stellar-sdk@17.2.1
`-- @x402/stellar@2.28.0-sdk17.0
  `-- @stellar/stellar-sdk@17.2.1 deduped
```

`@x402/stellar`, `@x402/stellar/exact/client`, `/exact/server` and
`/exact/facilitator` import in both ESM and CJS. Note on `file:` installs: npm
symlinks a local folder by default, and Node then resolves
`@stellar/stellar-sdk` from the folder's real location upward, so the consuming
project's `node_modules` must hold sdk 17 (it does once the demo bumps its pin),
or install with `--install-links` to copy the package instead.

## What upstreaming would take

- The sdk 17 accessor changes are mechanical and could go in as is, but
  upstream supports sdk 16 users, so a PR would either bump the peer range to
  `^17` as a major (the clean option; 17 keeps deprecated `toXDR` aliases but the
  XDR classes are incompatible), or keep 16 and 17 both working behind small
  adapter helpers (`credentials.type ?? credentials.switch().name` style), which
  is ugly and not worth it given sdk 16 is on security-fix-only support.
- Feature A changes `getAddressCredentials` for the delegates arm and makes the
  facilitator accept an arm it rejected on purpose; upstream will want the
  security argument spelled out (payer is the top-level address, every delegate
  must have signed, facilitator excluded from the whole tree, expiration on the
  top-level credentials) and may prefer a feature flag on the facilitator
  constructor. Enforce-mode simulation on the network validates the delegate
  signatures for real, so the facilitator is not the only line of defense.
- Feature B is additive (optional field, new type export) and should be an easy
  sell; the SDK-level `authorizeEntry` override it relies on exists in sdk 16
  too, so it could even be backported.
- A changeset, README section for both features, and a CHANGELOG entry.
- The integration suite should gain a delegated-credentials case once a testnet
  account with a delegate is available (CAP-72 needs Protocol 28+; testnet has
  it, the facilitator-side logic is covered by unit tests today).
