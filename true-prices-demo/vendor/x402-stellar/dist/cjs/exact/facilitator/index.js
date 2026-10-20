"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/exact/facilitator/index.ts
var facilitator_exports = {};
__export(facilitator_exports, {
  ExactStellarScheme: () => ExactStellarScheme
});
module.exports = __toCommonJS(facilitator_exports);

// src/exact/facilitator/scheme.ts
var import_stellar_sdk3 = require("@stellar/stellar-sdk");
var import_rpc2 = require("@stellar/stellar-sdk/rpc");

// src/constants.ts
var STELLAR_PUBNET_CAIP2 = "stellar:pubnet";
var STELLAR_TESTNET_CAIP2 = "stellar:testnet";
var STELLAR_WILDCARD_CAIP2 = "stellar:*";
var DEFAULT_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
var DEFAULT_TESTNET_HORIZON_URL = "https://horizon-testnet.stellar.org";
var DEFAULT_PUBNET_HORIZON_URL = "https://horizon.stellar.org";
var USDC_PUBNET_ADDRESS = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
var USDC_TESTNET_ADDRESS = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
var STELLAR_NETWORK_TO_PASSPHRASE = /* @__PURE__ */ new Map([
  [STELLAR_PUBNET_CAIP2, "Public Global Stellar Network ; September 2015"],
  [STELLAR_TESTNET_CAIP2, "Test SDF Network ; September 2015"]
]);
var DEFAULT_TOKEN_DECIMALS = 7;

// src/shared.ts
var import_stellar_sdk = require("@stellar/stellar-sdk");
var import_rpc = require("@stellar/stellar-sdk/rpc");
function getAddressCredentials(credentials) {
  switch (credentials.type) {
    case "sorobanCredentialsAddress":
      return credentials.address;
    case "sorobanCredentialsAddressV2":
      return credentials.addressV2;
    case "sorobanCredentialsAddressWithDelegates":
      return credentials.addressWithDelegates.addressCredentials;
    default:
      return void 0;
  }
}
function getDelegateSignatures(credentials) {
  if (credentials.type === "sorobanCredentialsAddressWithDelegates") {
    return credentials.addressWithDelegates.delegates;
  }
  return [];
}
function isSignaturePresent(signature) {
  return signature.type !== "scvVoid";
}
function areAllDelegatesSigned(delegates) {
  return delegates.every(
    (delegate) => isSignaturePresent(delegate.signature) && areAllDelegatesSigned(delegate.nestedDelegates)
  );
}
function collectDelegateAddresses(delegates) {
  return delegates.flatMap((delegate) => [
    import_stellar_sdk.Address.fromScAddress(delegate.address).toString(),
    ...collectDelegateAddresses(delegate.nestedDelegates)
  ]);
}
function isAuthEntrySigned(credentials) {
  const addressCredentials = getAddressCredentials(credentials);
  if (!addressCredentials) {
    return false;
  }
  if (isSignaturePresent(addressCredentials.signature)) {
    return true;
  }
  const delegates = getDelegateSignatures(credentials);
  return delegates.length > 0 && areAllDelegatesSigned(delegates);
}
function gatherAuthEntrySignatureStatus({
  transaction,
  simulationResponse,
  simulate
}) {
  const shouldAssemble = simulate ?? simulationResponse !== void 0;
  let assembledTx = transaction;
  if (shouldAssemble && simulationResponse) {
    const assembledTxBuilder = (0, import_rpc.assembleTransaction)(transaction, simulationResponse);
    assembledTx = assembledTxBuilder.build();
  }
  if (assembledTx.operations.length !== 1) {
    throw new Error(
      `Expected transaction with exactly one operation, got ${assembledTx.operations.length}`
    );
  }
  const operation = assembledTx.operations[0];
  if (operation.type !== "invokeHostFunction") {
    throw new Error(`Expected InvokeHostFunction operation, got ${operation.type}`);
  }
  const invokeOp = operation;
  const alreadySigned = [];
  const pendingSignature = [];
  for (const entry of invokeOp.auth ?? []) {
    const addressCredentials = getAddressCredentials(entry.credentials);
    if (addressCredentials) {
      const address = import_stellar_sdk.Address.fromScAddress(addressCredentials.address).toString();
      if (isAuthEntrySigned(entry.credentials)) {
        alreadySigned.push(address);
      } else {
        pendingSignature.push(address);
      }
    }
  }
  return {
    alreadySigned: [...new Set(alreadySigned)],
    // Remove duplicates
    pendingSignature: [...new Set(pendingSignature)]
  };
}

