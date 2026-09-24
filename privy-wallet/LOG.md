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
| ~01:33 | mainnet | Research, no signing (stellar-sdk simulate reads; later reads use the CLI or curl) | Blend pools: Fixed 3, YieldBlox 3 (On Ice: supply/withdraw only), Orbit 4, Forex 5, Etherfuse 4 (Frozen). Fixed pool USDC ~81% utilized (target 80%, max 90%). XLM ≈ 0.2013 USDC on the DEX; Soroswap quotes 5 XLM → 1.0017 USDC (0.2004), so the DEX is slightly better |
| ~01:34 | mainnet | 30 XLM arrived from the user | Balance 30.0000000 XLM |
| 01:40 | — | CLI finished building (`stellar 28.0.0`). The hour starts | `keys add privy-wallet --public-key`, aliases for router/usdc/xlm/blend-pool on both networks |
| 01:40 | testnet | USDC trustline: `tx new change-trust --build-only \| privy.mjs sign --yes \| tx send`. First real Privy signature | [b6940fd2…](https://stellar.expert/explorer/testnet/tx/b6940fd2531245e6e3da64b85da1d70e67e43c4a84d625f7df43c77ac08a9f06) |
| 01:41 | testnet | Classic DEX: `path-payment-strict-receive` 20 USDC, send-max 20 XLM | Paid ~19.14 XLM. [0c743d0d…](https://stellar.expert/explorer/testnet/tx/0c743d0d8cdc3f0dda13c552548e49893b65e4adfec0624dbd9bd14b40a04665) |
| 01:41 | testnet | Soroswap `swap_exact_tokens_for_tokens` 10 XLM → USDC, min 99% of quote. `contract invoke --build-only \| tx simulate \| privy.mjs sign \| tx send`. First Privy-signed contract call | Got 1.053762 USDC, exactly the quote. [8a2a72a1…](https://stellar.expert/explorer/testnet/tx/8a2a72a1595834fef5c1831786c08c21d8154b050b05e70205dc34071ad171f3) |
| 01:42 | testnet | Blend CETES pool `submit` supply 5 USDC (`request_type` 0) | 49,944,462 pool shares. [634cdd7e…](https://stellar.expert/explorer/testnet/tx/634cdd7e8bcf039f48e040bc53d286a63859085c118199ba89f4409288afc402) |
| 01:42 | testnet | Blend withdraw, asked 6 USDC (`request_type` 1, capped at the position) | Position empty, got 5 USDC back less 1 stroop. [bff836f4…](https://stellar.expert/explorer/testnet/tx/bff836f4fdf746cb20422a0533675e69b57015ef6c514ab617537ea09e514338) |
| 01:43 | mainnet | USDC trustline (0.5 XLM reserve). First mainnet Privy signature | [7a54c218…](https://stellar.expert/explorer/public/tx/7a54c2184ada043245b6f72c39590f41714152ea673f8735f25a194c984e43e9) |
| 01:44 | mainnet | Classic DEX: buy 2 USDC, send-max 10.07 XLM (quote 9.97, direct path) | Paid ~9.97 XLM. [5c3e270d…](https://stellar.expert/explorer/public/tx/5c3e270d6ae0fda401e79061b8665694828921b7abec57ab8f6a743a18dcb616) |
| 01:45 | mainnet | Soroswap: 3 XLM → USDC, min 0.5951 (99% of 0.6011 quote) | Got 0.6011561 USDC. [3afa7969…](https://stellar.expert/explorer/public/tx/3afa7969cfd3f1dd495c3138729b31dcca5aa2bb0d3414d4d91aed63230783c0) |
| 01:46 | mainnet | Blend Fixed pool (status 3, On Ice; USDC 80.9% utilized): supply 2 USDC, fee 0.055 XLM | 17,416,034 shares ≈ 2.0000 USDC. [594998eb…](https://stellar.expert/explorer/public/tx/594998ebcade745de8636da015fbe9e3287c11fb7b878262f3ca71390342f4ee) |
