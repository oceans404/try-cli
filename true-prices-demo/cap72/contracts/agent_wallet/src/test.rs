extern crate std;

use super::*;
use agent_policy::{AgentPolicy, AgentSignature, Rules};
use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::{
    auth::ContractContext,
    testutils::{Address as _, BytesN as _},
    token::{StellarAssetClient, TokenClient},
    vec,
    xdr::{
        HashIdPreimage, HashIdPreimageSorobanAuthorizationWithAddress, InvokeContractArgs, Limits,
        ScAddress, ScVal, SorobanAddressCredentials, SorobanAddressCredentialsWithDelegates,
        SorobanAuthorizationEntry, SorobanAuthorizedFunction, SorobanAuthorizedInvocation,
        SorobanCredentials, SorobanDelegateSignature, StringM, VecM, WriteXdr,
    },
    Bytes, BytesN, IntoVal, Symbol,
};

const USDC: i128 = 10_000_000;

struct Setup {
    env: Env,
    wallet: Address,
    policy: Address,
    token: Address,
    seller: Address,
    agent: SigningKey,
    nonce: i64,
}

fn setup() -> Setup {
    let env = Env::default();
    let agent = SigningKey::generate(&mut rand::thread_rng());
    let owner = Address::generate(&env);
    let seller = Address::generate(&env);
    let token = env.register_stellar_asset_contract_v2(Address::generate(&env)).address();

    let wallet = env.register(AgentWallet, (owner.clone(), 1u32));
    let rules = Rules {
        agent_pubkey: BytesN::from_array(&env, &agent.verifying_key().to_bytes()),
        token: token.clone(),
        max_per_payment: USDC,
        daily_cap: 2 * USDC,
        allowed_sellers: vec![&env, seller.clone()],
    };
    // The policy speaks for the wallet, as a delegated signer would for a G-account.
    let policy = env.register(AgentPolicy, (owner.clone(), Some(wallet.clone()), rules));

    env.mock_all_auths();
    StellarAssetClient::new(&env, &token).mint(&wallet, &(10 * USDC));
    AgentWalletClient::new(&env, &wallet).set_signer(&policy, &1);
    env.set_auths(&[]);
    Setup { env, wallet, policy, token, seller, agent, nonce: 0 }
}

impl Setup {
    fn sc(&self, a: &Address) -> ScAddress {
        a.clone().try_into().unwrap()
    }

    /// Authorize transfer(wallet, to, amount) the way an x402 payment does:
    /// address credentials for the wallet with a void signature and the given
    /// delegates, each signed by `key` over the address-bound payload.
    fn auth_transfer(&mut self, to: &Address, amount: i128, delegates: &[&Address], key: &SigningKey) {
        self.nonce += 1;
        let invocation = SorobanAuthorizedInvocation {
            function: SorobanAuthorizedFunction::ContractFn(InvokeContractArgs {
                contract_address: self.sc(&self.token),
                function_name: StringM::try_from("transfer").unwrap().into(),
                args: std::vec![
                    ScVal::Address(self.sc(&self.wallet)),
                    ScVal::Address(self.sc(to)),
                    amount.try_into().unwrap(),
                ]
                .try_into()
                .unwrap(),
            }),
            sub_invocations: VecM::default(),
        };
        let expiration = self.env.ledger().sequence() + 100;
        let preimage = HashIdPreimage::SorobanAuthorizationWithAddress(HashIdPreimageSorobanAuthorizationWithAddress {
            network_id: self.env.ledger().network_id().to_array().into(),
            nonce: self.nonce,
            signature_expiration_ledger: expiration,
            address: self.sc(&self.wallet),
            invocation: invocation.clone(),
        });
        let bytes = Bytes::from_slice(&self.env, &preimage.to_xdr(Limits::none()).unwrap());
        let payload = self.env.crypto().sha256(&bytes).to_array();
        let sig: soroban_sdk::Val = AgentSignature {
            public_key: BytesN::from_array(&self.env, &key.verifying_key().to_bytes()),
            signature: BytesN::from_array(&self.env, &key.sign(&payload).to_bytes()),
        }
        .into_val(&self.env);
        let sig = ScVal::try_from_val(&self.env, &sig).unwrap();
        let mut delegates: std::vec::Vec<SorobanDelegateSignature> = delegates
            .iter()
            .map(|d| SorobanDelegateSignature {
                address: self.sc(d),
                signature: sig.clone(),
                nested_delegates: VecM::default(),
            })
            .collect();
        delegates.sort_by(|a, b| a.address.cmp(&b.address));
        self.env.set_auths(&[SorobanAuthorizationEntry {
            credentials: SorobanCredentials::AddressWithDelegates(SorobanAddressCredentialsWithDelegates {
                address_credentials: SorobanAddressCredentials {
                    address: self.sc(&self.wallet),
                    nonce: self.nonce,
                    signature_expiration_ledger: expiration,
                    signature: ScVal::Void,
                },
                delegates: delegates.try_into().unwrap(),
            }),
            root_invocation: invocation,
        }]);
    }

