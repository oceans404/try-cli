import * as _x402_core_types from '@x402/core/types';
import { SchemeNetworkClient, PaymentRequirements, PaymentPayload } from '@x402/core/types';
import { a as ClientStellarSigner, R as RpcConfig } from '../../signer-y6mitpOC.mjs';
import '@stellar/stellar-sdk';
import '@stellar/stellar-sdk/contract';

/**
 * Stellar client implementation for the Exact payment scheme.
 */
declare class ExactStellarScheme implements SchemeNetworkClient {
    private readonly signer;
    private readonly rpcConfig?;
    readonly scheme = "exact";
    findDefaultAsset: _x402_core_types.FindDefaultAsset<_x402_core_types.DefaultAsset>;
    /**
     * Creates a new ExactStellarScheme instance.
     *
     * @param signer - The Stellar signer for client operations
     * @param rpcConfig - Optional configuration with custom RPC URL
     * @returns ExactStellarScheme instance
     */
    constructor(signer: ClientStellarSigner, rpcConfig?: RpcConfig | undefined);
    /**
     * Creates a payment payload for the Exact scheme.
     *
     * @param x402Version - The x402 protocol version
     * @param paymentRequirements - The payment requirements
     * @returns Promise resolving to a payment payload
     */
    createPaymentPayload(x402Version: number, paymentRequirements: PaymentRequirements): Promise<Pick<PaymentPayload, "x402Version" | "payload">>;
    /**
     * Validates the input parameters for the createAndSignPayment function.
     *
     * @param paymentRequirements - Payment requirements
     * @throws Error if validation fails
     */
    private validateCreateAndSignPaymentInput;
}

export { ExactStellarScheme };