// src/utils.ts
var import_stellar_sdk2 = require("@stellar/stellar-sdk");
var import_utils = require("@x402/core/utils");

// src/defaultAssets.ts
var DEFAULT_ASSETS = {
  [STELLAR_PUBNET_CAIP2]: [
    { asset: USDC_PUBNET_ADDRESS, decimals: DEFAULT_TOKEN_DECIMALS, symbol: "USDC" }
  ],
  [STELLAR_TESTNET_CAIP2]: [
    { asset: USDC_TESTNET_ADDRESS, decimals: DEFAULT_TOKEN_DECIMALS, symbol: "USDC" }
  ]
};

// src/utils.ts
var DEFAULT_ESTIMATED_LEDGER_SECONDS = 5;
var HORIZON_LEDGERS_SAMPLE_SIZE = 20;
function isStellarNetwork(network) {
  return STELLAR_NETWORK_TO_PASSPHRASE.has(network);
}
function getNetworkPassphrase(network) {
  const networkPassphrase = STELLAR_NETWORK_TO_PASSPHRASE.get(network);
  if (!networkPassphrase) {
    throw new Error(`Unknown Stellar network: ${network}`);
  }
  return networkPassphrase;
}
function getRpcUrl(network, rpcConfig) {
  const customRpcUrl = rpcConfig?.url;
  switch (network) {
    case STELLAR_TESTNET_CAIP2:
      return customRpcUrl || DEFAULT_TESTNET_RPC_URL;
    case STELLAR_PUBNET_CAIP2:
      if (!customRpcUrl) {
        throw new Error(
          "Stellar mainnet requires a non-empty rpcUrl. For a list of RPC providers, see https://developers.stellar.org/docs/data/apis/rpc/providers#publicly-accessible-apis"
        );
      }
      return customRpcUrl;
    default:
      throw new Error(`Unknown Stellar network: ${network}`);
  }
}
function getRpcClient(network, rpcConfig) {
  const rpcUrl = getRpcUrl(network, rpcConfig);
  return new import_stellar_sdk2.rpc.Server(rpcUrl, {
    allowHttp: network === STELLAR_TESTNET_CAIP2
    // Allow HTTP for testnet
  });
}
function getHorizonClient(network) {
  switch (network) {
    case STELLAR_TESTNET_CAIP2:
      return new import_stellar_sdk2.Horizon.Server(DEFAULT_TESTNET_HORIZON_URL);
    case STELLAR_PUBNET_CAIP2:
      return new import_stellar_sdk2.Horizon.Server(DEFAULT_PUBNET_HORIZON_URL);
    default:
      throw new Error(`Unknown Stellar network: ${network}`);
  }
}
async function getEstimatedLedgerCloseTimeSeconds(network) {
  try {
    const horizon = getHorizonClient(network);
    const page = await horizon.ledgers().limit(HORIZON_LEDGERS_SAMPLE_SIZE).order("desc").call();
    const records = page.records;
    if (!records || records.length < 2) return DEFAULT_ESTIMATED_LEDGER_SECONDS;
    const newestTs = new Date(records[0].closed_at).getTime() / 1e3;
    const oldestTs = new Date(records[records.length - 1].closed_at).getTime() / 1e3;
    const intervals = records.length - 1;
    return Math.ceil((newestTs - oldestTs) / intervals);
  } catch {
    return DEFAULT_ESTIMATED_LEDGER_SECONDS;
  }
}

