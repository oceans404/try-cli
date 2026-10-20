//! agent_wallet: a smart account that behaves like a CAP-72a G-account.
//!
//! Under CAP-72a a plain G-account lists contracts as delegated signers, and
//! the host asks those contracts (through CAP-71-01's delegation) to approve
//! the account's Soroban payments. That needs a protocol change. CAP-71-01
//! itself is live, though, so this contract plays the G-account's part on
//! testnet today:
//!
//! * It holds the funds and has no signature of its own.
//! * Its owner (a G-address, like the account's master key) adds and removes
//!   delegated signers with a weight, which is what `SetOptionsOp` does under
//!   CAP-72a.
//! * `__check_auth` takes the delegates attached to the auth entry
//!   (`SorobanCredentialsAddressWithDelegates`), checks each is one of its
//!   signers, sums their weights against the threshold, and forwards the
//!   authorization to each with `delegate_auth`, so the delegate's own
//!   `__check_auth` decides.
//! * The CAP-72a rules: delegates must be contracts, and they never authorize
//!   calls on the wallet itself (CAP-72a's "Medium only, never High").
//!
//! The only CAP-72 piece missing is the one the protocol adds: the account
//! being a G-address that exchanges can pay with a classic Payment.
#![no_std]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    Address, Env, Executable, Map, Vec,
};

const LEDGERS_PER_DAY: u32 = 17_280;
const TTL_THRESHOLD: u32 = LEDGERS_PER_DAY * 7;
const TTL_EXTEND_TO: u32 = LEDGERS_PER_DAY * 30;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum WalletError {
    /// The auth entry attached no delegated signers.
    NoDelegates = 101,
    /// A delegate isn't one of this wallet's signers.
    UnknownDelegate = 102,
    /// The delegates' weights don't reach the threshold.
    BelowThreshold = 103,
    /// Delegates can't authorize calls on the wallet itself.
    DelegatesCantManageWallet = 104,
    /// Signers must be contracts.
    NotAContract = 105,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    /// Map<Address, u32>: delegated signer to weight.
    Signers,
    Threshold,
}

#[contract]
pub struct AgentWallet;

fn owner(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Owner).unwrap()
}

fn signers(env: &Env) -> Map<Address, u32> {
    env.storage().instance().get(&DataKey::Signers).unwrap_or(Map::new(env))
}

fn bump(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Delegated signers must be deployed Wasm contracts (CAP-72a), never accounts.
fn is_contract(address: &Address) -> bool {
    matches!(address.executable(), Some(Executable::Wasm(_)))
}

#[contractimpl]
impl AgentWallet {
    /// `threshold` is the total delegate weight a payment needs (Medium).
    pub fn __constructor(env: Env, owner: Address, threshold: u32) {
        let s = env.storage().instance();
        s.set(&DataKey::Owner, &owner);
        s.set(&DataKey::Threshold, &threshold.max(1));
        bump(&env);
    }

    /// Owner only: add or reweigh a delegated signer. CAP-72a does this with
    /// `SetOptionsOp`. Weight 0 removes it.
    pub fn set_signer(env: Env, signer: Address, weight: u32) -> Result<(), WalletError> {
        owner(&env).require_auth();
        if !is_contract(&signer) {
            return Err(WalletError::NotAContract);
        }
        let mut all = signers(&env);
        if weight == 0 {
            all.remove(signer);
        } else {
            all.set(signer, weight);
        }
        env.storage().instance().set(&DataKey::Signers, &all);
        bump(&env);
        Ok(())
    }

    /// Owner only: move tokens out. The wallet invokes `transfer` itself, so
    /// this doesn't go through `__check_auth`.
    pub fn withdraw(env: Env, token: Address, to: Address, amount: i128) {
        owner(&env).require_auth();
        soroban_sdk::token::TokenClient::new(&env, &token).transfer(&env.current_contract_address(), &to, &amount);
    }

    pub fn owner(env: Env) -> Address {
        owner(&env)
    }

    pub fn signers(env: Env) -> Map<Address, u32> {
        signers(&env)
    }

    pub fn threshold(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Threshold).unwrap()
    }
}

#[contractimpl]
impl CustomAccountInterface for AgentWallet {
    /// The wallet checks no signature of its own; its delegates sign.
    type Signature = ();
    type Error = WalletError;

    fn __check_auth(
        env: Env,
        _signature_payload: Hash<32>,
        _signature: (),
        auth_contexts: Vec<Context>,
    ) -> Result<(), WalletError> {
        let me = env.current_contract_address();
        for context in auth_contexts.iter() {
            if let Context::Contract(c) = context {
                if c.contract == me {
                    return Err(WalletError::DelegatesCantManageWallet);
                }
            }
        }

        let delegates = env.custom_account().get_delegated_signers();
        if delegates.is_empty() {
            return Err(WalletError::NoDelegates);
        }
        let known = signers(&env);
        let mut weight: u32 = 0;
        for delegate in delegates.iter() {
            let w = known.get(delegate.clone()).ok_or(WalletError::UnknownDelegate)?;
            weight = weight.saturating_add(w);
        }
        let threshold: u32 = env.storage().instance().get(&DataKey::Threshold).unwrap();
        if weight < threshold {
            return Err(WalletError::BelowThreshold);
        }
        // Each delegate's own __check_auth now decides, with this payload and
        // these contexts. Any failure there fails the whole authorization.
        for delegate in delegates.iter() {
            env.custom_account().delegate_auth(&delegate);
        }
        bump(&env);
        Ok(())
    }
}

#[cfg(test)]
mod test;
