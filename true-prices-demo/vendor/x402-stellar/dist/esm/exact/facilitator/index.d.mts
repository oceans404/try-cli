import { R as RpcConfig, F as FacilitatorStellarSigner } from '../../signer-y6mitpOC.mjs';
import { SchemeNetworkFacilitator, Network, PaymentPayload, PaymentRequirements, VerifyResponse, SettleResponse } from '@x402/core/types';
import '@stellar/stellar-sdk';
import '@stellar/stellar-sdk/contract';

/**
 * Stellar facilitator implementation for the Exact payment scheme.
 */
declare class ExactStellarScheme implements SchemeNetworkFacilitator {
    readonly scheme = "exact";
    readonly caipFamily = "stellar:*";
    readonly signingAddresses: ReadonlySet<string>;
    readonly areFeesSponsored: boolean;
    readonly rpcConfig?: RpcConfig;
    readonly maxTransactionFeeStroops: number;
    readonly inclusionFeeStroops: number;
    readonly feeBumpSigner?: FacilitatorStellarSigner;
    private readonly signerMap;
    private readonly selectSigner;
    /**
     * Addresses the facilitator-safety checks must treat as facilitator-controlled.
     * Deliberately a separate set from `signingAddresses`: that set also backs
     * signer *selection* (`signerMap.get(...)` in `settle()`), and `feeBumpSigner`
     * has no entry in `signerMap`, so merging it into `signingAddresses` directly
     * would let round-robin selection pick an address `settle()` can't sign with.
     */
    private readonly facilitatorSafetyAddresses;
    /**
     * Creates a new ExactStellarScheme instance.
     *
     * @param signers - One or more Stellar signers managed by the facilitator for settlement
     * @param options - Configuration options
     * @param options.rpcConfig - Optional RPC configuration with custom RPC URL
     * @param options.areFeesSponsored - Indicates if fees are sponsored (default: true)
     * @param options.maxTransactionFeeStroops - Safety ceiling in stroops; verify rejects if the simulation-derived fee exceeds this (default: 50_000)
     * @param options.inclusionFeeStroops - Inclusion fee bid in stroops for the settlement transaction and the fee bump, on top of the resource fee (default: 100).
     *   Mainnet often needs more than the minimum for Soroban transactions to be included.
     * @param options.selectSigner - Callback to select which signer to use (default: round-robin)
     * @param options.feeBumpSigner - Optional signer used as fee source in a fee bump transaction wrapper.
     *   When provided, settle() wraps the inner transaction (signed by the selected signer) in a
     *   FeeBumpTransaction where the feeBumpSigner pays the fees, decoupling fee payment from sequence number management.
     * @returns ExactStellarScheme instance
     */
    constructor(signers: FacilitatorStellarSigner[], { rpcConfig, areFeesSponsored, maxTransactionFeeStroops, inclusionFeeStroops, selectSigner, feeBumpSigner, }?: {
        /** Optional RPC configuration with custom RPC URL */
        rpcConfig?: RpcConfig;
        /** Indicates if fees are sponsored (default: true) */
        areFeesSponsored?: boolean;
        /** Safety ceiling in stroops; verify rejects if the simulation-derived fee exceeds this (default: 50_000) */
        maxTransactionFeeStroops?: number;
        /** Inclusion fee bid in stroops for the settlement transaction and the fee bump (default: 100) */
        inclusionFeeStroops?: number;
        /** Optional callback to select which signer to use. Receives addresses array, returns selected address. Defaults to round-robin. */
        selectSigner?: (addresses: readonly string[]) => string;
        /** Optional signer used as fee source in a fee bump transaction wrapper. Decouples fee payment from sequence number management. */
        feeBumpSigner?: FacilitatorStellarSigner;
    });
    /**
     * Get mechanism-specific extra data for the supported kinds endpoint.
     * For Stellar, returns `areFeesSponsored` indicating to clients if they can expect fees to be sponsored.
     * As of now, the spec only supports `areFeesSponsored: true`.
     *
     * @param _ - The network identifier (unused, offset is network-agnostic)
     * @returns Extra data with the `areFeesSponsored` flag
     */
    getExtra(_: Network): Record<string, unknown> | undefined;
    /**
     * Get signer addresses used by this facilitator.
     * For Stellar, returns all facilitator addresses including the fee bump signer when configured.
     *
     * @param _ - The network identifier (unused for Stellar)
     * @returns Array containing all facilitator addresses
     */
    getSigners(_: string): string[];
    /**
     * Verifies a payment payload.
     *
     * @param payload - The payment payload to verify
     * @param requirements - The payment requirements
     * @returns Promise resolving to verification response
     */
    verify(payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse>;
    /**
     * Settles a payment by submitting the transaction on-chain.
     *
     * @param payload - The payment payload to settle
     * @param requirements - The payment requirements
     * @returns Promise resolving to settlement response
     */
    settle(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse>;
    /**
     * Internal verification that also returns the simulation result for settlement.
     *
     * @param payload - The payment payload to verify
     * @param requirements - The payment requirements
     * @returns Verification response and optional simulation result
     */
    private _verify;
    /**
     * Polls for transaction confirmation on Soroban.
     *
     * @param server - Soroban RPC server
     * @param txHash - Transaction hash to poll for
     * @param maxPollAttempts - Maximum number of polling attempts (default: 15)
     * @param delayMs - Delay between attempts in milliseconds (default: 1000)
     * @returns Result with success status
     */
    private pollForTransaction;
    /**
     * Validates simulation events for transfer correctness.
     * Ensures there is exactly one token transfer event, the transfer matches the
     * expected sender, recipient, amount, and asset (contract address), and the
     * facilitator address is not involved in the transfer.
     *
     * @param events - The array of DiagnosticEvent objects from the simulation
     * @param fromAddress - The payer's address
     * @param toAddress - The recipient's address
     * @param expectedAmount - The expected transfer amount
     * @param expectedAsset - The expected token contract address
     * @returns undefined if the validation succeeds, otherwise an invalid VerifyResponse
     */
    private validateSimulationEvents;
    /**
     * Validates authorization entries: structure, credential type, expiration,
     * facilitator safety, no sub-invocations, and that the payer has signed and
     * no other signatures are pending (per simulation).
     *
     * Address credentials may be legacy V1, CAP-71 V2, or CAP-71-01
     * address-with-delegates. For the delegates arm the payer is the top-level
     * address, the expiration check uses the top-level
     * `signatureExpirationLedger`, the entry counts as signed when the top-level
     * signature is present or when every (nested) delegate has signed, and the
     * facilitator must not appear as the top-level address or as any delegate.
     *
     * @param invokeOp - The invoke host function operation
     * @param facilitatorAddresses - Set of all facilitator addresses
     * @param fromAddress - The payer's address (for error reporting)
     * @param maxLedger - The maximum allowed expiration ledger
     * @param transaction - The full transaction (for signature status)
     * @param simResponse - The simulation result (used to interpret auth entry signatures)
     * @returns Invalid VerifyResponse when validation fails
     */
    private validateAuthEntries;
}

export { ExactStellarScheme };
