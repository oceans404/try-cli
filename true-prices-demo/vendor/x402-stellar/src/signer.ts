import { Keypair, xdr } from "@stellar/stellar-sdk";
import { basicNodeSigner, SignAuthEntry, SignTransaction } from "@stellar/stellar-sdk/contract";
import { STELLAR_TESTNET_CAIP2 } from "./constants";
import { getNetworkPassphrase } from "./utils";
import type { Network } from "@x402/core/types";

/**
 * Ed25519 signer for Stellar transactions and auth entries.
 *
 * Implements SEP-43 interface (except signMessage).
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md
 */
export type Ed25519Signer = {
  address: string;
  signAuthEntry: SignAuthEntry;
  signTransaction: SignTransaction;
};

/**
 * Facilitator signer for Stellar transactions.
 *
 * Alias for Ed25519Signer. Used by x402 facilitators to verify and settle payments.
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md
 */
export type FacilitatorStellarSigner = Ed25519Signer;

/**
 * Signs (authorizes) a whole Soroban authorization entry and returns the
 * signed copy.
 *
 * This is the escape hatch for custom accounts (smart wallets, passkey or
 * WebAuthn signers, multisig contracts) whose `__check_auth` expects a
 * signature structure other than the built-in `{public_key, signature}`
 * vector, and for CAP-71-01 delegated signing. The callback receives the
 * unsigned entry exactly as simulation returned it; it must return an entry
 * with the same `rootInvocation` and credentials whose
 * `signatureExpirationLedger` equals `validUntilLedgerSeq` and whose
 * `signature` is filled in. The SDK's `authorizeEntry` (with a
 * `SigningCallback` returning `{ signatureScVal }`), `buildAuthorizationEntryPreimage`
 * and `buildWithDelegatesEntry` are the usual building blocks.
 *
 * @param entry - The unsigned authorization entry from simulation
 * @param validUntilLedgerSeq - The (exclusive) ledger sequence until which the signature is valid
 * @param networkPassphrase - The network passphrase committed into the signature preimage
 * @returns The signed authorization entry
 */
export type ClientAuthorizeEntry = (
  entry: xdr.SorobanAuthorizationEntry,
  validUntilLedgerSeq: number,
  networkPassphrase: string,
) => Promise<xdr.SorobanAuthorizationEntry>;

/**
 * Client signer for Stellar transactions.
 *
 * Used by x402 clients to sign auth entries. Supports both classic (G) and contract (C) accounts.
 * signTransaction is optional for client signers.
 *
 * For a classic (G) account, `signAuthEntry` is enough: it returns raw Ed25519
 * signature bytes over the auth entry preimage and the SDK wraps them in the
 * standard `{public_key, signature}` structure.
 *
 * For a contract (C) account with a custom `__check_auth`, or for delegated
 * signing (CAP-71-01), provide `authorizeEntry` as well. When present, the
 * client hands each of the payer's auth entries to it instead of calling
 * `signAuthEntry`, so the callback owns the exact signature shape written into
 * the credentials. `signAuthEntry` is still required by the type (for API
 * compatibility and type guards) but is not called in that case.
 *
 * @example
 * ```ts
 * import { authorizeEntry, xdr } from "@stellar/stellar-sdk";
 *
 * const signer: ClientStellarSigner = {
 *   address: "C...",            // the smart account
 *   signAuthEntry: async () => { throw new Error("not used"); },
 *   authorizeEntry: (entry, validUntil, passphrase) =>
 *     authorizeEntry(
 *       entry,
 *       async (_preimage, payload) => ({
 *         // whatever your contract's __check_auth expects
 *         signatureScVal: xdr.ScVal.scvBytes(await passkey.sign(payload)),
 *       }),
 *       validUntil,
 *       passphrase,
 *     ),
 * };
 * ```
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md
 */
export type ClientStellarSigner = {
  address: string;
  signAuthEntry: SignAuthEntry;
  signTransaction?: SignTransaction;
  /**
   * Optional custom entry authorizer for smart-account (C) payers and
   * delegated signing. See {@link ClientAuthorizeEntry}.
   */
  authorizeEntry?: ClientAuthorizeEntry;
};

/**
 * Creates an Ed25519 signer for the given Stellar network.
 *
 * @param privateKey - Stellar classic (G) account private key
 * @param defaultNetwork - Is the network the signTransactiopn method will default to if no network is provided. Must use the CAIP-2 format identifier.
 * @returns Ed25519 signer implementing SEP-43 interface (except signMessage)
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md
 */
export function createEd25519Signer(
  privateKey: string,
  defaultNetwork: Network = STELLAR_TESTNET_CAIP2,
): Ed25519Signer {
  const kp = Keypair.fromSecret(privateKey);
  const networkPassphrase = getNetworkPassphrase(defaultNetwork);

  const address = kp.publicKey();
  const { signAuthEntry, signTransaction } = basicNodeSigner(kp, networkPassphrase);

  return {
    address,
    signAuthEntry,
    signTransaction,
  };
}

/**
 * Type guard for FacilitatorStellarSigner.
 *
 * Checks for required methods: address, signAuthEntry, signTransaction.
 *
 * @param signer - Value to check
 * @returns `true` if signer is a FacilitatorStellarSigner
 */
export function isFacilitatorStellarSigner(signer: unknown): signer is FacilitatorStellarSigner {
  if (typeof signer !== "object" || signer === null) return false;
  const s = signer as Record<string, unknown>;
  return (
    typeof s.address === "string" &&
    typeof s.signAuthEntry === "function" &&
    typeof s.signTransaction === "function"
  );
}

/**
 * Type guard for ClientStellarSigner.
 *
 * Checks for required methods: address, signAuthEntry. signTransaction and
 * authorizeEntry are optional but must be functions when present.
 *
 * @param signer - Value to check
 * @returns `true` if signer is a ClientStellarSigner
 */
export function isClientStellarSigner(signer: unknown): signer is ClientStellarSigner {
  if (typeof signer !== "object" || signer === null) return false;
  const s = signer as Record<string, unknown>;
  return (
    typeof s.address === "string" &&
    typeof s.signAuthEntry === "function" &&
    (s.signTransaction === undefined || typeof s.signTransaction === "function") &&
    (s.authorizeEntry === undefined || typeof s.authorizeEntry === "function")
  );
}
