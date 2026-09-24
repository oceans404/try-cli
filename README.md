# try-cli

Trying out [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli)
from Claude Code cloud sessions: x402 payments on testnet, and a Privy-held
wallet for mainnet.

| Path | What |
| --- | --- |
| [`example-x402-seller/`](example-x402-seller) | A paid x402 API on testnet ([live](https://try-cli-jukj.onrender.com/fortune)) and a buyer script |
| [`privy-wallet/`](privy-wallet) | The secure/mainnet wallet. Its key is held by Privy; spending is capped by a USDC allowance |
| [`scripts/`](scripts) | `setup.sh` builds the CLI; `rpc-relay.py` lets it reach testnet/mainnet through the cloud proxy |
| [`CLAUDE.md`](CLAUDE.md) | Session setup and rules for agents |

## Cloud session setup

Paste `scripts/setup.sh` into the environment's **Setup script**. It builds
the Stellar CLI from GitHub `main` into `~/.stellar-main` (5 to 15 minutes
cold). Call it by its full path: `~/.stellar-main/bin/stellar`.

Environment variables: `PRIVY_APP_SECRET` for `privy-wallet/` (optional).

## Agent resources

- Raven MCP: `https://raven.stellar.org/mcp` (add as a connector, then authenticate)
- Stellar Skills: https://skills.stellar.org
- Docs index: https://developers.stellar.org/llms.txt