// src/exact/facilitator/scheme.ts
var DEFAULT_TIMEOUT_SECONDS = 60;
var SUPPORTED_X402_VERSION = 2;
var DEFAULT_MAX_TRANSACTION_FEE_STROOPS = 5e4;
var SIGNATURE_EXPIRATION_LEDGER_TOLERANCE = 2;
var roundRobinSelectSigner = () => {
  let index = 0;
  return (addrs) => addrs[index++ % addrs.length];
};
function invalidVerifyResponse(reason, payer, message) {
  return { isValid: false, invalidReason: reason, payer, invalidMessage: message };
}
function validVerifyResponse(payer) {
  return { isValid: true, payer };
}
var ExactStellarScheme = class {
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
  constructor(signers, {
    rpcConfig,
    areFeesSponsored = true,
    maxTransactionFeeStroops = DEFAULT_MAX_TRANSACTION_FEE_STROOPS,
    inclusionFeeStroops = Number(import_stellar_sdk3.BASE_FEE),
    selectSigner = roundRobinSelectSigner(),
    feeBumpSigner
  } = {}) {
    this.scheme = "exact";
    this.caipFamily = STELLAR_WILDCARD_CAIP2;
    if (!signers || signers.length === 0) {
      throw new Error("At least one signer is required");
    }
    this.signerMap = new Map(signers.map((s) => [s.address, s]));
    this.signingAddresses = new Set(this.signerMap.keys());
    this.rpcConfig = rpcConfig;
    this.areFeesSponsored = areFeesSponsored ?? true;
    this.maxTransactionFeeStroops = maxTransactionFeeStroops ?? DEFAULT_MAX_TRANSACTION_FEE_STROOPS;
    this.inclusionFeeStroops = inclusionFeeStroops ?? Number(import_stellar_sdk3.BASE_FEE);
    this.selectSigner = selectSigner ?? roundRobinSelectSigner();
    this.feeBumpSigner = feeBumpSigner;
    this.facilitatorSafetyAddresses = this.feeBumpSigner ? /* @__PURE__ */ new Set([...this.signingAddresses, this.feeBumpSigner.address]) : this.signingAddresses;
  }
  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * For Stellar, returns `areFeesSponsored` indicating to clients if they can expect fees to be sponsored.
   * As of now, the spec only supports `areFeesSponsored: true`.
   *
   * @param _ - The network identifier (unused, offset is network-agnostic)
   * @returns Extra data with the `areFeesSponsored` flag
   */
  getExtra(_) {
    return {
      areFeesSponsored: this.areFeesSponsored
    };
  }
  /**
   * Get signer addresses used by this facilitator.
   * For Stellar, returns all facilitator addresses including the fee bump signer when configured.
   *
   * @param _ - The network identifier (unused for Stellar)
   * @returns Array containing all facilitator addresses
   */
  getSigners(_) {
    const signers = [...this.signingAddresses];
    if (this.feeBumpSigner && !this.signingAddresses.has(this.feeBumpSigner.address)) {
      signers.push(this.feeBumpSigner.address);
    }
    return signers;
  }
  /**
   * Verifies a payment payload.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Promise resolving to verification response
   */
  async verify(payload, requirements) {
    return (await this._verify(payload, requirements)).response;
  }
  /**
   * Settles a payment by submitting the transaction on-chain.
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements
   * @returns Promise resolving to settlement response
   */
  async settle(payload, requirements) {
    const server = getRpcClient(requirements.network, this.rpcConfig);
    const networkPassphrase = getNetworkPassphrase(requirements.network);
    let payer;
    let txHash;
    try {
      const { response: verifyResult, simResponse } = await this._verify(payload, requirements);
      if (!verifyResult.isValid) {
        return {
          success: false,
          network: payload.accepted.network,
          transaction: "",
          errorReason: verifyResult.invalidReason ?? "verification_failed",
          payer: verifyResult.payer
        };
      }
      if (!simResponse) {
        return {
          success: false,
          network: payload.accepted.network,
          transaction: "",
          errorReason: "unexpected_settle_error",
          payer: verifyResult.payer
        };
      }
      payer = verifyResult.payer;
      const stellarPayload = payload.payload;
      const transaction = new import_stellar_sdk3.Transaction(stellarPayload.transaction, networkPassphrase);
      const sorobanData = simResponse.transactionData.build();
      const invokeOp = transaction.operations[0];
      const signer = this.signerMap.get(this.selectSigner([...this.signingAddresses]));
      if (!signer) {
        return {
          success: false,
          network: payload.accepted.network,
          transaction: "",
          errorReason: "settle_exact_stellar_signer_selection_failed",
          payer
        };
      }
      const facilitatorAccount = await server.getAccount(signer.address);
      const rebuiltTx = new import_stellar_sdk3.TransactionBuilder(facilitatorAccount, {
        fee: String(this.inclusionFeeStroops),
        networkPassphrase,
        ledgerbounds: transaction.ledgerBounds,
        memo: transaction.memo,
        minAccountSequence: transaction.minAccountSequence,
        minAccountSequenceAge: transaction.minAccountSequenceAge,
        minAccountSequenceLedgerGap: transaction.minAccountSequenceLedgerGap,
        extraSigners: transaction.extraSigners?.map(
          (signerKey) => import_stellar_sdk3.SignerKey.encodeSignerKey(signerKey)
        ),
        sorobanData
      }).setTimeout(requirements.maxTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS).addOperation(import_stellar_sdk3.Operation.invokeHostFunction(invokeOp)).build();
      const { signedTxXdr, error: signError } = await signer.signTransaction(rebuiltTx.toXdr(), {
        networkPassphrase
      });
      if (signError) {
        return {
          success: false,
          network: payload.accepted.network,
          transaction: "",
          errorReason: "settle_exact_stellar_transaction_signing_failed",
          payer
        };
      }
      let txToSubmit;
      if (this.feeBumpSigner) {
        const signedInnerTx = import_stellar_sdk3.TransactionBuilder.fromXdr(
          signedTxXdr,
          networkPassphrase
        );
        const feeBumpTx = import_stellar_sdk3.TransactionBuilder.buildFeeBumpTransaction(
          this.feeBumpSigner.address,
          // Same inclusion-only base fee; SDK adds the inner tx resource fee.
          String(this.inclusionFeeStroops),
          signedInnerTx,
          networkPassphrase
        );
        const { signedTxXdr: signedFeeBumpXdr, error: feeBumpSignError } = await this.feeBumpSigner.signTransaction(feeBumpTx.toXdr(), { networkPassphrase });
        if (feeBumpSignError) {
          return {
            success: false,
            network: payload.accepted.network,
            transaction: "",
            errorReason: "settle_exact_stellar_fee_bump_signing_failed",
            payer
          };
        }
        txToSubmit = import_stellar_sdk3.TransactionBuilder.fromXdr(
          signedFeeBumpXdr,
          networkPassphrase
        );
      } else {
        txToSubmit = import_stellar_sdk3.TransactionBuilder.fromXdr(signedTxXdr, networkPassphrase);
      }
      const sendResult = await server.sendTransaction(txToSubmit);
      if (sendResult.status !== "PENDING") {
        return {
          success: false,
          network: payload.accepted.network,
          transaction: "",
          errorReason: "settle_exact_stellar_transaction_submission_failed",
          payer
        };
      }
      txHash = sendResult.hash;
      const maxPollAttempts = requirements.maxTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
      const confirmResult = await this.pollForTransaction(server, txHash, maxPollAttempts);
      if (!confirmResult.success) {
        return {
          success: false,
          network: payload.accepted.network,
          transaction: txHash,
          errorReason: "settle_exact_stellar_transaction_failed",
          payer
        };
      }
      return {
        success: true,
        transaction: txHash,
        network: payload.accepted.network,
        payer
      };
    } catch (error) {
      console.error("Unexpected settlement error:", error);
      return {
        success: false,
        network: payload.accepted.network,
        transaction: txHash || "",
        errorReason: "unexpected_settle_error",
        payer
      };
    }
  }
  /**
   * Internal verification that also returns the simulation result for settlement.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Verification response and optional simulation result
   */
  async _verify(payload, requirements) {
    let fromAddress;
    try {
      if (payload.x402Version !== SUPPORTED_X402_VERSION) {
        return { response: invalidVerifyResponse("invalid_x402_version") };
      }
      if (payload.accepted.scheme !== "exact" || requirements.scheme !== "exact") {
        return { response: invalidVerifyResponse("unsupported_scheme") };
      }
      if (requirements.network !== payload.accepted.network) {
        return { response: invalidVerifyResponse("network_mismatch") };
      }
      if (!isStellarNetwork(requirements.network)) {
        return { response: invalidVerifyResponse("invalid_network") };
      }
      const networkPassphrase = getNetworkPassphrase(requirements.network);
      const server = getRpcClient(requirements.network, this.rpcConfig);
      const stellarPayload = payload.payload;
      if (!stellarPayload || typeof stellarPayload.transaction !== "string") {
        return { response: invalidVerifyResponse("invalid_exact_stellar_payload_malformed") };
      }
      let transaction;
      try {
        transaction = new import_stellar_sdk3.Transaction(stellarPayload.transaction, networkPassphrase);
      } catch (error) {
        console.error("Error parsing transaction:", error);
        return { response: invalidVerifyResponse("invalid_exact_stellar_payload_malformed") };
      }
      if (transaction.operations.length !== 1) {
        return { response: invalidVerifyResponse("invalid_exact_stellar_payload_wrong_operation") };
      }
      const operation = transaction.operations[0];
      if (operation.type !== "invokeHostFunction") {
        return { response: invalidVerifyResponse("invalid_exact_stellar_payload_wrong_operation") };
      }
      if (this.facilitatorSafetyAddresses.has(operation.source ?? "") || this.facilitatorSafetyAddresses.has(transaction.source)) {
        return {
          response: invalidVerifyResponse("invalid_exact_stellar_payload_unsafe_tx_or_op_source")
        };
      }
      const invokeOp = operation;
      const func = invokeOp.func;
      if (!func || func.type !== "hostFunctionTypeInvokeContract") {
        return { response: invalidVerifyResponse("invalid_exact_stellar_payload_wrong_operation") };
      }
      const invokeContractArgs = func.invokeContract;
      const contractAddress = import_stellar_sdk3.Address.fromScAddress(invokeContractArgs.contractAddress).toString();
      const functionName = invokeContractArgs.functionName.toString();
      const args = invokeContractArgs.args;
      if (contractAddress !== requirements.asset) {
        return { response: invalidVerifyResponse("invalid_exact_stellar_payload_wrong_asset") };
      }
      if (functionName !== "transfer" || args.length !== 3) {
        return {
          response: invalidVerifyResponse("invalid_exact_stellar_payload_wrong_function_name")
        };
      }
      fromAddress = (0, import_stellar_sdk3.scValToNative)(args[0]);
      const toAddress = (0, import_stellar_sdk3.scValToNative)(args[1]);
      const amount = (0, import_stellar_sdk3.scValToNative)(args[2]);
      if (this.facilitatorSafetyAddresses.has(fromAddress)) {
        return {
          response: invalidVerifyResponse("invalid_exact_stellar_payload_facilitator_is_payer")
        };
      }
      if (toAddress !== requirements.payTo) {
        return {
          response: invalidVerifyResponse(
            "invalid_exact_stellar_payload_wrong_recipient",
            fromAddress
          )
        };
      }
      const expectedAmount = BigInt(requirements.amount);
      if (amount !== expectedAmount) {
        return {
          response: invalidVerifyResponse(
            "invalid_exact_stellar_payload_wrong_amount",
            fromAddress
          )
        };
      }
      const simResponse = await server.simulateTransaction(transaction);
      if (!import_rpc2.Api.isSimulationSuccess(simResponse)) {
        const errorMsg = simResponse.error ? `: ${simResponse.error}` : "";
        console.error("Simulation error:", errorMsg);
        return {
          response: invalidVerifyResponse(
            "invalid_exact_stellar_payload_simulation_failed",
            fromAddress
          )
        };
      }
      const minResourceFee = parseInt(simResponse.minResourceFee, 10);
      const settlementFeeStroops = minResourceFee + this.inclusionFeeStroops;
      if (settlementFeeStroops > this.maxTransactionFeeStroops) {
        return {
          response: invalidVerifyResponse(
            "invalid_exact_stellar_payload_fee_exceeds_maximum",
            fromAddress,
            `simulation-derived fee ${settlementFeeStroops} stroops exceeds ceiling ${this.maxTransactionFeeStroops} stroops`
          )
        };
      }
      const eventValidation = this.validateSimulationEvents(
        simResponse.events,
        fromAddress,
        requirements.payTo,
        expectedAmount,
        requirements.asset
      );
      if (eventValidation) {
        return { response: eventValidation };
      }
      const latestLedger = await server.getLatestLedger();
      const currentLedger = latestLedger.sequence;
      const maxTimeoutSeconds = requirements.maxTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;
      const estimatedLedgerSeconds = await getEstimatedLedgerCloseTimeSeconds(requirements.network);
      const maxLedgerOffset = Math.ceil(maxTimeoutSeconds / estimatedLedgerSeconds);
      const maxLedger = currentLedger + maxLedgerOffset;
      const authValidation = this.validateAuthEntries(
        invokeOp,
        this.facilitatorSafetyAddresses,
        fromAddress,
        maxLedger,
        transaction,
        simResponse
      );
      if (authValidation) {
        return { response: authValidation };
      }
      return { response: validVerifyResponse(fromAddress), simResponse };
    } catch (error) {
      console.error("Unexpected verification error:", error);
      return { response: invalidVerifyResponse("unexpected_verify_error", fromAddress) };
    }
  }
  /**
   * Polls for transaction confirmation on Soroban.
   *
   * @param server - Soroban RPC server
   * @param txHash - Transaction hash to poll for
   * @param maxPollAttempts - Maximum number of polling attempts (default: 15)
   * @param delayMs - Delay between attempts in milliseconds (default: 1000)
   * @returns Result with success status
   */
  async pollForTransaction(server, txHash, maxPollAttempts = 15, delayMs = 1e3) {
    for (let i = 0; i < maxPollAttempts; i++) {
      try {
        const txResult = await server.getTransaction(txHash);
        if (txResult.status === "SUCCESS") {
          return { success: true };
        } else if (txResult.status === "FAILED") {
          return { success: false };
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } catch (error) {
        if (error instanceof Error && !error.message.includes("NOT_FOUND")) {
          console.warn(`Poll attempt ${i} failed:`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    return { success: false };
  }
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
  validateSimulationEvents(events, fromAddress, toAddress, expectedAmount, expectedAsset) {
    const transferEvents = [];
    for (const diagnosticEvent of events) {
      try {
        const event = diagnosticEvent.event;
        if (event.type.name !== "contract") {
          continue;
        }
        const body = event.body.v0;
        const topics = body.topics;
        if (topics.length < 3) {
          return invalidVerifyResponse(
            "invalid_exact_stellar_payload_event_not_transfer",
            fromAddress
          );
        }
        const topic = topics[0];
        if (topic.type !== "scvSymbol") {
          return invalidVerifyResponse(
            "invalid_exact_stellar_payload_event_not_transfer",
            fromAddress
          );
        }
        const symbol = topic.sym.toString();
        if (symbol !== "transfer") {
          return invalidVerifyResponse(
            "invalid_exact_stellar_payload_event_not_transfer",
            fromAddress
          );
        }
        const contractIdHash = event.contractId;
        if (!contractIdHash)
          return invalidVerifyResponse(
            "invalid_exact_stellar_payload_event_missing_contract_id",
            fromAddress
          );
        const eventContractAddress = import_stellar_sdk3.Address.fromScAddress(
          import_stellar_sdk3.xdr.ScAddress.scAddressTypeContract(contractIdHash)
        ).toString();
        if (eventContractAddress !== expectedAsset) {
          return invalidVerifyResponse(
            "invalid_exact_stellar_payload_event_wrong_asset",
            fromAddress
          );
        }
        const from = (0, import_stellar_sdk3.scValToNative)(topics[1]);
        const to = (0, import_stellar_sdk3.scValToNative)(topics[2]);
        const amount = (0, import_stellar_sdk3.scValToNative)(body.data);
        transferEvents.push({ from, to, amount });
      } catch (error) {
        if (error instanceof Error) {
          console.error("Error parsing diagnostic event:", error.message);
        } else {
          console.error("Error parsing diagnostic event:", String(error));
        }
        return invalidVerifyResponse("unexpected_verify_error", fromAddress);
      }
    }
    if (transferEvents.length === 0) {
      return invalidVerifyResponse("invalid_exact_stellar_payload_no_transfer_events", fromAddress);
    }
    if (transferEvents.length > 1) {
      return invalidVerifyResponse("invalid_exact_stellar_payload_multiple_transfers", fromAddress);
    }
    const transferEvent = transferEvents[0];
    if (transferEvent.from !== fromAddress) {
      return invalidVerifyResponse("invalid_exact_stellar_payload_event_wrong_from", fromAddress);
    }
    if (transferEvent.to !== toAddress) {
      return invalidVerifyResponse("invalid_exact_stellar_payload_event_wrong_to", fromAddress);
    }
    if (transferEvent.amount !== expectedAmount) {
      return invalidVerifyResponse("invalid_exact_stellar_payload_event_wrong_amount", fromAddress);
    }
    return void 0;
  }
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
  validateAuthEntries(invokeOp, facilitatorAddresses, fromAddress, maxLedger, transaction, simResponse) {
    if (!invokeOp.auth || invokeOp.auth.length === 0) {
      return invalidVerifyResponse("invalid_exact_stellar_payload_no_auth_entries", fromAddress);
    }
    for (const auth of invokeOp.auth) {
      const addressCredentials = getAddressCredentials(auth.credentials);
      if (!addressCredentials) {
        return invalidVerifyResponse(
          "invalid_exact_stellar_payload_unsupported_credential_type",
          fromAddress
        );
      }
      const authAddress = import_stellar_sdk3.Address.fromScAddress(addressCredentials.address).toString();
      const delegateAddresses = collectDelegateAddresses(getDelegateSignatures(auth.credentials));
      if (facilitatorAddresses.has(authAddress) || delegateAddresses.some((delegateAddress) => facilitatorAddresses.has(delegateAddress))) {
        return invalidVerifyResponse(
          "invalid_exact_stellar_payload_facilitator_in_auth",
          fromAddress
        );
      }
      const expirationLedger = addressCredentials.signatureExpirationLedger;
      if (expirationLedger > maxLedger + SIGNATURE_EXPIRATION_LEDGER_TOLERANCE) {
        return invalidVerifyResponse(
          "invalid_exact_stellar_signature_expiration_too_far",
          fromAddress
        );
      }
      const rootInvocation = auth.rootInvocation;
      if (rootInvocation.subInvocations.length > 0) {
        return invalidVerifyResponse(
          "invalid_exact_stellar_payload_has_subinvocations",
          fromAddress
        );
      }
    }
    const authStatus = gatherAuthEntrySignatureStatus({
      transaction,
      simulationResponse: simResponse
    });
    if (!authStatus.alreadySigned.includes(fromAddress)) {
      return invalidVerifyResponse(
        "invalid_exact_stellar_payload_missing_payer_signature",
        fromAddress
      );
    }
    if (authStatus.pendingSignature.length > 0) {
      return invalidVerifyResponse(
        "invalid_exact_stellar_payload_unexpected_pending_signatures",
        fromAddress
      );
    }
    return void 0;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ExactStellarScheme
});
//# sourceMappingURL=index.js.map