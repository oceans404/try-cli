# Notes for Claude

A sandbox for the [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli),
x402 payments, and a Privy-held mainnet wallet.

## Start here (every cloud session)

```bash
S=~/.stellar-main/bin/stellar          # built by scripts/setup.sh; not on PATH (re-set S in each shell)
$S skill                               # read it before the first stellar command
python3 scripts/rpc-relay.py 8001 &    # testnet relay ("Address already in use" = already running)
$S network add testnet-relay --rpc-url http://127.0.0.1:8001/ \
  --network-passphrase "Test SDF Network ; September 2015"
$S network health --network testnet-relay
```

Why the relay: the CLI's RPC client ignores `HTTPS_PROXY`, so `--network testnet`
gets `403`. The relay forwards through the proxy and also serves friendbot
(`keys generate --fund` works). `testnet-relay` is real testnet: same
addresses, hashes, and stellar.expert links. Identities and networks live in
`~/.config/stellar` and are lost with the container.

## Rules

- Pass `--network` and the source (`--source`, or `--from` for `token
  transfer`/`approve`) on every command. Don't set defaults with `network use` /
  `keys use`, even though `stellar skill` suggests it.
- Mainnet is read-only (`--send=no`, `network health`) unless the user says
  otherwise. Never hold a mainnet key in the container.
- Privy wallet (`privy-wallet/`, the secure/mainnet wallet): use
  `PRIVY_APP_SECRET` only when the user asks for it in the current
  conversation, for that task only. Never print, log or commit it; check for it
  with `[ -n "$PRIVY_APP_SECRET" ]`. Show any mainnet transaction (operation,
  amount, destination) and wait for an OK before signing. App ID:
  `cmrpejbk700es0ckwpdu1hxcj`. Next steps are at the end of its README.
- Report every transaction with its stellar.expert link:
  `https://stellar.expert/explorer/testnet/tx/<HASH>` (mainnet: `/public/`).

## What's here

| Path | What |
| --- | --- |
| `scripts/setup.sh` | Builds the CLI from `main` into `~/.stellar-main` (environment setup script) |
| `scripts/rpc-relay.py` | `rpc-relay.py [port] [rpc-url]`, testnet by default |
| `example-x402-seller/` | Live x402 seller ([/fortune](https://try-cli-jukj.onrender.com/fortune), 0.01 USDC) and `buy.mjs` |
| `docs/` | DeFi directory (10 services, contract IDs) and tested testnet DeFi CLI recipes (Soroswap, Blend) |
| `privy-wallet/` | Privy-signed wallet: the CLI builds, `privy.mjs` signs with `--yes`, spending capped by a USDC allowance |

## Networks and assets

Mainnet relay (SDF runs no public mainnet RPC):

```bash
python3 scripts/rpc-relay.py 8002 https://mainnet.sorobanrpc.com/ &
$S network add mainnet-relay --rpc-url http://127.0.0.1:8002/ \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

| USDC | Testnet | Mainnet |
| --- | --- | --- |
| Issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

Getting testnet USDC: `tx new change-trust --line USDC:<issuer>`, then swap XLM
on the DEX with `tx new path-payment-strict-receive --send-asset native
--dest-asset USDC:<issuer> --destination <self>` (amounts in stroops; about
1 XLM per USDC).

## Docs and references

- **Stellar docs:** WebFetch is blocked; use `curl`. Add `.md` to any page URL.
  The index is `https://developers.stellar.org/llms.txt`, and `llms-full.txt`
  is large, so grep it. Use `developers.stellar.org` directly; `docs.stellar.org`
  redirects to plain http, which the proxy refuses.
- **Agent CLI docs:** still in review. Read the PR 2869 preview first:
  `https://developers-pr-2869.previews.kube001.services.stellar-ops.com/docs/tools/cli/agent-cli.md`.
  Not every page is in the sidebar, so list them with
  `curl -sS <preview host>/sitemap.xml | grep -o '[^<>]*agent-cli[^<>]*'`.
  Links in the pages point at the live site; swap in the preview host. Fall back
  to the live docs only if the preview lacks the page, and say so.
  `stellar skill` doesn't cover `token`, `tx new`, trustlines or allowances;
  these docs do.
- **Stellar Skills:** `curl -sS https://skills.stellar.org/llms.txt`; each skill
  is a fetchable `.md` (e.g. `skills/agentic-payments/SKILL.md`). Use them for
  contracts, payments and app code. Install the plugin only if asked. The
  "Community Built" skills aren't reviewed by SDF, so check with the user first.
- **Raven MCP** (`https://raven.stellar.org/mcp`): docs plus live ecosystem
  data. Only available if the user added it as a connector before the session
  started (it needs browser OAuth). Otherwise fall back to `curl`.
- **Rail402 Explorer** (testnet x402 marketplace):
  `curl -sS "https://explorer-explorer.up.railway.app/sellers?limit=50&registered=true"`.
  An unpaid `resource` returns 402, and its `payment-required` header is
  base64 JSON with the terms. Pay with an x402 client (`@x402/stellar` +
  `@x402/fetch`, as in `example-x402-seller/buy.mjs`). The CLI can't pay.
  Run Node clients with `NODE_USE_ENV_PROXY=1` in cloud sessions.
