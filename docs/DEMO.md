# Demo run sheet: try-cli in Claude Code (video)

One page for the shoot. Testnet only, no secrets on screen.

## The day before

- [ ] He **forks** `oceans404/try-cli` and installs the Claude GitHub App on the fork.
- [ ] He creates a **cloud environment** per [HUMANS.md](../HUMANS.md) §2:
      variables `NODE_USE_ENV_PROXY=1` only (**no `PRIVY_APP_SECRET`**),
      setup script empty, network access with the listed hosts.
- [ ] Decide on permission prompts: part of the show, or a more permissive mode.

## 45 minutes before filming

- [ ] He starts a session on his fork with that environment and types `/session-setup`.
      The CLI builds in the background (5 to 15 min). **Film in this same session.**
      A new session means a new container and another build.
- [ ] Once it reports `testnet-relay healthy`, do beat 1 below off camera as
      a backup wallet, so there's a funded wallet if friendbot misbehaves live.
- [ ] 5 minutes before: open https://try-cli-jukj.onrender.com/fortune in a
      browser to wake the seller (Render free tier sleeps; first hit ~30-60 s).

## On camera (about 15 min)

| # | Say / show | He types | Expect |
| --- | --- | --- | --- |
| 0 | README: "Claude's experiment... unaudited" | | |
| 1 | An agent gets its own wallet | `create and fund a testnet wallet, then get 5 USDC by swapping XLM on the DEX` | friendbot funding, USDC trustline, swap, stellar.expert links |
| 2 | Agents can shop | `show me what we can buy on Rail402` | table of ~10 paid APIs, 0.01-0.10 USDC |
| 3 | Pay per request (x402) | `buy a fortune with buy.mjs` | 402, then paid, then a fortune + lucky numbers, tx link |
| 4 | DeFi from the CLI | `swap 10 XLM for USDC on Soroswap, then lend 1 USDC on Blend's CETES pool and withdraw it` | a Soroswap swap, a Blend supply and withdraw, tx links |
| 5 | Guardrails | `could you use a mainnet wallet?` | read-only mainnet, Privy opt-in per task, USDC allowance cap |

Click one stellar.expert link on camera. They're real testnet transactions.

## If something goes wrong

| What happens | Say / do |
| --- | --- |
| A Blend withdraw fails once, then works on retry | Known quirk (docs "Gotchas"): the chain moved between simulation and submit. Claude retries. |
| Friendbot error or rate limit | Use the backup wallet from the warm-up |
| "host blocked" / proxy 403 | Add the host in the environment's network access. It needs a **new** session, so move on to another beat |
| CLI still building | Show README, HUMANS.md, and Rail402 (beat 2 doesn't need the CLI) meanwhile |
| Fortune request hangs | Render is waking up. Wait 60 s or buy from `demo-seller-testnet.up.railway.app/hello` instead |
| Soroswap and the DEX show very different prices | Testnet prices are fake. A good line about why mainnet differs |

## Don't

- Show or paste any secret, or set `PRIVY_APP_SECRET` in his environment.
- Touch mainnet on camera.
- Start a second session mid-shoot (the build starts over).

Dry-run timings and issues: [demo-dryrun.md](demo-dryrun.md) (once it lands).
