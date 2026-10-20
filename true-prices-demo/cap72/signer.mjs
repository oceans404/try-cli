// Signs Soroban auth entries for agent_policy with the agent's ed25519 key.
//
// The policy's `__check_auth` takes an `AgentSignature { public_key, signature }`
// struct, not the account-style signature vector, so the signer hands
// authorizeEntry a ready-made `signatureScVal`. The stock @x402/stellar client
// can't produce that through `signAuthEntry` (it only returns raw bytes), so the
// sdk 17 port in ../vendor/x402-stellar takes an optional `authorizeEntry` on
// the signer instead. This file provides one.
import { authorizeEntry, nativeToScVal, Address, xdr } from "@stellar/stellar-sdk";
import { PASSPHRASE, env } from "./config.mjs";

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
 * Turn an entry's plain address credentials into CAP-71-01 delegated
 * credentials: the same address, nonce and expiration, a void signature of its
 * own, and one unsigned delegate entry for `delegate`.
 */
function withDelegate(entry, delegate) {
  const creds = addressCredentials(entry);
  if (entry.credentials.type === "sorobanCredentialsAddressWithDelegates") return entry;
  const addressCreds = new xdr.SorobanAddressCredentials({
    address: creds.address,
    nonce: creds.nonce,
    signatureExpirationLedger: creds.signatureExpirationLedger,
    signature: xdr.ScVal.scvVoid(),
  });
  const delegates = [
    new xdr.SorobanDelegateSignature({
      address: new Address(delegate).toScAddress(),
      signature: xdr.ScVal.scvVoid(),
      nestedDelegates: [],
    }),
  ];
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddressWithDelegates(
      new xdr.SorobanAddressCredentialsWithDelegates({ addressCredentials: addressCreds, delegates }),
    ),
    rootInvocation: entry.rootInvocation,
  });
}

/**
 * A ClientStellarSigner for the agent's wallet. `walletAddress` is the address
 * that pays. Two modes:
 *
 * - Version B: the wallet is agent_policy itself, so the agent's signature goes
 *   on the wallet's own credentials.
 * - Version B+ (`delegate` set): the wallet is agent_wallet, which delegates to
 *   agent_policy through CAP-71-01. The entry becomes delegated credentials with
 *   a void top-level signature, and the agent's signature goes on the delegate.
 *   That's exactly the entry a CAP-72 G-account payment would carry.
 *
 * `authorizeEntry` signs one entry; `owns` says whether an entry is the
 * wallet's to sign.
 */
export function createPolicySigner(agentKeypair, walletAddress, networkPassphrase, { delegate } = {}) {
  const sign = async (_preimage, payload) => ({ signatureScVal: agentSignatureScVal(agentKeypair, payload) });
  const authorize = (entry, validUntilLedger, passphrase = networkPassphrase) =>
    delegate
      ? authorizeEntry(withDelegate(entry, delegate), sign, validUntilLedger, passphrase, delegate)
      : authorizeEntry(entry, sign, validUntilLedger, passphrase);
  return {
    address: walletAddress,
    delegate,
    agentPublicKey: agentKeypair.publicKey(),
    authorizeEntry: authorize,
    // Required by the ClientStellarSigner shape; never used once authorizeEntry is set.
    async signAuthEntry() {
      throw new Error("agent wallet entries are signed with authorizeEntry");
    },
    owns(entry) {
      const creds = addressCredentials(entry);
      return creds !== null && Address.fromScAddress(creds.address).toString() === walletAddress;
    },
  };
}

/** The signer for this setup's wallet (B or B+, from .env). */
export const walletSigner = (agentKeypair = env.agent) =>
  createPolicySigner(agentKeypair, env.wallet, PASSPHRASE, env.plus ? { delegate: env.policy } : {});
