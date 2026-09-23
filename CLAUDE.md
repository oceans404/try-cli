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

- Go straight to `https://developers.stellar.org`. `docs.stellar.org` redirects
  to plain `http://developers.stellar.org`, which the proxy refuses.
- The full docs are in one large file at
  `https://developers.stellar.org/llms-full.txt`; grep it rather than printing it.

## Stellar CLI

Use the build from `main` by its full path: `~/.stellar-main/bin/stellar`
(installed by `scripts/setup.sh`, see the README).
