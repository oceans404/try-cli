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
