# Setting up try-cli in Claude Code (for humans)

How to get this repo running in a Claude Code cloud session: what to have
ready, what to put in the cloud environment, and how to start. Agents read
[`CLAUDE.md`](CLAUDE.md) instead.

> This is Claude's unaudited experiment. Stick to testnet, and put only
> amounts you can afford to lose anywhere near mainnet.

## 1. Prerequisites

| What | Needed for | Where |
| --- | --- | --- |
| Claude account with Claude Code on the web | Everything | [claude.ai/code](https://claude.ai/code) |
| GitHub connected, with access to this repo (or your fork) | Cloning and pushing | Claude Code prompts you; the Claude GitHub App must be installed on the repo |
| Privy app: **App ID** and **App Secret** | `privy-wallet/` (optional; testnet work doesn't need it) | [dashboard.privy.io](https://dashboard.privy.io) → create an app → App settings |
| Raven connector | Stellar docs and ecosystem data as MCP tools (optional) | claude.ai → Settings → Connectors → add `https://raven.stellar.org/mcp`, then sign in |
| OZ Channels API key | Only to run your own x402 seller (`example-x402-seller/`) | `https://channels.openzeppelin.com/testnet/gen` |

**Privy, if this isn't your repo:** `privy-wallet/wallet.json` points at the
owner's Privy wallet (App ID `cmrpejbk700es0ckwpdu1hxcj`). With your own Privy
app, delete `wallet.json`, set your App ID in `CLAUDE.md`, and ask Claude to
`create` a new wallet. That wallet has no owner, so whoever has the App Secret
controls it. Consider adding a Privy authorization key before it holds real
value.

## 2. Create the cloud environment

In Claude Code on the web, open the environment menu, choose **Add
environment** (or **Edit** an existing one), and fill it in.

**Name:** anything, e.g. `try-cli (Stellar)`.

**Environment variables:**

```
PRIVY_APP_SECRET=<your Privy App Secret>   # optional; only for privy-wallet/
NODE_USE_ENV_PROXY=1                       # lets Node scripts (x402, Privy) use the cloud proxy
```

Put the secret here, never in a file or in the chat. Changes only reach
**new** sessions.

**Setup script:** leave it **empty**. A setup script blocks the session while it
runs, and the Stellar CLI takes 5 to 15 minutes to build. `/session-setup`
builds it in the background instead.

**Network access:** choose a level that includes the usual package registries
(GitHub, crates.io, npm, Ubuntu mirrors), and allow these domains:

| Domains | Why |
| --- | --- |
| `soroban-testnet.stellar.org`, `friendbot.stellar.org`, `horizon-testnet.stellar.org` | Testnet RPC, funding, account data |
| `mainnet.sorobanrpc.com`, `horizon.stellar.org` | Mainnet RPC and account data |
| `api.privy.io`, `docs.privy.io` | Privy wallet signing, Privy docs |
| `developers.stellar.org`, `developers-pr-2869.previews.kube001.services.stellar-ops.com` | Stellar docs, and the agent CLI docs preview |
| `skills.stellar.org`, `raven.stellar.org` | Stellar Skills, Raven docs |
| `stellar.rgstry.xyz`, `testnet.rgstry.xyz` | Contract registry (DeFi contract IDs) |
| `explorer-explorer.up.railway.app`, `demo-seller-testnet.up.railway.app`, `playground-api-production-5062.up.railway.app`, `try-cli-jukj.onrender.com` | x402 marketplace (Rail402) and sellers |
| `channels.openzeppelin.com`, `facilitator.rail402.dev` | x402 facilitators |
| `github.com`, `raw.githubusercontent.com`, `crates.io`, `index.crates.io`, `static.crates.io`, `registry.npmjs.org` | Building the CLI, npm packages, reading contract source |

All of these were reachable from the original environment on 2026-09-24. If a
session reports a blocked host, add it here and start a new session. The
Raven connector itself goes through claude.ai, not this list.

## 3. Start a session

1. Start a new session on this repo with the environment from step 2.
2. Run **`/session-setup`**, optionally with a task:

   ```
   /session-setup
   /session-setup try testnet DeFi with a new wallet
   /session-setup use the Privy wallet on testnet, you have my OK
   ```

   It starts the RPC relays, installs packages, and starts the CLI build in
   the background if needed (5 to 15 minutes on a fresh container). Claude
   keeps talking meanwhile, then reports what's ready.

### What to tell Claude

Make your first message `/session-setup` followed by what you want. Name the
network, and say explicitly if Claude may use the Privy wallet. It won't
touch it otherwise.

| Goal | First message |
| --- | --- |
| Just get ready | `/session-setup` |
| Explore testnet | `/session-setup create and fund a testnet wallet with some USDC, then show me what we can buy on Rail402` |
| Testnet DeFi | `/session-setup rerun the recipes in docs/testnet-defi-cli.md with a new testnet wallet and tell me what still works` |
| Sell over x402 | `/session-setup run example-x402-seller locally on testnet and buy from it with buy.mjs` |
| Privy wallet, testnet | `/session-setup use the Privy wallet on testnet, you have my OK. Check its balances and pay for one fortune with privy.mjs buy` |
| Privy wallet, mainnet | `/session-setup you may use the Privy wallet on mainnet for this task. Budget: at most 1 USDC. Show me each transaction before signing` |
| Continue earlier work | `/session-setup read privy-wallet/LOG.md and the Next steps in privy-wallet/README.md, then tell me what's left` |

For mainnet, spell out what Claude may spend, in total and per transaction,
and on what. Approval lasts for that task only, so say it again in a new
session.

## What Claude will and won't do

- **Testnet:** it creates and funds its own wallets and transacts freely.
- **Mainnet:** it only reads, unless you say otherwise.
- **Privy wallet:** used only when you ask, for that task only. Before signing
  anything on mainnet, Claude shows what the transaction does and waits for
  your OK.
- **Secrets:** Claude never prints or commits `PRIVY_APP_SECRET`. But it lives
  in the environment, so this is a rule Claude follows, not something the
  system enforces. The USDC allowance (see `privy-wallet/README.md`) is what
  caps spending on-chain.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `PRIVY_APP_SECRET not set` | You added it after the session started. Start a new session. |
| A host is blocked or you get a `403` from the proxy | Add the host under Network access, then start a new session |
| The Stellar CLI is missing | It's building: `tail /tmp/try-cli-relays/cli-build.log`, then re-run `scripts/session-start.sh` |
| Raven tools missing | Add the connector at claude.ai before starting the session |
| Everything is gone (wallets, networks) | Expected. Containers are temporary; only what's committed survives. `/session-setup` rebuilds the rest |