    fn pay(&mut self, to: &Address, amount: i128) -> bool {
        let agent = self.agent.clone();
        let policy = self.policy.clone();
        self.auth_transfer(to, amount, &[&policy], &agent);
        TokenClient::new(&self.env, &self.token).try_transfer(&self.wallet, to, &amount).is_ok()
    }

    fn balance(&self, who: &Address) -> i128 {
        TokenClient::new(&self.env, &self.token).balance(who)
    }
}

#[test]
fn the_policy_approves_a_payment_through_delegation() {
    let mut s = setup();
    let seller = s.seller.clone();
    assert!(s.pay(&seller, USDC));
    assert_eq!(s.balance(&s.wallet), 9 * USDC);
    assert_eq!(s.balance(&seller), USDC);
}

#[test]
fn the_policy_still_refuses_what_breaks_its_rules() {
    let mut s = setup();
    let seller = s.seller.clone();
    let stranger = Address::generate(&s.env);
    assert!(!s.pay(&seller, 2 * USDC), "over the per-payment cap");
    assert!(!s.pay(&stranger, USDC), "seller not allowed");
    assert!(s.pay(&seller, USDC));
    assert!(s.pay(&seller, USDC));
    assert!(!s.pay(&seller, USDC), "over the daily cap");
    assert_eq!(s.balance(&s.wallet), 8 * USDC);
}

#[test]
fn a_payment_needs_a_delegate() {
    let mut s = setup();
    let (seller, agent) = (s.seller.clone(), s.agent.clone());
    s.auth_transfer(&seller, USDC, &[], &agent);
    let r = TokenClient::new(&s.env, &s.token).try_transfer(&s.wallet, &seller, &USDC);
    assert!(r.is_err());
}

#[test]
fn an_unknown_delegate_is_refused() {
    let mut s = setup();
    // A second policy with the same rules, never added to the wallet.
    let rules: Rules = AgentPolicyClient::new(&s.env, &s.policy).rules();
    let owner = Address::generate(&s.env);
    let rogue = s.env.register(AgentPolicy, (owner, Some(s.wallet.clone()), rules));
    let (seller, agent) = (s.seller.clone(), s.agent.clone());
    s.auth_transfer(&seller, USDC, &[&rogue], &agent);
    let r = TokenClient::new(&s.env, &s.token).try_transfer(&s.wallet, &seller, &USDC);
    assert!(r.is_err());
    assert_eq!(s.balance(&s.wallet), 10 * USDC);
}

#[test]
fn a_wrong_agent_key_is_refused() {
    let mut s = setup();
    let seller = s.seller.clone();
    let policy = s.policy.clone();
    let stranger = SigningKey::generate(&mut rand::thread_rng());
    s.auth_transfer(&seller, USDC, &[&policy], &stranger);
    let r = TokenClient::new(&s.env, &s.token).try_transfer(&s.wallet, &seller, &USDC);
    assert!(r.is_err());
}

#[test]
fn signers_must_be_contracts() {
    let s = setup();
    s.env.mock_all_auths();
    let g = Address::generate(&s.env);
    let client = AgentWalletClient::new(&s.env, &s.wallet);
    // Address::generate makes a contract address; build a G-address instead.
    let account = Address::try_from_val(
        &s.env,
        &ScVal::Address(ScAddress::Account(soroban_sdk::xdr::AccountId(
            soroban_sdk::xdr::PublicKey::PublicKeyTypeEd25519(soroban_sdk::xdr::Uint256([7; 32])),
        ))),
    )
    .unwrap();
    assert_eq!(client.try_set_signer(&account, &1), Err(Ok(WalletError::NotAContract)));
    let _ = g;
    let rules: Rules = AgentPolicyClient::new(&s.env, &s.policy).rules();
    let second = s.env.register(AgentPolicy, (Address::generate(&s.env), Some(s.wallet.clone()), rules));
    client.set_signer(&second, &2);
    assert_eq!(client.signers().get(second), Some(2));
}

#[test]
fn delegates_cant_authorize_calls_on_the_wallet() {
    let s = setup();
    let context = Context::Contract(ContractContext {
        contract: s.wallet.clone(),
        fn_name: Symbol::new(&s.env, "set_signer"),
        args: (s.policy.clone(), 5u32).into_val(&s.env),
    });
    let r = s.env.try_invoke_contract_check_auth::<WalletError>(
        &s.wallet,
        &BytesN::random(&s.env),
        ().into_val(&s.env),
        &vec![&s.env, context],
    );
    assert_eq!(r, Err(Ok(WalletError::DelegatesCantManageWallet)));
}

#[test]
fn only_the_owner_changes_signers() {
    let s = setup();
    let client = AgentWalletClient::new(&s.env, &s.wallet);
    let other = Address::generate(&s.env);
    assert!(client.try_set_signer(&other, &1).is_err());
}

use agent_policy::AgentPolicyClient;
use soroban_sdk::TryFromVal;
