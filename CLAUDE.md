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
