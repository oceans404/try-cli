// Signs Soroban auth entries for agent_policy with the agent's ed25519 key.
//
// The policy's `__check_auth` takes an `AgentSignature { public_key, signature }`
// struct, not the account-style signature vector, so the signer has to hand
// authorizeEntry a ready-made `signatureScVal`. authorizeEntry supports that, but
// AssembledTransaction.signAuthEntries' `signAuthEntry` callback only returns raw
// bytes, which is why @x402/stellar's stock client can't sign for a custom
// account. payment.mjs calls authorizeEntry directly instead.
import { authorizeEntry, nativeToScVal, Address } from "@stellar/stellar-sdk";

/** The AgentSignature ScVal for one auth payload (the 32-byte preimage hash). */
export function agentSignatureScVal(agentKeypair, payload) {
  return nativeToScVal(
    { public_key: agentKeypair.rawPublicKey(), signature: agentKeypair.sign(Buffer.from(payload)) },
    { type: { public_key: ["symbol", null], signature: ["symbol", null] } },
  );
}

/**
 * A ClientStellarSigner-shaped object for the policy wallet. `address` is the
 * C-address that pays (version B). `authorize` signs one entry.
 */
export function createPolicySigner(agentKeypair, policyAddress, networkPassphrase) {
  return {
    address: policyAddress,
    agentPublicKey: agentKeypair.publicKey(),
    async authorize(entry, validUntilLedger) {
      return authorizeEntry(
        entry,
        async (_preimage, payload) => ({ signatureScVal: agentSignatureScVal(agentKeypair, payload) }),
        validUntilLedger,
        networkPassphrase,
      );
    },
    /** True if this auth entry is the policy wallet's to sign. */
    owns(entry) {
      const creds = entry.credentials();
      if (creds.switch().name !== "sorobanCredentialsAddress") return false;
      return Address.fromScAddress(creds.address().address()).toString() === policyAddress;
    },
  };
}
