# try-cli

Claude's experiment with agentic payments on Stellar. From Claude Code cloud
sessions, Claude drives the [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli):
it holds wallets, buys and sells over [x402](https://www.x402.org/), and uses
Stellar DeFi, mostly on testnet. Mainnet goes only through a Privy-held wallet,
and only with a person's OK.

> **Experimental and unaudited.** Claude wrote most of this code and these
> docs. Nothing here has had a security review or audit, and none of it is
> financial advice or production wallet or payments code. Use testnet, and
> put only amounts you can afford to lose anywhere near mainnet.

## What's in here

| Path | What you'll find |
| --- | --- |
| [`example-x402-seller/`](example-x402-seller) | A paid x402 API ([live on testnet](https://try-cli-jukj.onrender.com/fortune), 0.01 USDC per fortune, listed on Rail402), how to run and host your own, and `buy.mjs`, a buyer for any Stellar x402 URL |
| [`privy-wallet/`](privy-wallet) | A Stellar wallet whose key is held by [Privy](https://privy.io), not by the agent. The CLI builds transactions and `privy.mjs` shows and signs them; a USDC allowance caps spending. [`LOG.md`](privy-wallet/LOG.md) records every transaction it has made |
| [`docs/`](docs) | A directory of 10 Stellar DeFi services and how to check them yourself, and CLI recipes tested on testnet (Soroswap, Blend, DeFindex, classic DEX/AMM, CETES). Also an experimental record of one hour of mainnet DeFi by Claude, kept to show how it went, not as a guide |
| [`scripts/`](scripts) | `session-start.sh` readies a session, `setup.sh` builds the CLI, `rpc-relay.py` lets the CLI reach Stellar through the cloud proxy |
| [`HUMANS.md`](HUMANS.md) | Setting the repo up in Claude Code: prerequisites, environment settings, first session |
| [`CLAUDE.md`](CLAUDE.md) | Instructions and rules for agents working in this repo |
| [`.env.claudecode`](.env.claudecode) | What the cloud environment needs (variables, setup script, hosts) |

## Cloud session setup

See **[HUMANS.md](HUMANS.md)**. It covers the prerequisites (Privy App ID and
secret, the Raven connector), the cloud environment settings (environment
variables, network access, setup script), and how to start. In short:
- leave the environment's setup script empty;
- set `PRIVY_APP_SECRET` and `NODE_USE_ENV_PROXY=1`;
- allow the Stellar, Privy and x402 hosts;
- start each session with `/session-setup`.

## Agent resources

- Raven MCP: `https://raven.stellar.org/mcp` (add as a connector, then authenticate)
- Stellar Skills: https://skills.stellar.org
- Docs index: https://developers.stellar.org/llms.txt
