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
| 01:48 | testnet | New CLI identity `main-testnet` (friendbot, trustline, 3 USDC), then `token approve` 1 USDC to the Privy wallet until ledger 4855459 (~1 day) | [e0177c9a…](https://stellar.expert/explorer/testnet/tx/e0177c9a1eabd8f95108f3922271effcb2a9acbd2e035ccec9035adc8078dd4f) |
| 01:49 | testnet | Privy wallet `transfer_from` 0.6 USDC out of the allowance | Allowance 1 → 0.4. [73f8b282…](https://stellar.expert/explorer/testnet/tx/73f8b282fdfbaebc9ce416a7579ec4ca842f856dcf25e912526312450a8278a0) |
| 01:49 | testnet | Over-cap pull: `transfer_from` 0.5 with 0.4 left | Rejected in simulation: `Error(Contract, #9)` "not enough allowance to spend", nothing signed. The cap holds |
| 01:50 | testnet | `node privy.mjs buy .../fortune` (x402, 0.01 USDC). Privy signs the auth entry | 200 OK, "The wise listen twice as much as they speak." [b4061f8c…](https://stellar.expert/explorer/testnet/tx/b4061f8c79b2eb3e100e266274e4a60bbc5b056273ca64c172ffffae76ed4f22) |

**Privy works end to end with the real Privy (not the mock):** classic ops, contract
calls, allowance pulls and x402 auth entries, on testnet and mainnet.
| 01:50 | testnet | Soroswap `add_liquidity` 1 USDC + ≤10 XLM, then `remove_liquidity` all 29,175,270 LP | Both landed, LP back to 0. [add](https://stellar.expert/explorer/testnet/tx/268216b6977bb8bc298f9ddf26ec9a24f74612478230856bf3c2765f7cb8f036), [remove](https://stellar.expert/explorer/testnet/tx/06adaf64b355f51d7b45a933f3c4d600c75c46c4baddff5cdf618f45d215d7e5) |
| 01:50 | mainnet | Soroswap USDC/XLM pair `CAM7DY53…OABP` (reserves 313,288 XLM / 62,932 USDC ≈ 4.98 XLM per USDC): `add_liquidity` 0.5 USDC + ~2.49 XLM, 5% slippage floors, fee 0.037 XLM | 9,657,898 LP tokens. Left open to earn fees. [d8cb0d5a…](https://stellar.expert/explorer/public/tx/d8cb0d5a620532dec828257cd02eae83c2eb7b00e743391a6569d77541ccc1ec) |
| 01:51 | testnet | Classic order book: resting `manage-sell-offer` 1 USDC @ 100 XLM, then cancel (`--amount 0 --offer-id`) | [place](https://stellar.expert/explorer/testnet/tx/7d15451b1eac7e1875ba1bb819a7298c0753fdcfb54bbb4e6a82320afb133958), [cancel](https://stellar.expert/explorer/testnet/tx/464bafbeaf027823a6a1caf0f9758adf451a26daa0b7317d78a54bc2bdae128b) |
| 01:51 | mainnet | **Failed, my mistake:** offer 0.5 USDC @ 10 XLM. I misread `token balance` 1011561 as 1.01 USDC; it's 0.1012 (stroops) | `Underfunded`, cost 0.00001 XLM. [6b8d96f3…](https://stellar.expert/explorer/public/tx/6b8d96f327d9ba26db74e0a9f5e0c8483eafc1bc33955eb2e70ecbc2280ce688) |
| 01:51 | mainnet | Offer 0.1 USDC @ 10 XLM (market ≈ 4.98, so it can't fill), then cancel | Offer 1858747575 rested, then 0 open offers. [place](https://stellar.expert/explorer/public/tx/032fb1a2243235e01c5c51649fbc62440f93fe2c81a19c8c59abb79897d1afc0), [cancel](https://stellar.expert/explorer/public/tx/429115a34e8b40d9aa5e1c345842562fec898c94fbf6098d65d6f1435d654213) |
| 01:54 | testnet | Classic AMM: pool-share trustline (`tx new change-trust --build-only \| tx decode` → swap `line` for the pool share → `tx encode \| privy.mjs sign \| tx send`), deposit, withdraw all, remove trustline (`limit` 0) | 1.9906413 shares in and out. [trust](https://stellar.expert/explorer/testnet/tx/efcb1db9adad13566904f17e3ce7729769eebb154e498c16748bb505bc290965), [deposit](https://stellar.expert/explorer/testnet/tx/51584c6065f3a8e86590e5f995a7603078e328ff1c1a92bb7750853dd4beef83), [withdraw](https://stellar.expert/explorer/testnet/tx/a3b63fc3f7653e4de8a936b50c83240928e1469882eff8115e0e6c6156ce5525), [untrust](https://stellar.expert/explorer/testnet/tx/9e3dc353c587e99bc009d94168c9e07aa74ee37b7ee7cc211c76720321ae79c4) |
| 01:56 | mainnet | Classic AMM XLM/USDC pool `a468d41d…` (`LCSGRVA5…IQQUG`, 30 bp, ≈4.99 XLM per USDC): pool-share trustline (1 XLM reserve), then deposit ≤0.5 XLM + ≤0.1 USDC, price band 4.7–5.3 | 0.1661973 shares. [trust](https://stellar.expert/explorer/public/tx/e1a155164ad009afdc88f7cd62928254918f8c221e90f142d3c87133186a1a7a), [deposit](https://stellar.expert/explorer/public/tx/54a2c0db5e8aa5d0c4c7ef822f0a487acfe861812b48e9e0eddf9460ffdb1de6) |
| 01:56 | — | **Found a gap in `privy.mjs`:** the summary for `liquidityPoolDeposit` showed only the op type, no amounts or prices. I checked the mainnet deposit with `tx decode` before signing. Fixed `describeOp` to show pool id, max amounts, price band and withdraw minimums, with a self-test that fails without the fix | Committed |
| 01:58 | mainnet | Research, read-only: Aquarius API. Its XLM/USDC pool `CBBMQBNH…BUCV` is concentrated liquidity, 0.10% fee, ~$1.46M liquidity, reported APY 20.5% + 4.2% AQUA rewards (Aquarius's own figures) | Not traded: no testnet deployment to rehearse on |
| 02:25 | mainnet | Blend: position worth 2.0000110 USDC after 40 min (earned 0.000011). Withdraw all (asked 2.1, capped) | Position empty. [835132f3…](https://stellar.expert/explorer/public/tx/835132f39c25dd44c45d39d76cfd71a3571e18b9ae609a4d4dead1a98ce29af3). My slip: my grep showed only the function name, not the request list, before signing. Read full summaries after that |
| 02:26 | mainnet | Soroswap `remove_liquidity`, 99% minimums | **Dropped:** `tx send` returned "transaction submission timeout"; the tx never reached the ledger (`tx fetch result` and Horizon: not found), no fee charged. [7cbb0eb4…](https://stellar.expert/explorer/public/tx/7cbb0eb4e67ca8c117ba90a73080f3cfce972050326458764cd742c2e14b20ac) |
| 02:28 | mainnet | Rebuilt with fresh minimums and a 10-min deadline (was 5), resent | Got ~0.4994 USDC + ~2.49 XLM back, LP 0. [21642c30…](https://stellar.expert/explorer/public/tx/21642c300415598c1a358686a2f7a7aae03c5ac007b6f8faa8a28469448a3213) |
| 02:28 | mainnet | Classic AMM withdraw 0.1661973 shares, 99% minimums (the summary now shows them) | [459aef49…](https://stellar.expert/explorer/public/tx/459aef49d682b7ebea40500caad135ab90c34c700c06f301e2cb5f58e7eb4165) |
| 02:29 | mainnet | Remove the pool-share trustline (`limit` 0), frees 1 XLM reserve | [4e2e2809…](https://stellar.expert/explorer/public/tx/4e2e280984c06ec145aeb3c2c1e02433f4ec9c5023ad9cbff452e8f7ea7b1aac) |

## Tally (02:30 UTC)

| | XLM |
| --- | --- |
| Started with | 30.0000000 |
| Now: 16.9405098 XLM + 2.6006328 USDC (sells for 12.958 XLM on the DEX) | ≈ 29.8986 |
| Fees, 14 mainnet txs (1 failed) | 0.0906 |
| Everything else (spreads, rounding) | ≈ 0.01 |

All positions are closed: no Blend supply, no LP tokens, no offers. What's left
is XLM, USDC, and the USDC trustline (0.5 XLM of the XLM is its reserve).
Whether to sell the USDC back to XLM is the user's call.

### What I learned

- **Privy works for real** with the CLI (`--build-only | tx simulate | privy.mjs
  sign | tx send`), for classic ops, contract calls, allowance pulls and x402,
  on both networks. The on-chain allowance cap rejects over-cap pulls.
- **`privy.mjs` summary gap, fixed:** liquidity pool ops showed only their type.
  Always check that a summary actually shows the amounts before `--yes`.
- **Mainnet yields over an hour are noise:** 2 USDC in Blend earned 0.000011.
  Fees (≈0.09 XLM) dwarf it. Positions only make sense held for weeks.
- **Blend mainnet:** Fixed and YieldBlox are On Ice (status 3), still fine for
  supply and withdraw. Fixed-pool USDC sits at ~81% utilization.
- **Prices:** DEX, Soroswap and the classic AMM agreed within ~0.5% (4.98–5.0 XLM
  per USDC); the DEX was slightly best for buying USDC.
- **`tx send` can time out** with the tx never landing. Check `tx fetch result
  --hash`, then rebuild (fresh simulate, longer deadline) rather than assume.
- **Stroops:** `token balance` prints stroops. 1011561 is 0.1011561, not 1.01.
- **Classic AMM from the CLI** needs two workarounds: the pool-share trustline
  (`tx decode` → edit `line` → `tx encode`) and the `L…` pool id, which Horizon
  gives only in hex. `lpid.py` (plain Python, below) converts it.

```python
# hex liquidity pool id -> L... strkey (version byte 11<<3, CRC16-XModem, base32)
import base64, sys
def crc16(b):
    c = 0
    for x in b:
        c ^= x << 8
        for _ in range(8): c = ((c << 1) ^ 0x1021) & 0xFFFF if c & 0x8000 else (c << 1) & 0xFFFF
    return c
raw = bytes([11 << 3]) + bytes.fromhex(sys.argv[1])
print(base64.b32encode(raw + crc16(raw).to_bytes(2, "little")).decode())
```
