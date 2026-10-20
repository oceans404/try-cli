import { Transaction, Address, Operation, xdr } from "@stellar/stellar-sdk";
import { Api, assembleTransaction } from "@stellar/stellar-sdk/rpc";

/**
 * Handles the simulation result of a Stellar transaction.
 *
 * @param simulation - The simulation result to handle
 * @throws An error if the simulation result is of type "RESTORE" or "ERROR"
 */
export function handleSimulationResult(simulation?: Api.SimulateTransactionResponse) {
  if (!simulation) {
    throw new Error("Simulation result is undefined");
  }

  if (Api.isSimulationRestore(simulation)) {
    throw new Error(
      `Stellar simulation result has type "RESTORE" with restorePreamble: ${simulation.restorePreamble}`,
    );
  }

  if (Api.isSimulationError(simulation)) {
    const msg = `Stellar simulation failed${simulation.error ? ` with error message: ${simulation.error}` : ""}`;

    throw new Error(msg);
  }
}

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
export function getAddressCredentials(
  credentials: xdr.SorobanCredentials,
): xdr.SorobanAddressCredentials | undefined {
  switch (credentials.type) {
    case "sorobanCredentialsAddress":
      return credentials.address;
    case "sorobanCredentialsAddressV2":
      return credentials.addressV2;
    case "sorobanCredentialsAddressWithDelegates":
      return credentials.addressWithDelegates.addressCredentials;
    default:
      return undefined;
  }
}

/**
 * Returns the delegate signatures attached to a CAP-71-01
 * `sorobanCredentialsAddressWithDelegates` credential union, or an empty array
 * for every other arm.
 *
 * @param credentials - The credential union from an auth entry
 * @returns The top-level delegate signatures (each may carry nested delegates)
 */
export function getDelegateSignatures(
  credentials: xdr.SorobanCredentials,
): xdr.SorobanDelegateSignature[] {
  if (credentials.type === "sorobanCredentialsAddressWithDelegates") {
    return credentials.addressWithDelegates.delegates;
  }
  return [];
}

/**
 * Whether a credential signature value carries a signature.
 * An `scvVoid` signature means the node has not signed.
 *
 * @param signature - The signature ScVal from address credentials or a delegate
 * @returns `true` if the signature is anything other than `scvVoid`
 */
export function isSignaturePresent(signature: xdr.ScVal): boolean {
  return signature.type !== "scvVoid";
}

/**
 * Whether every delegate in the tree (recursively, including nested delegates)
 * carries a signature. An empty list is vacuously fully signed; callers that
 * need "at least one delegate" must check the length themselves.
 *
 * @param delegates - The delegate signatures to inspect
 * @returns `true` if every delegate and nested delegate has a non-void signature
 */
export function areAllDelegatesSigned(delegates: xdr.SorobanDelegateSignature[]): boolean {
  return delegates.every(
    delegate =>
      isSignaturePresent(delegate.signature) && areAllDelegatesSigned(delegate.nestedDelegates),
  );
}

/**
 * Collects every delegate address in the tree (recursively, including nested
 * delegates) as a strkey string.
 *
 * @param delegates - The delegate signatures to walk
 * @returns The delegate addresses, depth-first, duplicates preserved
 */
export function collectDelegateAddresses(delegates: xdr.SorobanDelegateSignature[]): string[] {
  return delegates.flatMap(delegate => [
    Address.fromScAddress(delegate.address).toString(),
    ...collectDelegateAddresses(delegate.nestedDelegates),
  ]);
}

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
export function isAuthEntrySigned(credentials: xdr.SorobanCredentials): boolean {
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

/**
 * Analysis result of transaction signers
 */
export type ContractSigners = {
  /** Accounts that have already signed auth entries */
  alreadySigned: string[];
  /** Accounts that still need to sign auth entries */
  pendingSignature: string[];
};

/**
 * Input parameters for gathering auth entry signature status
 */
export type GatherAuthEntrySignatureStatusInput = {
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
export function gatherAuthEntrySignatureStatus({
  transaction,
  simulationResponse,
  simulate,
}: GatherAuthEntrySignatureStatusInput): ContractSigners {
  // Determine if we should assemble with simulation
  const shouldAssemble = simulate ?? simulationResponse !== undefined;
  let assembledTx = transaction;

  // Assemble transaction with simulation if requested
  if (shouldAssemble && simulationResponse) {
    const assembledTxBuilder = assembleTransaction(transaction, simulationResponse);
    assembledTx = assembledTxBuilder.build();
  }

  // Validate transaction structure
  if (assembledTx.operations.length !== 1) {
    throw new Error(
      `Expected transaction with exactly one operation, got ${assembledTx.operations.length}`,
    );
  }

  const operation = assembledTx.operations[0];
  if (operation.type !== "invokeHostFunction") {
    throw new Error(`Expected InvokeHostFunction operation, got ${operation.type}`);
  }

  const invokeOp = operation as Operation.InvokeHostFunction;

  const alreadySigned: string[] = [];
  const pendingSignature: string[] = [];

  for (const entry of invokeOp.auth ?? []) {
    // Handle address-based credentials: legacy V1, CAP-71 V2 (accepted by the
    // network from Protocol 28 onward) and CAP-71-01 address-with-delegates,
    // where the payer is the top-level address. Source-account credentials are
    // skipped - these use the transaction source.
    const addressCredentials = getAddressCredentials(entry.credentials);
    if (addressCredentials) {
      const address = Address.fromScAddress(addressCredentials.address).toString();

      // Signed when the top-level signature is not scvVoid, or (delegates arm)
      // when every delegate has signed on the account's behalf.
      if (isAuthEntrySigned(entry.credentials)) {
        alreadySigned.push(address);
      } else {
        pendingSignature.push(address);
      }
    }
  }

  return {
    alreadySigned: [...new Set(alreadySigned)], // Remove duplicates
    pendingSignature: [...new Set(pendingSignature)],
  };
}
