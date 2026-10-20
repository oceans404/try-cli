#!/usr/bin/env bash
# Version B / B+ setup on testnet: identities, USDC, the contracts, .env.
# Safe to re-run: existing identities are kept, and contracts are redeployed
# only with --redeploy (a fresh contract also resets the day's spending).
# Usage: ./setup-b.sh [--redeploy] [--plus]
#   --plus  version B+: deploy agent_wallet, a smart account that delegates its
#           authorization to agent_policy through CAP-71-01, the same way a
#           CAP-72 G-account would. Without it, agent_policy is the wallet.
#
# NETWORK is the Stellar CLI network name. In a Claude Code cloud session that's
# testnet-relay (see ../../CLAUDE.md); on your own machine use NETWORK=testnet.
set -euo pipefail
cd "$(dirname "$0")"
NETWORK=${NETWORK:-testnet-relay}
USDC_ISSUER=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
USDC="USDC:$USDC_ISSUER"
S="stellar"
REDEPLOY=0; PLUS=0
for arg in "$@"; do
  case "$arg" in
    --redeploy) REDEPLOY=1 ;;
    --plus) PLUS=1 ;;
    *) echo "unknown option $arg" >&2; exit 2 ;;
  esac
done
# Keep the mode of an existing setup unless told otherwise.
if [ "$REDEPLOY" = 0 ] && [ -f .env ] && grep -q '^WALLET_ID=' .env; then PLUS=1; fi
if [ "$PLUS" = 1 ] && [ -f .env ] && ! grep -q '^WALLET_ID=' .env; then REDEPLOY=1; fi
step() { printf '\n== %s\n' "$*"; }

[ -d node_modules ] || npm install --no-audit --no-fund >/dev/null
[ -d ../node_modules ] || (cd .. && npm install --no-audit --no-fund >/dev/null)

step "Identities (cap72-*)"
# The agent's key is never funded and never added as a signer anywhere.
for id in owner funder seller seller2 facilitator; do
  $S keys address "cap72-$id" >/dev/null 2>&1 || $S keys generate "cap72-$id" --network "$NETWORK" --fund >/dev/null
  echo "cap72-$id  $($S keys address "cap72-$id")"
done
$S keys address cap72-agent >/dev/null 2>&1 || $S keys generate cap72-agent >/dev/null
echo "cap72-agent  $($S keys address cap72-agent)  (no account, not a signer)"

addr() { $S keys address "cap72-$1"; }

USDC_SAC=$($S contract id asset --asset "$USDC" --network "$NETWORK")
echo "USDC SAC $USDC_SAC"

step "USDC trustlines (funder, both sellers)"
for id in funder seller seller2; do
  if $S token balance --network "$NETWORK" --id "$USDC_SAC" --account "$(addr $id)" >/dev/null 2>&1; then
    echo "cap72-$id already trusts USDC"
  else
    $S tx new change-trust --source "cap72-$id" --network "$NETWORK" --line "$USDC" >/dev/null && echo "cap72-$id trusts USDC"
  fi
done

step "Funder buys USDC on the DEX"
bal=$($S token balance --network "$NETWORK" --id "$USDC_SAC" --account "$(addr funder)" 2>/dev/null | tr -dc 0-9)
if [ "${bal:-0}" -lt 200000000 ]; then
  # 30 USDC for about 1 XLM each; send-max allows up to 3 XLM per USDC.
  $S tx new path-payment-strict-receive --source cap72-funder --network "$NETWORK" \
    --send-asset native --send-max 900000000 --dest-asset "$USDC" --dest-amount 300000000 \
    --destination "$(addr funder)" >/dev/null
fi
echo "funder holds $($S token balance --network "$NETWORK" --id "$USDC_SAC" --account "$(addr funder)") stroops of USDC"

