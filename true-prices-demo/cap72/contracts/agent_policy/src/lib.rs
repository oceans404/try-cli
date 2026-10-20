//! agent_policy: a spending policy for an AI agent's wallet.
//!
//! The agent holds an ed25519 key that is not a signer anywhere. The only thing
//! that key can do is satisfy this contract's `__check_auth`, which then allows a
//! payment only if it is a `transfer` of the configured token from the wallet to
//! an allowlisted seller, within the per-payment and daily caps.
//!
//! Version B (testnet): this contract is the wallet itself (a C-address that
//! holds the USDC), so `wallet` is the contract's own address.
//! Version A (CAP-72): the wallet is a G-account and this contract is its
//! delegated signer. CAP-71-01 hands a delegate the same payload and contexts
//! as the account, so the code below doesn't change.
//!
//! It emits no events on purpose: x402 facilitators reject any simulated
//! contract event that isn't the token's own `transfer`.
#![no_std]

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    symbol_short, Address, BytesN, Env, TryFromVal, Vec,
};

const DAY_SECONDS: u64 = 86_400;
const LEDGERS_PER_DAY: u32 = 17_280;
// Keep the rules alive for about a month.
const TTL_THRESHOLD: u32 = LEDGERS_PER_DAY * 7;
const TTL_EXTEND_TO: u32 = LEDGERS_PER_DAY * 30;
// A day bucket only matters until its day ends, so it lives in temporary
// storage. Every write extends it to two days, which outlives its day. New
// persistent entries pay rent for the network's long minimum TTL, which made the
// first payment of each day cost about 35x the others on testnet.
const BUCKET_TTL: u32 = LEDGERS_PER_DAY * 2;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PolicyError {
    PaymentTooLarge = 1,
    SellerNotAllowed = 2,
    DailyCapExceeded = 3,
    BadSignature = 4,
    /// Anything other than `transfer(wallet, to, amount)` on the token.
    CallNotAllowed = 5,
    InvalidRules = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Rules {
    pub agent_pubkey: BytesN<32>,
    pub token: Address,
    pub max_per_payment: i128,
    pub daily_cap: i128,
    pub allowed_sellers: Vec<Address>,
}

/// What the agent passes as the auth entry's signature. Carrying the public
/// key lets a rotated-out key fail with `BadSignature` instead of a host trap.
#[contracttype]
#[derive(Clone, Debug)]
pub struct AgentSignature {
    pub public_key: BytesN<32>,
    pub signature: BytesN<64>,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    Wallet,
    Rules,
    /// Amount spent on a given UTC day (ledger timestamp / 86400). Temporary storage.
    Spent(u64),
}

#[contract]
pub struct AgentPolicy;

fn check_rules(rules: &Rules) -> Result<(), PolicyError> {
    if rules.max_per_payment <= 0 || rules.daily_cap <= 0 {
        return Err(PolicyError::InvalidRules);
    }
    Ok(())
}

fn rules(env: &Env) -> Rules {
    env.storage().instance().get(&DataKey::Rules).unwrap()
}

fn wallet(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Wallet)
        .unwrap_or_else(|| env.current_contract_address())
}

fn owner(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Owner).unwrap()
}

fn today(env: &Env) -> u64 {
    env.ledger().timestamp() / DAY_SECONDS
}

fn spent_on(env: &Env, day: u64) -> i128 {
    env.storage()
        .temporary()
        .get(&DataKey::Spent(day))
        .unwrap_or(0)
}

#[contractimpl]
impl AgentPolicy {
    /// `wallet` is the account this policy speaks for. Pass `None` when the
    /// contract is the wallet itself (version B).
    pub fn __constructor(env: Env, owner: Address, wallet: Option<Address>, rules: Rules) {
        check_rules(&rules).unwrap();
        let s = env.storage().instance();
        s.set(&DataKey::Owner, &owner);
        if let Some(w) = wallet {
            s.set(&DataKey::Wallet, &w);
        }
        s.set(&DataKey::Rules, &rules);
        s.extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
    }

    /// Owner only: replace the rules (caps, allowlist, agent key).
    pub fn update_rules(env: Env, rules: Rules) -> Result<(), PolicyError> {
        owner(&env).require_auth();
        check_rules(&rules)?;
        env.storage().instance().set(&DataKey::Rules, &rules);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }

    /// Owner only, version B: move tokens out of the wallet. The contract is
    /// the direct invoker of `transfer`, so this doesn't go through `__check_auth`.
    pub fn withdraw(env: Env, token: Address, to: Address, amount: i128) {
        owner(&env).require_auth();
        soroban_sdk::token::TokenClient::new(&env, &token).transfer(
            &env.current_contract_address(),
            &to,
            &amount,
        );
    }

    pub fn rules(env: Env) -> Rules {
        rules(&env)
    }

    pub fn owner(env: Env) -> Address {
        owner(&env)
    }

    pub fn wallet(env: Env) -> Address {
        wallet(&env)
    }

    pub fn spent_today(env: Env) -> i128 {
        spent_on(&env, today(&env))
    }
}

#[contractimpl]
impl CustomAccountInterface for AgentPolicy {
    type Signature = AgentSignature;
    type Error = PolicyError;

    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signature: AgentSignature,
        auth_contexts: Vec<Context>,
    ) -> Result<(), PolicyError> {
        let rules = rules(&env);

        if signature.public_key != rules.agent_pubkey {
            return Err(PolicyError::BadSignature);
        }
        // Traps (rather than returning BadSignature) if the signature is wrong.
        env.crypto().ed25519_verify(
            &rules.agent_pubkey,
            &signature_payload.into(),
            &signature.signature,
        );

        let wallet = wallet(&env);
        let mut total: i128 = 0;
        for context in auth_contexts.iter() {
            let Context::Contract(c) = context else {
                return Err(PolicyError::CallNotAllowed);
            };
            if c.contract != rules.token || c.fn_name != symbol_short!("transfer") || c.args.len() != 3 {
                return Err(PolicyError::CallNotAllowed);
            }
            let from = Address::try_from_val(&env, &c.args.get_unchecked(0))
                .map_err(|_| PolicyError::CallNotAllowed)?;
            let to = Address::try_from_val(&env, &c.args.get_unchecked(1))
                .map_err(|_| PolicyError::CallNotAllowed)?;
            let amount = i128::try_from_val(&env, &c.args.get_unchecked(2))
                .map_err(|_| PolicyError::CallNotAllowed)?;
            if from != wallet || amount < 0 {
                return Err(PolicyError::CallNotAllowed);
            }
            if !rules.allowed_sellers.contains(&to) {
                return Err(PolicyError::SellerNotAllowed);
            }
            if amount > rules.max_per_payment {
                return Err(PolicyError::PaymentTooLarge);
            }
            total += amount;
        }

        let day = today(&env);
        let spent = spent_on(&env, day) + total;
        if spent > rules.daily_cap {
            return Err(PolicyError::DailyCapExceeded);
        }
        let key = DataKey::Spent(day);
        env.storage().temporary().set(&key, &spent);
        env.storage().temporary().extend_ttl(&key, BUCKET_TTL, BUCKET_TTL);
        env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
        Ok(())
    }
}

#[cfg(test)]
mod test;
