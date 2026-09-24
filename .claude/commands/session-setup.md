---
description: Get this repo's cloud session ready (Stellar CLI, relays, deps) and report where things stand
argument-hint: "[--mainnet] [what to work on]"
---

Set up this session for the try-cli repo, then report back briefly.

1. Run `scripts/session-start.sh` (add `--mainnet` if "$ARGUMENTS" mentions
   mainnet). It takes seconds. It starts the RPC relays, adds the
   `testnet-relay`/`mainnet-relay` networks, runs `npm install`, and reports
   whether `PRIVY_APP_SECRET` and a Privy wallet exist. If the CLI isn't built
   yet, it starts the build in the background (5 to 15 minutes). In that
   case, run this as a background Bash command, so you're notified when it
   finishes and can keep talking to the user meanwhile:
   `until [ -x ~/.stellar-main/bin/stellar ]; do sleep 30; done; scripts/session-start.sh`.
   Until it's done, skip step 2 and any `stellar` commands, and work on
   whatever doesn't need the CLI.
2. Run `stellar skill` and read it (CLAUDE.md says to).
3. Re-read the Rules in `CLAUDE.md`. In particular, the Privy wallet is
   opt-in per task, and mainnet is read-only unless the user says otherwise.
4. Reply in a few lines:
   - what's ready or broken (with the script's output),
   - the testnet identities available (new containers have none; offer to
     create and fund one, with USDC per `docs/testnet-defi-cli.md`),
   - what the repo can do (CLAUDE.md, What's here), and the open next step in
     `privy-wallet/README.md` (Next steps), which needs the user's OK to use
     the Privy wallet,
   - and "$ARGUMENTS", if given, as the task to start on.

Don't create wallets, send transactions, or use `PRIVY_APP_SECRET` during
setup unless "$ARGUMENTS" asks for it.
