export { ExactStellarScheme } from './exact/client/index.js';
export { C as ClientAuthorizeEntry, a as ClientStellarSigner, D as DEFAULT_ESTIMATED_LEDGER_SECONDS, E as Ed25519Signer, F as FacilitatorStellarSigner, R as RpcConfig, m as convertToTokenAmount, c as createEd25519Signer, k as getEstimatedLedgerCloseTimeSeconds, j as getHorizonClient, g as getNetworkPassphrase, h as getRpcClient, f as getRpcUrl, l as getUsdcAddress, b as isClientStellarSigner, i as isFacilitatorStellarSigner, d as isStellarNetwork, e as validateStellarAssetAddress, v as validateStellarDestinationAddress } from './signer-y6mitpOC.js';
import { xdr, Transaction } from '@stellar/stellar-sdk';
import { Api } from '@stellar/stellar-sdk/rpc';
import { DefaultAssetTable, DefaultAsset, GetDefaultAsset, FindDefaultAsset } from '@x402/core/types';
export { numberToDecimalString } from '@x402/core/utils';
import '@stellar/stellar-sdk/contract';

/**
 * Exact Stellar payload structure containing a base64 encoded Stellar transaction
 */
type ExactStellarPayloadV2 = {
    /**
     * Base64 encoded Stellar transaction
     */
    transaction: string;
};

/**
 * CAIP-2 network identifiers for Stellar (V2)
 */
declare const STELLAR_PUBNET_CAIP2 = "stellar:pubnet";
declare const STELLAR_TESTNET_CAIP2 = "stellar:testnet";
declare const STELLAR_WILDCARD_CAIP2 = "stellar:*";
/**
 * Default testnet RPC URL
 */
declare const DEFAULT_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
/**
 * Default Horizon API URLs
 */
declare const DEFAULT_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
declare const DEFAULT_PUBNET_HORIZON_URL = "https://horizon.stellar.org";
/**
 * Stellar validation regex for destination and asset addresses
 */
declare const STELLAR_DESTINATION_ADDRESS_REGEX: RegExp;
declare const STELLAR_ASSET_ADDRESS_REGEX: RegExp;
/**
 * USDC contract addresses (default stablecoin)
 */
declare const USDC_PUBNET_ADDRESS = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
declare const USDC_TESTNET_ADDRESS = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
declare const STELLAR_NETWORK_TO_PASSPHRASE: ReadonlyMap<string, string>;
/**
 * Default token decimals
 */
declare const DEFAULT_TOKEN_DECIMALS = 7;

/**
 * Handles the simulation result of a Stellar transaction.
 *
 * @param simulation - The simulation result to handle
 * @throws An error if the simulation result is of type "RESTORE" or "ERROR"
 */
declare function handleSimulationResult(simulation?: Api.SimulateTransactionResponse): void;
/**
 * Returns the address credentials carried by a Soroban credential union, for
 * the legacy V1 `sorobanCredentialsAddress` arm, the CAP-71 V2
 * `sorobanCredentialsAddressV2` arm (accepted from Protocol 28 onward), and
 * the CAP-71-01 `sorobanCredentialsAddressWithDelegates` arm, where the
 * top-level address credentials are returned (the delegates are available via
 * {@link getDelegateSignatures}). All three arms wrap the same
 * `SorobanAddressCredentials` structure and differ only in the preimage the
 * signer commits to and in who may sign. Returns `undefined` for the
 * source-account arm.
 *
 * @param credentials - The credential union from an auth entry
 * @returns The (top-level) address credentials, or undefined for the source-account arm
 */
declare function getAddressCredentials(credentials: xdr.SorobanCredentials): xdr.SorobanAddressCredentials | undefined;
/**
 * Returns the delegate signatures attached to a CAP-71-01
 * `sorobanCredentialsAddressWithDelegates` credential union, or an empty array
 * for every other arm.
 *
 * @param credentials - The credential union from an auth entry
 * @returns The top-level delegate signatures (each may carry nested delegates)
 */
declare function getDelegateSignatures(credentials: xdr.SorobanCredentials): xdr.SorobanDelegateSignature[];
/**
 * Whether a credential signature value carries a signature.
 * An `scvVoid` signature means the node has not signed.
 *
 * @param signature - The signature ScVal from address credentials or a delegate
 * @returns `true` if the signature is anything other than `scvVoid`
 */
declare function isSignaturePresent(signature: xdr.ScVal): boolean;
/**
 * Whether every delegate in the tree (recursively, including nested delegates)
 * carries a signature. An empty list is vacuously fully signed; callers that
 * need "at least one delegate" must check the length themselves.
 *
 * @param delegates - The delegate signatures to inspect
 * @returns `true` if every delegate and nested delegate has a non-void signature
 */
