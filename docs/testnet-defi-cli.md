# Testnet DeFi with the Stellar CLI

Recipes that ran end to end on 2026-09-24 with a CLI identity (`my-wallet`).
Contract IDs and background are in [stellar-defi-directory.md](stellar-defi-directory.md).
Amounts are in stroops (7 decimals). `$S` is `~/.stellar-main/bin/stellar`, and
every command takes `--source my-wallet --network testnet-relay` (left out below).

## Setup

```bash
$S contract alias add soroswap-router  --id CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD
$S contract alias add blend-cetes-pool --id CAPBMXIQTICKWFPWFDJWMAKBXBPJZUKLNONQH3MLPLLBKQ643CYN5PRW
$S contract alias add usdc --id CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA   # Circle testnet USDC
$S contract alias add xlm  --id CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC   # native XLM SAC
```

Aliases work as `--id`, but arguments inside JSON (paths, request lists) need
the raw `C...` IDs.

`stellar token` handles the token side: `token balance --id usdc --account my-wallet`
works for USDC, XLM, and LP tokens. The protocol actions below are calls to the
protocols' own contracts, so they use `contract invoke`. They move your tokens
under the transaction's signature, so no `token approve` is needed first.

## Soroswap: swap

```bash
PATHJ='["CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC","CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"]'
$S contract invoke --id soroswap-router --send=no -- router_get_amounts_out --amount_in 100000000 --path "$PATHJ"
$S contract invoke --id soroswap-router -- swap_exact_tokens_for_tokens \
  --amount_in 100000000 --amount_out_min <99% of quote> --path "$PATHJ" \
  --to my-wallet --deadline $(( $(date +%s) + 600 ))
```

10 XLM gave 1.0537623 USDC, matching the quote
([a6278fd6…](https://stellar.expert/explorer/testnet/tx/a6278fd67be1d0a37b28b152f5d4767c94ecefd70efcefda081a50ffd0bdf137)).
The XLM/USDC pair is `CCBX3NZT…7RQS` (`factory get_pair`). Soroswap prices
USDC near 9.5 XLM, while the classic DEX was near 1 XLM, so check both.

## Soroswap: provide liquidity

```bash
$S contract invoke --id soroswap-router -- add_liquidity --token_a <USDC> --token_b <XLM> \
  --amount_a_desired 10000000 --amount_b_desired 100000000 --amount_a_min 9500000 --amount_b_min 80000000 \
  --to my-wallet --deadline <unix+600>
$S token balance --id <pair> --account my-wallet      # LP tokens (the pair is the LP token)
$S contract invoke --id soroswap-router -- remove_liquidity --token_a <USDC> --token_b <XLM> \
  --liquidity <LP> --amount_a_min 9900000 --amount_b_min 1 --to my-wallet --deadline <unix+600>
```

It took 1 USDC plus 9.46 XLM (the pool ratio) and returned both, less 1 to 2
stroops of rounding
([add](https://stellar.expert/explorer/testnet/tx/4a1823b6fa28eb354a89e475355ecaa3014f98f9828bcbedf1c3bb1bcf9e0ced),
[remove](https://stellar.expert/explorer/testnet/tx/caa397780eedbc59a3f3fe51c7fb5864d9be31ea1373f7bdb77043a807fbed6b)).

## Blend: lend and borrow

Use the **CETES pool**. It's the testnet Blend pool that lists Circle's testnet
USDC; the other pool uses Blend's own test USDC. Everything goes through
`submit` with a list of requests, all applied in one transaction:

| `request_type` | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| Action | supply | withdraw | supply collateral | withdraw collateral | borrow | repay |

```bash
# 2 USDC in as collateral, borrow 1 XLM against it
$S contract invoke --id blend-cetes-pool -- submit --from my-wallet --spender my-wallet --to my-wallet \
  --requests '[{"address":"<USDC>","amount":"20000000","request_type":2},{"address":"<XLM>","amount":"10000000","request_type":4}]'
$S contract invoke --id blend-cetes-pool --send=no -- get_positions --address my-wallet
# Repay a little extra (refunded) and withdraw more than you hold (capped)
$S contract invoke --id blend-cetes-pool -- submit --from my-wallet --spender my-wallet --to my-wallet \
  --requests '[{"address":"<XLM>","amount":"10100000","request_type":5},{"address":"<USDC>","amount":"21000000","request_type":3}]'
```

`get_positions` keys are reserve indexes (`get_reserve_list` order: 0 XLM,
1 USDC) and values are pool shares, not token amounts. The unwind returned
the positions to empty
([borrow](https://stellar.expert/explorer/testnet/tx/e6732c18a651e5269b64a94604f925f0ec53e67149e0e6b22a87f5a3ea187d06),
[repay](https://stellar.expert/explorer/testnet/tx/40547f74e5de468008cf94d76365e4fba931985ea19d48ca2fc316e7194ff24d)).
Check `get_config` first: `status` 0 or 1 means active. Mainnet pools were
On Ice or Frozen (3 to 5) on 2026-09-24.
