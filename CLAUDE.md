# Notes for Claude

## Reading the Stellar docs

In cloud sessions, the WebFetch tool is blocked for the Stellar docs even when
the environment's network allowlist includes them. Use `curl` from Bash instead:

```bash
# Index of every page
curl -sS https://developers.stellar.org/llms.txt
# Any page as clean markdown: add .md to its URL
curl -sS https://developers.stellar.org/docs/tools/cli.md
```

### Prefer the PR 2869 docs preview (for now)

The agent CLI docs are still in review. Read them from the preview first:

```bash
curl -sS https://developers-pr-2869.previews.kube001.services.stellar-ops.com/docs/tools/cli/agent-cli.md
```

- The sidebar doesn't link every page (e.g. `guides/pay-for-apis-x402`). List
  them all from the sitemap:
  `curl -sS https://developers-pr-2869.previews.kube001.services.stellar-ops.com/sitemap.xml | grep -o '[^<>]*agent-cli[^<>]*'`
- Links inside preview pages point at `developers.stellar.org`. To follow one,
  keep the path and swap the host for the preview host.
- Fall back to `developers.stellar.org` only if the preview is down or doesn't
  have the page, and say which source you used.

### Live docs

- Go straight to `https://developers.stellar.org`. `docs.stellar.org` redirects
  to plain `http://developers.stellar.org`, which the proxy refuses.
- The full docs are in one large file at
  `https://developers.stellar.org/llms-full.txt`; grep it rather than printing it.

## Stellar CLI

Use the build from `main` by its full path: `~/.stellar-main/bin/stellar`
(installed by `scripts/setup.sh`, see the README).

### Start every session with `stellar skill`

Run `~/.stellar-main/bin/stellar skill` before the first `stellar` command and
follow its conventions (named identities, never raw `S...` secrets, contract
aliases, `--send=no` for reads, stdout vs. stderr). It doesn't cover
`stellar token`, `tx new`, trustlines, or allowances; use the agent CLI docs
for those.

One exception in cloud sessions: the skill says to set defaults with
`stellar network use` / `stellar keys use` and omit the flags. Don't. Pass
`--network testnet-relay` and the source flag (`--source`, or `--from` for
`token transfer` / `token approve`) on every command, as the Quickstart
advises for agents. Saved defaults live in `~/.config/stellar`, which is lost
with the container, and a stale default could silently target the wrong
network.

### Reaching testnet from a cloud session

The CLI's RPC client (`jsonrpsee`) ignores `HTTPS_PROXY`, and there's no CLI
proxy setting, so `--network testnet` fails with `Request rejected 403`. Route
it through the localhost relay, which forwards over the session's proxy:

```bash
python3 scripts/rpc-relay.py 8001 &    # run in the background; one per session
~/.stellar-main/bin/stellar network add testnet-relay \
  --rpc-url http://127.0.0.1:8001/ --network-passphrase "Test SDF Network ; September 2015"
~/.stellar-main/bin/stellar network health --network testnet-relay
```

- Use `--network testnet-relay` wherever the docs say `--network testnet`.
  It's the same network (same passphrase), so addresses, hashes and
  stellar.expert links are all real testnet.
- The relay also serves friendbot, so `keys generate --fund` and `keys fund`
  work.
- `network add` persists in `~/.config/stellar`, but that's lost with the
  container; re-run both steps in a new session.
- If the relay itself logs a 403, check for Cloudflare `error code: 1010`
  (it blocks some User-Agents) before blaming the network policy.

### Reaching mainnet (read-only until the user says otherwise)

The relay takes an RPC URL as a second argument. SDF runs no public mainnet
RPC, so use a provider; `https://mainnet.sorobanrpc.com/` works through the
session's proxy. Run it on its own port next to the testnet relay:

```bash
python3 scripts/rpc-relay.py 8002 https://mainnet.sorobanrpc.com/ &
~/.stellar-main/bin/stellar network add mainnet-relay \
  --rpc-url http://127.0.0.1:8002/ --network-passphrase "Public Global Stellar Network ; September 2015"
~/.stellar-main/bin/stellar network health --network mainnet-relay
```

