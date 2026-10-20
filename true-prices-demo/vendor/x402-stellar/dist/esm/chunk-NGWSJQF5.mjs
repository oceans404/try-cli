import {
  getAddressCredentials,
  getEstimatedLedgerCloseTimeSeconds,
  getNetworkPassphrase,
  getRpcClient,
  getRpcUrl,
  handleSimulationResult,
  isAuthEntrySigned,
  isStellarNetwork,
  validateStellarAssetAddress,
  validateStellarDestinationAddress
} from "./chunk-GJAM6N6R.mjs";
import {
  findDefaultAsset
} from "./chunk-2G7L7YFT.mjs";

// src/exact/client/scheme.ts
import { nativeToScVal, contract, Address } from "@stellar/stellar-sdk";
var ExactStellarScheme = class {
  /**
   * Creates a new ExactStellarScheme instance.
   *
   * @param signer - The Stellar signer for client operations
   * @param rpcConfig - Optional configuration with custom RPC URL
   * @returns ExactStellarScheme instance
   */
  constructor(signer, rpcConfig) {
    this.signer = signer;
    this.rpcConfig = rpcConfig;
    this.scheme = "exact";
    this.findDefaultAsset = findDefaultAsset;
  }
  /**
   * Creates a payment payload for the Exact scheme.
   *
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(x402Version, paymentRequirements) {
    try {
      this.validateCreateAndSignPaymentInput(paymentRequirements);
    } catch (error) {
      throw new Error(`Invalid input parameters for creating Stellar payment, cause: ${error}`);
    }
    const sourcePublicKey = this.signer.address;
    const { network, payTo, asset, amount, extra, maxTimeoutSeconds } = paymentRequirements;
    const networkPassphrase = getNetworkPassphrase(network);
    const rpcUrl = getRpcUrl(network, this.rpcConfig);
    if (!extra.areFeesSponsored) {
      throw new Error(`Exact scheme requires areFeesSponsored to be true`);
    }
    const rpcServer = getRpcClient(network, this.rpcConfig);
    const latestLedger = await rpcServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;
    const estimatedLedgerSeconds = await getEstimatedLedgerCloseTimeSeconds(network);
    const maxLedger = currentLedger + Math.ceil(maxTimeoutSeconds / estimatedLedgerSeconds);
    const tx = await contract.AssembledTransaction.build({
      contractId: asset,
      method: "transfer",
      args: [
        // SEP-41 spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md#interface
        nativeToScVal(sourcePublicKey, { type: "address" }),
        // from
        nativeToScVal(payTo, { type: "address" }),
        // to
        nativeToScVal(amount, { type: "i128" })
        // amount
      ],
      networkPassphrase,
      rpcUrl,
      parseResultXdr: (result) => result
    });
    handleSimulationResult(tx.simulation);
    let missingSigners = tx.needsNonInvokerSigningBy();
    if (!missingSigners.includes(sourcePublicKey) || missingSigners.length > 1) {
      throw new Error(
        `Expected to sign with [${sourcePublicKey}], but got [${missingSigners.join(", ")}]`
      );
    }
    if (this.signer.authorizeEntry) {
      const authorizeEntry = this.signer.authorizeEntry;
      await tx.signAuthEntries({
        address: sourcePublicKey,
        expiration: maxLedger,
        authorizeEntry: (entry, _signer, validUntilLedgerSeq, networkPassphrase2) => authorizeEntry(entry, validUntilLedgerSeq, networkPassphrase2)
      });
    } else {
      await tx.signAuthEntries({
        address: sourcePublicKey,
        signAuthEntry: this.signer.signAuthEntry,
        expiration: maxLedger
      });
    }
    await tx.simulate();
    handleSimulationResult(tx.simulation);
    missingSigners = tx.needsNonInvokerSigningBy().filter((address) => !signedThroughDelegates(tx.built?.operations?.[0], address));
    if (missingSigners.length > 0) {
      throw new Error(`unexpected signer(s) required: [${missingSigners.join(", ")}]`);
    }
    return {
      x402Version,
      payload: {
        transaction: tx.built.toXdr()
      }
    };
  }
  /**
   * Validates the input parameters for the createAndSignPayment function.
   *
   * @param paymentRequirements - Payment requirements
   * @throws Error if validation fails
   */
  validateCreateAndSignPaymentInput(paymentRequirements) {
    const { scheme, network, payTo, asset, amount } = paymentRequirements;
    if (typeof amount !== "string" || !Number.isInteger(Number(amount)) || Number(amount) <= 0) {
      throw new Error(`Invalid amount: ${amount}. Amount must be a positive integer.`);
    }
    if (scheme !== "exact") {
      throw new Error(`Unsupported scheme: ${scheme}`);
    }
    if (!isStellarNetwork(network)) {
      throw new Error(`Unsupported Stellar network: ${network}`);
    }
    if (!validateStellarDestinationAddress(payTo)) {
      throw new Error(`Invalid Stellar destination address: ${payTo}`);
    }
    if (!validateStellarAssetAddress(asset)) {
      throw new Error(`Invalid Stellar asset address: ${asset}`);
    }
  }
};
function signedThroughDelegates(op, address) {
  const invoke = op;
  const auth = invoke?.type === "invokeHostFunction" ? invoke.auth ?? [] : [];
  const mine = auth.filter((entry) => {
    const creds = getAddressCredentials(entry.credentials);
    return creds !== void 0 && Address.fromScAddress(creds.address).toString() === address;
  });
  return mine.length > 0 && mine.every((entry) => isAuthEntrySigned(entry.credentials));
}

export {
  ExactStellarScheme
};
//# sourceMappingURL=chunk-NGWSJQF5.mjs.map