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

## Agent resources

- Raven MCP server: `https://raven.stellar.buzz/mcp`
  (`claude mcp add --transport http stellar-raven "https://raven.stellar.buzz/mcp"`, then `/mcp` → Authenticate)
- Stellar Skills: https://skills.stellar.org (`stellar/stellar-dev-skill`)
- `llms.txt`: https://developers.stellar.org/llms.txt
