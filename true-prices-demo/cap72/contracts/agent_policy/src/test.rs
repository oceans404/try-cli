extern crate std;

use super::*;
use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::{
    auth::ContractContext,
    testutils::{Address as _, BytesN as _, Ledger},
    vec, IntoVal, Symbol,
};

const USDC: i128 = 10_000_000;

struct Setup {
    env: Env,
    policy: Address,
    token: Address,
    seller: Address,
    agent: SigningKey,
}

fn setup() -> Setup {
    let env = Env::default();
    let agent = SigningKey::generate(&mut rand::thread_rng());
    let owner = Address::generate(&env);
    let seller = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();
    let rules = Rules {
        agent_pubkey: BytesN::from_array(&env, &agent.verifying_key().to_bytes()),
        token: token.clone(),
        max_per_payment: USDC,
        daily_cap: 2 * USDC,
        allowed_sellers: vec![&env, seller.clone()],
    };
    let policy = env.register(AgentPolicy, (owner, None::<Address>, rules));
    Setup { env, policy, token, seller, agent }
}

fn transfer(s: &Setup, from: &Address, to: &Address, amount: i128) -> Context {
    Context::Contract(ContractContext {
        contract: s.token.clone(),
        fn_name: Symbol::new(&s.env, "transfer"),
        args: (from.clone(), to.clone(), amount).into_val(&s.env),
    })
}

fn check(s: &Setup, key: &SigningKey, contexts: Vec<Context>) -> Result<(), PolicyError> {
    let payload = BytesN::<32>::random(&s.env);
    let sig = AgentSignature {
        public_key: BytesN::from_array(&s.env, &key.verifying_key().to_bytes()),
        signature: BytesN::from_array(&s.env, &key.sign(&payload.to_array()).to_bytes()),
    };
    s.env
        .try_invoke_contract_check_auth::<PolicyError>(&s.policy, &payload, sig.into_val(&s.env), &contexts)
        .map_err(|e| e.expect("expected a policy error, got a host error"))
}

#[test]
fn allows_a_payment_within_the_rules() {
    let s = setup();
    let ctx = vec![&s.env, transfer(&s, &s.policy, &s.seller, USDC)];
    assert_eq!(check(&s, &s.agent, ctx), Ok(()));
    let spent = s.env.as_contract(&s.policy, || AgentPolicy::spent_today(s.env.clone()));
    assert_eq!(spent, USDC);
}

#[test]
fn rejects_a_payment_over_the_cap() {
    let s = setup();
    let ctx = vec![&s.env, transfer(&s, &s.policy, &s.seller, 2 * USDC)];
    assert_eq!(check(&s, &s.agent, ctx), Err(PolicyError::PaymentTooLarge));
}

#[test]
fn rejects_an_unapproved_seller() {
    let s = setup();
    let other = Address::generate(&s.env);
    let ctx = vec![&s.env, transfer(&s, &s.policy, &other, USDC)];
    assert_eq!(check(&s, &s.agent, ctx), Err(PolicyError::SellerNotAllowed));
}

#[test]
fn enforces_the_daily_cap_and_resets_the_next_day() {
    let s = setup();
    let one = || vec![&s.env, transfer(&s, &s.policy, &s.seller, USDC)];
    assert_eq!(check(&s, &s.agent, one()), Ok(()));
    assert_eq!(check(&s, &s.agent, one()), Ok(()));
    assert_eq!(check(&s, &s.agent, one()), Err(PolicyError::DailyCapExceeded));
    s.env.ledger().with_mut(|l| l.timestamp += DAY_SECONDS);
    assert_eq!(check(&s, &s.agent, one()), Ok(()));
}

#[test]
fn rejects_a_key_that_is_not_the_agent() {
    let s = setup();
    let stranger = SigningKey::generate(&mut rand::thread_rng());
    let ctx = vec![&s.env, transfer(&s, &s.policy, &s.seller, USDC)];
    assert_eq!(check(&s, &stranger, ctx), Err(PolicyError::BadSignature));
}

#[test]
fn rejects_other_calls() {
    let s = setup();
    let ctx = vec![
        &s.env,
        Context::Contract(ContractContext {
            contract: s.token.clone(),
            fn_name: Symbol::new(&s.env, "approve"),
            args: (s.policy.clone(), s.seller.clone(), USDC, 100u32).into_val(&s.env),
        }),
    ];
    assert_eq!(check(&s, &s.agent, ctx), Err(PolicyError::CallNotAllowed));
}

#[test]
fn update_rules_needs_the_owner() {
    let s = setup();
    let client = AgentPolicyClient::new(&s.env, &s.policy);
    let mut rules = client.rules();
    rules.max_per_payment = 3 * USDC;
    assert!(client.try_update_rules(&rules).is_err());
    s.env.mock_all_auths();
    client.update_rules(&rules);
    let authorizer = s.env.auths()[0].0.clone();
    assert_eq!(authorizer, client.owner());
    assert_eq!(client.rules().max_per_payment, 3 * USDC);
}
