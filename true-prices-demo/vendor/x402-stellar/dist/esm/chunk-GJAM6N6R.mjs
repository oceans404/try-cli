import {
  DEFAULT_PUBNET_HORIZON_URL,
  DEFAULT_TESTNET_HORIZON_URL,
  DEFAULT_TESTNET_RPC_URL,
  DEFAULT_TOKEN_DECIMALS,
  STELLAR_ASSET_ADDRESS_REGEX,
  STELLAR_DESTINATION_ADDRESS_REGEX,
  STELLAR_NETWORK_TO_PASSPHRASE,
  STELLAR_PUBNET_CAIP2,
  STELLAR_TESTNET_CAIP2,
  getDefaultAsset
} from "./chunk-2G7L7YFT.mjs";

// src/shared.ts
import { Address } from "@stellar/stellar-sdk";
import { Api, assembleTransaction } from "@stellar/stellar-sdk/rpc";
function handleSimulationResult(simulation) {
  if (!simulation) {
    throw new Error("Simulation result is undefined");
  }
  if (Api.isSimulationRestore(simulation)) {
    throw new Error(
      `Stellar simulation result has type "RESTORE" with restorePreamble: ${simulation.restorePreamble}`
    );
  }
  if (Api.isSimulationError(simulation)) {
    const msg = `Stellar simulation failed${simulation.error ? ` with error message: ${simulation.error}` : ""}`;
    throw new Error(msg);
  }
}
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
    Address.fromScAddress(delegate.address).toString(),
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
    const assembledTxBuilder = assembleTransaction(transaction, simulationResponse);
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
      const address = Address.fromScAddress(addressCredentials.address).toString();
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
import { Horizon, rpc } from "@stellar/stellar-sdk";
import {
  convertToTokenAmount as coreConvertToTokenAmount,
  numberToDecimalString
} from "@x402/core/utils";
var DEFAULT_ESTIMATED_LEDGER_SECONDS = 5;
var HORIZON_LEDGERS_SAMPLE_SIZE = 20;
function isStellarNetwork(network) {
  return STELLAR_NETWORK_TO_PASSPHRASE.has(network);
}
function validateStellarDestinationAddress(address) {
  return STELLAR_DESTINATION_ADDRESS_REGEX.test(address);
}
function validateStellarAssetAddress(address) {
  return STELLAR_ASSET_ADDRESS_REGEX.test(address);
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
  return new rpc.Server(rpcUrl, {
    allowHttp: network === STELLAR_TESTNET_CAIP2
    // Allow HTTP for testnet
  });
}
function getHorizonClient(network) {
  switch (network) {
    case STELLAR_TESTNET_CAIP2:
      return new Horizon.Server(DEFAULT_TESTNET_HORIZON_URL);
    case STELLAR_PUBNET_CAIP2:
      return new Horizon.Server(DEFAULT_PUBNET_HORIZON_URL);
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
function getUsdcAddress(network) {
  return getDefaultAsset(network).asset;
}
function convertToTokenAmount(decimalAmount, decimals = DEFAULT_TOKEN_DECIMALS) {
  return coreConvertToTokenAmount(decimalAmount, decimals);
}

export {
  handleSimulationResult,
  getAddressCredentials,
  getDelegateSignatures,
  isSignaturePresent,
  areAllDelegatesSigned,
  collectDelegateAddresses,
  isAuthEntrySigned,
  gatherAuthEntrySignatureStatus,
  numberToDecimalString,
  DEFAULT_ESTIMATED_LEDGER_SECONDS,
  isStellarNetwork,
  validateStellarDestinationAddress,
  validateStellarAssetAddress,
  getNetworkPassphrase,
  getRpcUrl,
  getRpcClient,
  getHorizonClient,
  getEstimatedLedgerCloseTimeSeconds,
  getUsdcAddress,
  convertToTokenAmount
};
//# sourceMappingURL=chunk-GJAM6N6R.mjs.map