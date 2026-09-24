# try-cli

Trying out [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli)
from Claude Code cloud sessions: x402 payments on testnet, and a Privy-held
wallet for mainnet.

| Path | What |
| --- | --- |
| [`example-x402-seller/`](example-x402-seller) | A paid x402 API on testnet ([live](https://try-cli-jukj.onrender.com/fortune)) and a buyer script |
| [`privy-wallet/`](privy-wallet) | The secure/mainnet wallet. Its key is held by Privy; spending is capped by a USDC allowance |
| [`docs/`](docs) | Stellar DeFi directory, testnet DeFi recipes for the CLI, and an experimental record of Claude's mainnet session |
| [`scripts/`](scripts) | `setup.sh` builds the CLI; `rpc-relay.py` lets it reach testnet/mainnet through the cloud proxy |
| [`.env.claudecode`](.env.claudecode) | What the cloud environment needs (variables, setup script, hosts) |
| [`CLAUDE.md`](CLAUDE.md) | Session setup and rules for agents |

## Cloud session setup

[`.env.claudecode`](.env.claudecode) lists everything a Claude Code cloud
environment needs, ahead of time. Set it in the environment's settings, not in
a file:

- **Setup script:** leave it empty. A setup script blocks the session while it
  runs, and the CLI build takes 5 to 15 minutes.
- **Environment variables:** `PRIVY_APP_SECRET` (optional, for `privy-wallet/`) and `NODE_USE_ENV_PROXY=1`
- **Network access:** the hosts listed in the file
- **Connector (optional):** Raven MCP

Then start each session with `/session-setup`. It runs
`scripts/session-start.sh` (relays, networks, deps; seconds), starts the CLI
build in the background if needed, and reports what's ready and what's next.

## Agent resources

- Raven MCP: `https://raven.stellar.org/mcp` (add as a connector, then authenticate)
- Stellar Skills: https://skills.stellar.org
- Docs index: https://developers.stellar.org/llms.txt
