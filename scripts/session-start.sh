#!/usr/bin/env bash
# Get a cloud session ready: RPC relays, CLI networks, npm deps. Safe to re-run.
# Usage: scripts/session-start.sh [--mainnet]   (--mainnet also starts the read-only mainnet relay)
set -u
cd "$(dirname "$0")/.."
S=~/.stellar-main/bin/stellar
LOGS=/tmp/try-cli-relays
mkdir -p "$LOGS"

if [ ! -x "$S" ]; then
  echo "✗ Stellar CLI missing at $S. Run scripts/setup.sh (5-15 min) or add it as the environment's setup script."
  exit 1
fi
echo "✓ $($S --version | head -1)"

relay() { # name port passphrase [rpc-url]
  local name=$1 port=$2 pass=$3 url=${4:-}
  if ! curl -s -m 5 -o /dev/null -X POST "http://127.0.0.1:$port/" -H 'Content-Type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'; then
    nohup python3 scripts/rpc-relay.py "$port" $url >"$LOGS/$name.log" 2>&1 &
    for _ in 1 2 3 4 5; do sleep 1; curl -s -m 2 -o /dev/null "http://127.0.0.1:$port/" && break; done
  fi
  $S network add "$name" --rpc-url "http://127.0.0.1:$port/" --network-passphrase "$pass"
  if $S network health --network "$name" >/dev/null 2>&1; then
    echo "✓ $name healthy (relay on :$port, log $LOGS/$name.log)"
  else
    echo "✗ $name not healthy; see $LOGS/$name.log"
  fi
}

relay testnet-relay 8001 "Test SDF Network ; September 2015"
if [ "${1:-}" = "--mainnet" ]; then
  relay mainnet-relay 8002 "Public Global Stellar Network ; September 2015" https://mainnet.sorobanrpc.com/
fi

for dir in privy-wallet example-x402-seller; do
  if [ ! -d "$dir/node_modules" ]; then
    (cd "$dir" && npm install --no-audit --no-fund >/dev/null 2>&1) && echo "✓ npm install in $dir" || echo "✗ npm install failed in $dir"
  fi
done

if [ -n "${PRIVY_APP_SECRET:-}" ]; then echo "✓ PRIVY_APP_SECRET is set (opt-in only, see CLAUDE.md)"; else echo "- PRIVY_APP_SECRET not set"; fi
if [ -f privy-wallet/wallet.json ]; then echo "✓ Privy wallet: $(cd privy-wallet && node privy.mjs address)"; else echo "- no Privy wallet yet (privy-wallet/README.md, Next steps)"; fi
echo "- CLI identities: $($S keys ls 2>/dev/null | tr '\n' ' ')"
echo "- branch: $(git rev-parse --abbrev-ref HEAD)"