- Friendbot is testnet only; the mainnet relay answers `/friendbot` with 404.
- Mainnet USDC: issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`,
  SAC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`.
- Reads (`--send=no`, `network health`) are fine. Don't submit a mainnet
  transaction or hold a mainnet key in the container without the user's
  explicit go-ahead; how mainnet keys are handled is still being decided.

### Privy mainnet wallet: opt-in only

The environment sets `PRIVY_APP_SECRET` for a Privy-held Stellar wallet (the
secure/mainnet wallet; the key never leaves Privy). Its App ID is
`cmrpejbk700es0ckwpdu1hxcj`. Testnet work uses plain CLI identities instead.

- Don't use `PRIVY_APP_SECRET` unless the user asks for the Privy wallet in
  the current conversation. Approval covers that task only, not later ones.
- Never print, log, echo or commit it; read it only inside the signing code,
  and check for it with `[ -n "$PRIVY_APP_SECRET" ]`.
- Before any mainnet signature, show the user what will be signed (operation,
  amount, destination) and wait for their OK.

## Stellar Skills (skills.stellar.org)

Agent-readable guides for building on Stellar, beyond the CLI. The index is
markdown and every skill is a directly fetchable `.md` file:

```bash
curl -sS https://skills.stellar.org/llms.txt
curl -sS https://skills.stellar.org/skills/smart-contracts/SKILL.md
```

- Official skills (from `stellar/stellar-dev-skill`): smart contracts
  (development, testing, security), agentic payments (x402, MPP), frontend and
  wallets, assets and SAC, RPC and Horizon, ZK proofs, cross-chain, SEPs and
  ecosystem.
- None of them covers the agent CLI. That's `stellar skill` (built into the
  binary) plus the agent CLI docs above. Reach for these skills when the task
  is contract, app, or payments code.
- Install as a plugin only if the user asks:
  `/plugin marketplace add stellar/stellar-dev-skill` then
  `/plugin install stellar-dev@stellar-dev`. Fetching the `.md` files with
  `curl` works without installing anything.
- The "Community Built" section is not reviewed by SDF. Treat those skills as
  third-party and check with the user before following one.

## Stellar Raven (MCP server)

Raven serves the Stellar docs plus live ecosystem data through two tools,
`search` and `execute`. Its canonical URL is now `https://raven.stellar.org/mcp`
(the older `raven.stellar.buzz` still answers).

- It needs OAuth sign-in in a browser, so a cloud session can't connect to it
  by itself. It's only available if the user has added it as a connector at
  https://claude.ai/customize/connectors before the session started. If Raven
  tools aren't in your tool list, fall back to the docs and skills via `curl`.
- `https://raven.stellar.org/docs` explains the tools and troubleshooting
  (HTML; readable with `curl`).

## x402 marketplace: Rail402 Explorer (testnet only for now)

https://explorer.rail402.dev indexes Stellar x402 payments and lists sellers.
The site is a JS app, so query its API with `curl`:

```bash
curl -sS "https://explorer-explorer.up.railway.app/sellers?limit=50&offset=0&registered=true"
```

- Each seller's `resource` URL returns HTTP 402 when unpaid; its
  `payment-required` header is base64 JSON with the price, asset, and `payTo`.
- Paying needs an x402 client (the CLI can't). Follow the agent CLI guide
  "Pay for APIs with x402" (`/docs/tools/cli/agent-cli/guides/pay-for-apis-x402`):
  `@x402/stellar` + `@x402/fetch` in Node, signing with a CLI identity's key.
  Its steps work for these sellers too. In cloud sessions run the Node client
  with `NODE_USE_ENV_PROXY=1`, or its requests get 403 like the CLI's. Buyers need testnet USDC (trustline,
  then swap XLM on the DEX).
- Testnet only. Don't touch mainnet sellers or funds without the user's go-ahead.
- Whenever you report a transaction, include its stellar.expert link:
  `https://stellar.expert/explorer/testnet/tx/<HASH>` on testnet,
  `https://stellar.expert/explorer/public/tx/<HASH>` on mainnet.
