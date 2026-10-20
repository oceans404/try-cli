// Signs Soroban auth entries for agent_policy with the agent's ed25519 key.
//
// The policy's `__check_auth` takes an `AgentSignature { public_key, signature }`
// struct, not the account-style signature vector, so the signer hands
// authorizeEntry a ready-made `signatureScVal`. The stock @x402/stellar client
// can't produce that through `signAuthEntry` (it only returns raw bytes), so the
// sdk 17 port in ../vendor/x402-stellar takes an optional `authorizeEntry` on
// the signer instead. This file provides one.
import { authorizeEntry, nativeToScVal, Address } from "@stellar/stellar-sdk";

/** The AgentSignature ScVal for one auth payload (the 32-byte preimage hash). */
export function agentSignatureScVal(agentKeypair, payload) {
  return nativeToScVal(
    { public_key: agentKeypair.rawPublicKey(), signature: agentKeypair.sign(payload) },
    { type: { public_key: ["symbol", null], signature: ["symbol", null] } },
  );
}

/** The address credentials of an auth entry, for any address credential type. */
function addressCredentials(entry) {
  const c = entry.credentials;
  switch (c.type) {
    case "sorobanCredentialsAddress":
      return c.address;
    case "sorobanCredentialsAddressV2":
      return c.addressV2;
    case "sorobanCredentialsAddressWithDelegates":
      return c.addressWithDelegates.addressCredentials;
    default:
      return null;
  }
}

/**
 * A ClientStellarSigner for the policy wallet. `address` is the C-address that
 * pays (version B). `authorizeEntry` signs one entry; `owns` says whether an
 * entry is the wallet's to sign.
 */
export function createPolicySigner(agentKeypair, policyAddress, networkPassphrase) {
  const authorize = (entry, validUntilLedger, passphrase = networkPassphrase) =>
    authorizeEntry(
      entry,
      async (_preimage, payload) => ({ signatureScVal: agentSignatureScVal(agentKeypair, payload) }),
      validUntilLedger,
      passphrase,
    );
  return {
    address: policyAddress,
    agentPublicKey: agentKeypair.publicKey(),
    authorizeEntry: authorize,
    // Required by the ClientStellarSigner shape; never used once authorizeEntry is set.
    async signAuthEntry() {
      throw new Error("agent_policy entries are signed with authorizeEntry");
    },
    owns(entry) {
      const creds = addressCredentials(entry);
      return creds !== null && Address.fromScAddress(creds.address).toString() === policyAddress;
    },
  };
}
