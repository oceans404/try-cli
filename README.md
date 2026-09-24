# try-cli

Trying out [Stellar CLI for Agents](https://developers.stellar.org/docs/tools/cli/agent-cli).

## Cloud session setup

`scripts/setup.sh` installs the Linux build dependencies and builds the Stellar
CLI from GitHub `main` into `~/.stellar-main` (5 to 15 minutes cold). Paste it
into the environment's **Setup script** so every new session starts with the CLI.

Call the main build by its full path:

```bash
~/.stellar-main/bin/stellar doctor
~/.stellar-main/bin/stellar skill
```

## Projects

- [`example-x402-seller/`](example-x402-seller): a paid x402 API on Stellar testnet
- [`privy-wallet/`](privy-wallet): the secure/mainnet wallet, with its key held by Privy

## Agent resources

- Raven MCP server: `https://raven.stellar.org/mcp`
  (`claude mcp add --transport http stellar-raven "https://raven.stellar.org/mcp"`, then `/mcp` → Authenticate)
- Stellar Skills: https://skills.stellar.org (`stellar/stellar-dev-skill`)
- `llms.txt`: https://developers.stellar.org/llms.txt
