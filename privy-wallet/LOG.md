# Privy wallet log

What was tried with the Privy wallet
`GDCSXONEADAR56IFW6SU3LPG4ILIR5CDVQ2ALTB3JCAGFMLVFWIJEBOM`, newest at the bottom.
Every transaction links to stellar.expert.

## Rules for the unattended mainnet session (2026-09-24)

The user funds the wallet with 30 mainnet XLM and gave one hour of unattended
DeFi experiments, "as safely as possible" and "not lose all the money". The per-transaction OK in `CLAUDE.md` is
waived for this session only, within these limits:

- ~~At least 15 of the 30 XLM stay untouched.~~ The user lifted this ("feel free
  to spend and play"). About 3 XLM stays spare for reserves and fees.
- Only well-known, liquid protocols: classic DEX/AMM, Soroswap, Blend (supply
  only). No borrowing, leverage or obscure tokens. Slippage limits on every
  trade.
- Every mainnet transaction is simulated, and its `privy.mjs` summary read,
  before it's signed with `--yes`. Each action type runs on testnet first.
- The Stellar CLI builds every transaction (user's call: no SDK unless
  absolutely necessary), so nothing is signed until the CLI build finishes.
- Anything unexpected stops mainnet activity until the user is back.

## 2026-09-24

| Time (UTC) | Network | What | Result |
| --- | --- | --- | --- |
| 01:27 | — | `node privy.mjs create` | Wallet `nba78jsed38y19957h3j0e63`, no owner (the app secret alone controls it) |
| 01:28 | testnet | Friendbot | 10,000 XLM. [2f5f4978…](https://stellar.expert/explorer/testnet/tx/2f5f49783f5651e37ee47e60ebd4e4d2be9e23c77ba29de955a4060d5c77fdf7) |
| 01:40 | mainnet | Research, no signing (stellar-sdk simulate reads; later reads use the CLI or curl) | Blend pools: Fixed 3, YieldBlox 3 (On Ice: supply/withdraw only), Orbit 4, Forex 5, Etherfuse 4 (Frozen). Fixed pool USDC ~81% utilized (target 80%, max 90%). XLM ≈ 0.2013 USDC on the DEX; Soroswap quotes 5 XLM → 1.0017 USDC (0.2004), so the DEX is slightly better |
| 01:41 | mainnet | 30 XLM arrived from the user | Balance 30.0000000 XLM |
