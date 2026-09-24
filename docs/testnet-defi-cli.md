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

## More rehearsals (2026-09-24)

### Mainnet rehearsal: capped agent wallet lends on Blend

This is the planned mainnet setup: the main wallet grants an allowance, and the
agent wallet signs through `privy-wallet/privy.mjs`. Here the Privy mock stood
in for Privy.

1. Main wallet: `token approve --id usdc --from my-wallet --spender <agent> --amount 10000000 --expiration-ledger <now+17280>`. [ebc8ab39…](https://stellar.expert/explorer/testnet/tx/ebc8ab3940a2b3cc598bf6ff47f8c496ec9c091bf1476183c343b07f25ff2be2)
2. Agent pulls 1 USDC with `transfer_from`; the allowance drops to 0. [9d236323…](https://stellar.expert/explorer/testnet/tx/9d23632352dbb2aa29429eb5f084dc858bfa0ab8aebc74e946e6afda701d2ac0)
3. Agent supplies it to Blend, lend only (`request_type` 0). [4b779578…](https://stellar.expert/explorer/testnet/tx/4b77957cb49378714619f394052c9696b72cce905f25c14f8c7e56dd2c22f93f)
4. Agent withdraws (`request_type` 1). The first try failed on-chain (see
   Gotchas); the retry landed. [42f80220…](https://stellar.expert/explorer/testnet/tx/42f80220c3235cac4c0989718a2bc54a50b9245d6bbac448bc6d8e2831ff5bc6)

Agent calls go through `contract invoke --build-only | tx simulate | privy.mjs sign | tx send`.

### DeFindex vault (deposit one token, a strategy manages it)

Testnet contracts come from `https://testnet.rgstry.xyz/api/v1/contracts`
(channel `defindex`). The **XLM vault** `CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6`
takes native XLM. The "USDC" vault uses Blend's test USDC (issuer `GATALT…`),
not Circle's.

```bash
$S contract invoke --id <vault> -- deposit --amounts_desired '["100000000"]' --amounts_min '["99000000"]' --from my-wallet --invest true
$S token balance --id <vault> --account my-wallet                        # vault shares (the vault is a token)
$S contract invoke --id <vault> --send=no -- get_asset_amounts_per_shares --vault_shares <shares>
$S contract invoke --id <vault> -- withdraw --withdraw_shares <shares> --min_amounts_out '["98000000"]' --from my-wallet
```

10 XLM went in and 9.9998452 came out. [da872c95…](https://stellar.expert/explorer/testnet/tx/da872c9518741615fd95c6c36500de23fb8b99a377b3a979b779ff67243e715b), [3ddfd15e…](https://stellar.expert/explorer/testnet/tx/3ddfd15e03d21ea92cde4676ec3751909c96d9b497591b100c50b4c071fc3709)
`fetch_total_managed_funds` showed `invested_amount` 0: deposits sit idle
until the vault manager rebalances into the Blend strategy.

### Classic order book (`tx new manage-sell-offer`)

```bash
$S tx new manage-sell-offer --selling USDC:<issuer> --buying native --amount 10000000 --price 100:1   # rests, won't fill
curl -sS https://horizon-testnet.stellar.org/accounts/<G>/offers                                       # get the offer id
$S tx new manage-sell-offer --selling USDC:<issuer> --buying native --amount 0 --price 100:1 --offer-id <id>   # cancel
```

[1ab4ffe1…](https://stellar.expert/explorer/testnet/tx/1ab4ffe11da4e9c050c18261c6ed3e9f2f42317d784b4e1d63f2721e5f55f4fa), [a9ec3d8e…](https://stellar.expert/explorer/testnet/tx/a9ec3d8ed1929a1b1e3d04bfb359834a028c739e4c1f64ae70193a8ddd2766ed)

### Classic AMM (`tx new liquidity-pool-deposit/withdraw`)

The XLM/USDC pool is `4cd1f6de…d63f` (Horizon `/liquidity_pools?reserves=native,USDC:<issuer>`, 30 bp fee).

- **Pool-share trustline:** `tx new change-trust --line` doesn't accept pool
  shares. Build a normal USDC change-trust with `--build-only`, then
  `tx decode --output json`. Replace the `line` with
  `{"pool_share":{"liquidity_pool_constant_product":{"asset_a":"native","asset_b":<the USDC line>,"fee":30}}}`,
  then `tx encode | tx sign --sign-with-key my-wallet | tx send`. The same
  trick with `--limit 0` removes it.
- **Pool ID:** `--liquidity-pool-id` wants the `L...` strkey, not Horizon's hex
  (`StrKey.encodeLiquidityPool(Buffer.from(hex, "hex"))` gives
  `LBGND5W67ORDP3WLYX7P4JM7RHV4JNPN2SIRNPVVKNWEANH4JDLD7Q7I`).
- **Price band:** `--min-price`/`--max-price` are asset A per asset B (XLM per
  USDC, about 0.954 here), so use `9:10` to `1:1`. The reverse band fails.

```bash
$S tx new liquidity-pool-deposit --liquidity-pool-id <L...> --max-amount-a 20000000 --max-amount-b 30000000 --min-price 9:10 --max-price 1:1
$S tx new liquidity-pool-withdraw --liquidity-pool-id <L...> --amount <shares in stroops> --min-amount-a 1 --min-amount-b 1
```

Deposit gave 1.9906421 shares, then withdraw. [ed9da043…](https://stellar.expert/explorer/testnet/tx/ed9da043b11f0519fcff78746a6abd03aed561575f6e7a0d10afc4c7ef6a4bf2), [5f918178…](https://stellar.expert/explorer/testnet/tx/5f9181782ddadb78069077999e4ffe42e92baed391600d7a34bd98b102fd819e)

### Tokenized bonds: Etherfuse CETES

The testnet CETES is `CETES:GC3CW7EDYRTWQ635VDIGY6S4ZUF5L6TQ7AA4MWS7LEQDBLUSZXV7UPS4`
(SAC `CC72F57Y…YHIC`), a plain classic asset. Buy it on the classic DEX. The
cheap route goes through XLM, so pass `--path` (take it from Horizon
`/paths/strict-receive`); without it the CLI tries only the direct market and
fails with `OverSendmax`.

```bash
$S tx new change-trust --line CETES:<issuer>
$S tx new path-payment-strict-receive --send-asset USDC:<issuer> --send-max 2000000 --destination my-wallet \
  --dest-asset CETES:<issuer> --dest-amount 100000000 --path native
```

10 CETES cost under 0.1 USDC (a testnet price). They then worked as Blend
collateral in the CETES pool (`request_type` 2, reserve index 2) and came back
out. [84aaf820…](https://stellar.expert/explorer/testnet/tx/84aaf820677ef42a636335199e288f96c31ef7583770161ed78fb76fee2aa81c), [dd7ff265…](https://stellar.expert/explorer/testnet/tx/dd7ff2651d9ecbe9d0d9ac4d8262c28a94328cba17bd197f0b98d935f2295f9b), [bc906484…](https://stellar.expert/explorer/testnet/tx/bc906484f635ce29c8911684f77e59cd8e2d6e44dcea50b659ca34491c9bdc80)

### Price gap between the classic DEX and Soroswap

Testnet prices disagree: USDC is about 1 XLM on the DEX and about 9.4 XLM on
Soroswap. Buying 1 USDC on the DEX and selling it on Soroswap netted 8.47 XLM
after fees; that mostly recovered the ~9 XLM lost on the first Soroswap swap above, so the wallet ended the day about even. [b50feeb0…](https://stellar.expert/explorer/testnet/tx/b50feeb0a51a5bf7c208f6ccde916d0e2736ba83ed4925ce077a571500558871), [a8f16d27…](https://stellar.expert/explorer/testnet/tx/a8f16d27d7db487280128270bd67cc2e895f6e8833591bb525815fd51d342755) It has to be two transactions: a
Soroban transaction holds exactly one operation, so it can't bundle the
classic leg.

## Gotchas

- **Blend call right after another Blend call:** twice, a withdraw that
  simulated fine failed on-chain (`trapped` / `trying to access contract data
  key outside of the footprint`). The failed txs are [0fdfa0df…](https://stellar.expert/explorer/testnet/tx/0fdfa0df68038746b56661d7eea9ace0fc5ada31c8f4645d1acd9ec39f6c8bc1) and
  [20f1311b…](https://stellar.expert/explorer/testnet/tx/20f1311b20113d6f3d9d6f0d4d52bde035105b54efa21599c1a4a82a3971cd6f). Re-running the same command, which simulates again, worked
  both times. So retry once before assuming the request is wrong.
- Horizon's `/accounts/<G>/transactions` hides failed transactions. Look a
  failed one up by hash.
- Amounts in `tx new` are stroops; `--price` is `numerator:denominator`.