declare function areAllDelegatesSigned(delegates: xdr.SorobanDelegateSignature[]): boolean;
/**
 * Collects every delegate address in the tree (recursively, including nested
 * delegates) as a strkey string.
 *
 * @param delegates - The delegate signatures to walk
 * @returns The delegate addresses, depth-first, duplicates preserved
 */
declare function collectDelegateAddresses(delegates: xdr.SorobanDelegateSignature[]): string[];
/**
 * Whether an address-based auth entry counts as signed.
 *
 * For the V1 and V2 address arms this is simply whether the signature is not
 * `scvVoid`. For the CAP-71-01 delegates arm the entry also counts as signed
 * when the top-level signature is void but delegates are present and every
 * delegate (recursively) carries a signature, which is how a G-account
 * authorizes purely through its delegated signers (CAP-72).
 *
 * @param credentials - The credential union from an auth entry
 * @returns `true` if the entry is signed, `false` if it is pending or has no address credentials
 */
declare function isAuthEntrySigned(credentials: xdr.SorobanCredentials): boolean;
/**
 * Analysis result of transaction signers
 */
type ContractSigners = {
    /** Accounts that have already signed auth entries */
    alreadySigned: string[];
    /** Accounts that still need to sign auth entries */
    pendingSignature: string[];
};
/**
 * Input parameters for gathering auth entry signature status
 */
type GatherAuthEntrySignatureStatusInput = {
    /** The transaction to analyze */
    transaction: Transaction;
    /** Optional simulation response to assemble with transaction before analysis */
    simulationResponse?: Api.SimulateTransactionResponse;
    /** Whether to simulate/assemble the transaction with simulation data (default: true if simulationResponse was not provided) */
    simulate?: boolean;
};
/**
 * Gathers the signature status of auth entries in a Stellar transaction.
 *
 * This function inspects the auth entries in the transaction's InvokeHostFunction
 * operation and categorizes them based on their signature status.
 *
 * @param input - Input containing transaction and optional simulation data
 * @param input.transaction - The transaction to analyze
 * @param input.simulationResponse - Optional simulation response to assemble with transaction before analysis
 * @param input.simulate - Whether to simulate/assemble the transaction with simulation data (default: true if simulationResponse was not provided)
 * @returns ContractSigners with arrays of signed and pending signer addresses
 * @throws Error if transaction doesn't have exactly one InvokeHostFunction operation
 *
 * @example
 * ```ts
 * const status = gatherAuthEntrySignatureStatus({
 *   transaction: tx,
 *   simulationResponse: simResult
 * });
 * console.log('Already signed:', status.alreadySigned);
 * console.log('Pending:', status.pendingSignature);
 * ```
 */
declare function gatherAuthEntrySignatureStatus({ transaction, simulationResponse, simulate, }: GatherAuthEntrySignatureStatusInput): ContractSigners;

type StellarDefaultAsset = DefaultAsset;
/** Default USD-pegged assets by CAIP-2 network; index 0 is the `"$0.10"` default. */
declare const DEFAULT_ASSETS: DefaultAssetTable<StellarDefaultAsset>;
/**
 * Look up a default asset by network and optional ticker.
 *
 * @param network - CAIP-2 network
 * @param symbol - Ticker; omit for the network default
 * @returns Matching entry
 * @throws If network or ticker is unknown
 */
declare const getDefaultAsset: GetDefaultAsset<StellarDefaultAsset>;
/**
 * Reverse lookup by asset id and network.
 *
 * @param asset - Contract address from payment requirements
 * @param network - CAIP-2 network
 * @returns Matching entry, or undefined
 */
declare const findDefaultAsset: FindDefaultAsset<StellarDefaultAsset>;

export { type ContractSigners, DEFAULT_ASSETS, DEFAULT_PUBNET_HORIZON_URL, DEFAULT_TESTNET_HORIZON_URL, DEFAULT_TESTNET_RPC_URL, DEFAULT_TOKEN_DECIMALS, type ExactStellarPayloadV2, type GatherAuthEntrySignatureStatusInput, STELLAR_ASSET_ADDRESS_REGEX, STELLAR_DESTINATION_ADDRESS_REGEX, STELLAR_NETWORK_TO_PASSPHRASE, STELLAR_PUBNET_CAIP2, STELLAR_TESTNET_CAIP2, STELLAR_WILDCARD_CAIP2, type StellarDefaultAsset, USDC_PUBNET_ADDRESS, USDC_TESTNET_ADDRESS, areAllDelegatesSigned, collectDelegateAddresses, findDefaultAsset, gatherAuthEntrySignatureStatus, getAddressCredentials, getDefaultAsset, getDelegateSignatures, handleSimulationResult, isAuthEntrySigned, isSignaturePresent };
