# Notes for Claude

A sandbox for the [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli):
wallets, x402 payments (buying and selling), and DeFi, on testnet and, with
care, mainnet.

## Start here (every cloud session)

Run `/session-setup` (the command is in `.claude/commands/`), or do it by hand:

```bash
scripts/session-start.sh [--mainnet]   # relays, networks, npm deps; builds the CLI in the background if missing
stellar skill                          # read it before the first stellar command
```

The CLI is built from `main` into `~/.stellar-main/bin/stellar` (by
`scripts/setup.sh`), and `session-start.sh` links it onto PATH as `stellar`.
A fresh container has no CLI: the first run starts a 5 to 15 minute background
build (log `/tmp/try-cli-relays/cli-build.log`). Keep working and talking
meanwhile, then re-run the script to add the networks.

Why the relays: the CLI's RPC client ignores `HTTPS_PROXY`, so `--network testnet`
gets `403`. Use `--network testnet-relay` (and `mainnet-relay`, from
`--mainnet`). The relay forwards through the proxy and also serves friendbot
(`keys generate --fund` works). The relay networks are the real networks: same
addresses, hashes, and stellar.expert links. Identities and networks live in
`~/.config/stellar` and are lost with the container.

## Rules

- Pass `--network` and the source (`--source`, or `--from` for `token
  transfer`/`approve`) on every command. Don't set defaults with `network use` /
  `keys use`, even though `stellar skill` suggests it.
- Mainnet is read-only (`--send=no`, `network health`) unless the user says
  otherwise. Never hold a mainnet key in the container: mainnet signing and
  mainnet x402 buying go through the Privy wallet only.
- Privy wallet (`privy-wallet/`): use `PRIVY_APP_SECRET` only when the user
  asks for it in the current conversation, for that task only. Never print, log
  or commit it; check for it with `[ -n "$PRIVY_APP_SECRET" ]`. Show any
  mainnet transaction (operation, amount, destination) and wait for an OK before
  signing. App ID: `cmrpejbk700es0ckwpdu1hxcj`.
- On mainnet, don't trust contract IDs from this repo's docs. They're dated
  snapshots. Look the contract up (Raven MCP, the stellar.rgstry.xyz registry,
  the protocol's own docs or API), check it on-chain (`contract invoke --send=no`,
  e.g. a router's `get_factory` or a Blend pool's `get_config`), and simulate
  before signing.
- Report every transaction with its stellar.expert link:
  `https://stellar.expert/explorer/testnet/tx/<HASH>` (mainnet: `/public/`).

## What's here

| To | Read | Notes |
| --- | --- | --- |
| Hold and use a testnet wallet | `stellar skill`, then Networks and assets below | `keys generate --fund`, trustline, buy USDC on the DEX |
| Use the Privy wallet (mainnet-safe) | `privy-wallet/README.md` | The CLI builds (`--build-only`), `privy.mjs sign` signs. It exists already (`wallet.json`); never `create` again |
| Pay an x402 API | `example-x402-seller/README.md` (Try it) | Testnet: `buy.mjs`. Mainnet: `privy.mjs buy` only. Sellers to try: Rail402 below |
| Sell with x402 | `example-x402-seller/README.md` | Run it locally; hosting on Render needs the user. `payTo`: the Privy wallet |
| DeFi on testnet | `docs/testnet-defi-cli.md` | Tested recipes: Soroswap, Blend, DeFindex, classic DEX/AMM, CETES |
| DeFi on mainnet | `docs/stellar-defi-directory.md` (Checking it yourself), then the mainnet rule above | `docs/mainnet-defi-cli.md` is only a record of one experimental session, not a guide |
| See what was done before | `privy-wallet/LOG.md` | Every Privy transaction so far, with links |

Scripts: `scripts/session-start.sh` (per session), `scripts/setup.sh` (builds
the CLI), `scripts/rpc-relay.py [port] [rpc-url]` (testnet by default).

## Networks and assets

| USDC | Testnet | Mainnet |
| --- | --- | --- |
| Issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

Getting testnet USDC: `tx new change-trust --line USDC:<issuer>`, then buy it
on the DEX with `tx new path-payment-strict-receive --send-asset native
--send-max <stroops> --dest-asset USDC:<issuer> --dest-amount <stroops>
--destination <self>` (about 1 XLM per USDC). `token balance` prints stroops
(7 decimals): 1011561 is 0.1011561.

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
  data, the first place to look up mainnet protocols and contracts. Only
  available if the user added it as a connector before the session started (it
  needs browser OAuth). Otherwise fall back to `curl` and the registry.
- **Rail402 Explorer** (testnet x402 marketplace):
  `curl -sS "https://explorer-explorer.up.railway.app/sellers?limit=50&registered=true"`.
  An unpaid `resource` returns 402, and its `payment-required` header is
  base64 JSON with the terms. Pay with an x402 client (`@x402/stellar` +
  `@x402/fetch`, as in `example-x402-seller/buy.mjs`). The CLI can't pay.
  Run Node clients with `NODE_USE_ENV_PROXY=1` in cloud sessions.