step "Contracts"
if [ ! -f .env ] || ! grep -q '^POLICY_ID=' .env || [ "$REDEPLOY" = 1 ]; then
  (cd contracts/agent_policy && $S contract build --quiet 2>/dev/null || $S contract build)
  AGENT_HEX=$(node -e 'import("@stellar/stellar-sdk").then(({StrKey})=>console.log(Buffer.from(StrKey.decodeEd25519PublicKey(process.argv[1])).toString("hex")))' "$(addr agent)")
  RULES=$(printf '{"agent_pubkey":"%s","token":"%s","max_per_payment":"10000000","daily_cap":"20000000","allowed_sellers":["%s"]}' \
    "$AGENT_HEX" "$USDC_SAC" "$(addr seller)")
  WALLET_ID=
  WALLET_ARG=()
  if [ "$PLUS" = 1 ]; then
    (cd contracts/agent_wallet && $S contract build --quiet 2>/dev/null || $S contract build)
    WALLET_ID=$($S contract deploy --wasm contracts/agent_wallet/target/wasm32v1-none/release/agent_wallet.wasm \
      --source cap72-owner --network "$NETWORK" --alias cap72-wallet -- \
      --owner "$(addr owner)" --threshold 1 2>/dev/null | tail -1)
    echo "deployed agent_wallet $WALLET_ID"
    WALLET_ARG=(--wallet "\"$WALLET_ID\"")  # Option<Address> takes a JSON string
  fi
  POLICY_ID=$($S contract deploy --wasm contracts/agent_policy/target/wasm32v1-none/release/agent_policy.wasm \
    --source cap72-owner --network "$NETWORK" --alias cap72-policy -- \
    --owner "$(addr owner)" "${WALLET_ARG[@]}" --rules "$RULES" 2>/dev/null | tail -1)
  echo "deployed agent_policy $POLICY_ID"
  if [ "$PLUS" = 1 ]; then
    # What SetOptionsOp does under CAP-72a: add the policy as a delegated signer.
    $S contract invoke --id "$WALLET_ID" --source cap72-owner --network "$NETWORK" -- \
      set_signer --signer "$POLICY_ID" --weight 1 >/dev/null
    echo "agent_policy is now a delegated signer of agent_wallet (weight 1)"
  fi
else
  POLICY_ID=$(grep '^POLICY_ID=' .env | cut -d= -f2)
  WALLET_ID=$(grep '^WALLET_ID=' .env | cut -d= -f2 || true)
  echo "keeping $POLICY_ID ${WALLET_ID:+and $WALLET_ID }(pass --redeploy for fresh ones)"
fi

step "Writing .env (git-ignored)"
# Node scripts use the real RPC over HTTPS. In a cloud session the npm scripts
# set NODE_USE_ENV_PROXY=1 so Node goes through the proxy (only the CLI needs
# the localhost relay).
RPC_URL=https://soroban-testnet.stellar.org
umask 077
cat > .env <<EOF
# Written by setup-b.sh. Holds testnet secrets: never commit.
STELLAR_NETWORK=stellar:testnet
CLI_NETWORK=$NETWORK
RPC_URL=$RPC_URL
USDC_ISSUER=$USDC_ISSUER
USDC_SAC=$USDC_SAC
POLICY_ID=$POLICY_ID
${WALLET_ID:+WALLET_ID=$WALLET_ID
}OWNER_ADDRESS=$(addr owner)
SELLER_ADDRESS=$(addr seller)
OTHER_SELLER_ADDRESS=$(addr seller2)
AGENT_SECRET=$($S keys secret cap72-agent)
FUNDER_SECRET=$($S keys secret cap72-funder)
FACILITATOR_SECRET=$($S keys secret cap72-facilitator)
EOF
echo "wrote .env"

step "Rules read back from the contract"
$S contract invoke --id "$POLICY_ID" --source cap72-owner --network "$NETWORK" --send=no -- rules
echo "owner: $($S contract invoke --id "$POLICY_ID" --source cap72-owner --network "$NETWORK" --send=no -- owner)"
if [ -n "${WALLET_ID:-}" ]; then
  echo "agent_wallet signers: $($S contract invoke --id "$WALLET_ID" --source cap72-owner --network "$NETWORK" --send=no -- signers)"
fi
echo
echo "Ready. Run: npm run demo"
