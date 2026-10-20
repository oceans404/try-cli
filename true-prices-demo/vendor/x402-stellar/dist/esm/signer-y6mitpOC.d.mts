import { rpc, Horizon, xdr } from '@stellar/stellar-sdk';
import { Network } from '@x402/core/types';
import { SignAuthEntry, SignTransaction } from '@stellar/stellar-sdk/contract';

declare const DEFAULT_ESTIMATED_LEDGER_SECONDS = 5;
/**
 * Configuration for RPC client connections
 */
interface RpcConfig {
    /** Custom RPC URL to use instead of defaults */
    url?: string;
}
/**
 * Checks if a network is a Stellar network
 *
 * @param network - The CAIP-2 network identifier
 * @returns `true` if the network is a Stellar network, `false` otherwise
 */
declare function isStellarNetwork(network: Network): boolean;
/**
 * Validates a Stellar destination address (G-account, C-account, or M-account)
 *
 * @param address - Stellar destination address to validate
 * @returns `true` if the address is valid, `false` otherwise
 */
declare function validateStellarDestinationAddress(address: string): boolean;
/**
 * Validates a Stellar asset/contract address (C-account only)
 *
 * @param address - Stellar asset address to validate
 * @returns `true` if the address is valid, `false` otherwise
 */
declare function validateStellarAssetAddress(address: string): boolean;
/**
 * Gets the network passphrase for a given Stellar network
 *
 * @param network - The CAIP-2 network identifier
 * @returns The network passphrase string
 * @throws {Error} If the network is not a known Stellar network
 */
declare function getNetworkPassphrase(network: Network): string;
/**
 * Gets the RPC URL for a given Stellar network
 *
 * @param network - The CAIP-2 network identifier
 * @param rpcConfig - Optional RPC configuration with custom URL
 * @returns The RPC URL string
 * @throws {Error} If the network is unknown or mainnet RPC URL is not provided
 */
declare function getRpcUrl(network: Network, rpcConfig?: RpcConfig): string;
/**
 * Creates a Soroban RPC client for the given network
 *
 * @param network - The CAIP-2 network identifier
 * @param rpcConfig - Optional RPC configuration with custom URL
 * @returns A configured Soroban RPC Server instance
 * @throws {Error} If the network is not a valid Stellar network
 */
declare function getRpcClient(network: Network, rpcConfig?: RpcConfig): rpc.Server;
/**
 * Creates a Horizon SDK client for the given network.
 *
 * @param network - The CAIP-2 network identifier
 * @returns A configured Horizon.Server instance
 * @throws {Error} If the network is unknown
 */
declare function getHorizonClient(network: Network): Horizon.Server;
/**
 * Estimates ledger close time by fetching the most recent ledgers from Horizon.
 *
 * Uses the Horizon SDK's ledger query builder which is significantly faster
 * than the Soroban RPC `getLedgers` method for this purpose.
 *
 * @param network - The CAIP-2 network identifier
 * @returns Estimated seconds per ledger, or DEFAULT_ESTIMATED_LEDGER_SECONDS (5) on error
 */
declare function getEstimatedLedgerCloseTimeSeconds(network: Network): Promise<number>;
/**
 * Gets the default USDC contract address for a network
 *
 * @param network - The CAIP-2 network identifier
 * @returns The USDC contract address for the network
 * @throws {Error} If the network doesn't have a configured USDC address
 */
declare function getUsdcAddress(network: Network): string;

/**
 * Converts a decimal amount to token smallest units.
 * Wraps the core utility with Stellar's default of 7 decimal places.
 *
 * @param decimalAmount - The decimal amount as a string
 * @param decimals - Number of decimal places for the token (default: 7 for Stellar USDC)
 * @returns The amount in smallest units as a string
 */
declare function convertToTokenAmount(decimalAmount: string, decimals?: number): string;

/**
 * Ed25519 signer for Stellar transactions and auth entries.
 *
 * Implements SEP-43 interface (except signMessage).
 *
 * @see https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0043.md
 */
type Ed25519Signer = {
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
type FacilitatorStellarSigner = Ed25519Signer;
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
type ClientAuthorizeEntry = (entry: xdr.SorobanAuthorizationEntry, validUntilLedgerSeq: number, networkPassphrase: string) => Promise<xdr.SorobanAuthorizationEntry>;
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
type ClientStellarSigner = {
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
declare function createEd25519Signer(privateKey: string, defaultNetwork?: Network): Ed25519Signer;
/**
 * Type guard for FacilitatorStellarSigner.
 *
 * Checks for required methods: address, signAuthEntry, signTransaction.
 *
 * @param signer - Value to check
 * @returns `true` if signer is a FacilitatorStellarSigner
 */
declare function isFacilitatorStellarSigner(signer: unknown): signer is FacilitatorStellarSigner;
/**
 * Type guard for ClientStellarSigner.
 *
 * Checks for required methods: address, signAuthEntry. signTransaction and
 * authorizeEntry are optional but must be functions when present.
 *
 * @param signer - Value to check
 * @returns `true` if signer is a ClientStellarSigner
 */
declare function isClientStellarSigner(signer: unknown): signer is ClientStellarSigner;

export { type ClientAuthorizeEntry as C, DEFAULT_ESTIMATED_LEDGER_SECONDS as D, type Ed25519Signer as E, type FacilitatorStellarSigner as F, type RpcConfig as R, type ClientStellarSigner as a, isClientStellarSigner as b, createEd25519Signer as c, isStellarNetwork as d, validateStellarAssetAddress as e, getRpcUrl as f, getNetworkPassphrase as g, getRpcClient as h, isFacilitatorStellarSigner as i, getHorizonClient as j, getEstimatedLedgerCloseTimeSeconds as k, getUsdcAddress as l, convertToTokenAmount as m, validateStellarDestinationAddress as v };
