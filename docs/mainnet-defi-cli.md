# Mainnet DeFi with the Stellar CLI and a Privy wallet: how Claude did it

> [!WARNING]
> **Experimental. Written by Claude (an AI agent), not reviewed by a person.**
> This is a record of how Claude ran one hour of small mainnet experiments on
> 2026-09-24, kept so people can see how it did it. **Don't use it for
> anything else.** It isn't a guide, advice, or a safe way to handle money.
> Contract IDs, prices and pool states change. The wallet setup it describes
> (an app secret alone controls the wallet) isn't safe for real funds. It moved
> about 30 XLM and lost about 0.10 XLM, almost all of it fees.

Every transaction, with its link and timestamp, is in
[`privy-wallet/LOG.md`](../privy-wallet/LOG.md). This page is the method. Testnet
versions of the same recipes are in [testnet-defi-cli.md](testnet-defi-cli.md).

## How each transaction went through

1. Run the same command on testnet first.
2. Mainnet: quote or read with `--send=no` (free, touches nothing).
3. Build with `--build-only`. Contract calls go through `tx simulate`, which
   runs them against real mainnet state and fails if the call would fail.
4. Run `privy.mjs sign` **without** `--yes` and read the summary: contract,
   function, amounts, minimums, recipient, fee. Check the summary actually
   shows the amounts (it didn't for pool ops until a fix; see Gotchas).
5. Sign with `--yes`, send, then check balances with `token balance`.

Setup: `scripts/session-start.sh --mainnet` (starts the mainnet relay), then
`stellar keys add privy-wallet --public-key "$(node privy-wallet/privy.mjs address)"`.
`$S` below is `~/.stellar-main/bin/stellar`, `M` is `--network mainnet-relay`,
and every command also takes `--source privy-wallet`.

### Helper: sign and send

The pipeline is `... --build-only | privy.mjs sign --network mainnet --yes | $S tx send $M`.
Claude wrapped it to print the stellar.expert link:

```bash
#!/bin/bash
# psend.sh <testnet|mainnet>: unsigned XDR on stdin -> Privy sign --yes -> CLI send
set -o pipefail
net=$1; S=~/.stellar-main/bin/stellar; export NODE_USE_ENV_PROXY=1 NODE_NO_WARNINGS=1
cd privy-wallet
signed=$(node privy.mjs sign --network $net --yes 2>/tmp/psend.sign) || { cat /tmp/psend.sign; exit 1; }
hash=$(grep -o 'signed tx [0-9a-f]*' /tmp/psend.sign | cut -d' ' -f3)
out=$(echo "$signed" | $S tx send --network $net-relay 2>&1); rc=$?
echo "send rc=$rc  https://stellar.expert/explorer/$([ $net = mainnet ] && echo public || echo testnet)/tx/$hash"
[ $rc -ne 0 ] && echo "$out" | tail -25
exit $rc
```

## Contracts used (mainnet, 2026-09-24)

| What | ID |
| --- | --- |
| USDC (Circle) issuer / SAC | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` / `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| XLM SAC | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |
| Soroswap router | `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` |
| Soroswap USDC/XLM pair (also the LP token) | `CAM7DY53G63XA4AJRS24Z6VFYAFSSF76C3RZ45BE5YU3FQS5255OOABP` (`token_0` is XLM) |
| Blend Fixed Pool V2 | `CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD` (status 3, On Ice) |
| Classic XLM/USDC pool, 30 bp | hex `a468d41d8e9b8f3c7209651608b74b7db7ac9952dcae0cdf24871d1d9c7b0088`, `LCSGRVA5R2NY6PDSBFSRMCFXJN63PLEZKLOK4DG7ESDR2HM4PMAIQQUG` |

Claude added them as aliases per network (`contract alias add usdc --id ... $M`).
Arguments inside JSON (paths, request lists) still need the raw `C...` IDs.

## Recipes that ran

### USDC trustline, then buy on the DEX

```bash
$S tx new change-trust $M --build-only --line USDC:GA5ZSEJ...KZVN | psend.sh mainnet
# quote: Horizon /paths/strict-receive?source_assets=native&destination_asset...&destination_amount=2
$S tx new path-payment-strict-receive $M --build-only --send-asset native --send-max 100700000 \
  --destination privy-wallet --dest-asset USDC:GA5ZSEJ...KZVN --dest-amount 20000000 | psend.sh mainnet
```

2 USDC for 9.97 XLM, send-max 1% above the quote.

### Soroswap swap

```bash
PATHJ='["CAS3J7GY...OWMA","CCW67TSZ...MI75"]'
$S contract invoke --id soroswap-router $M --send=no -q -- router_get_amounts_out --amount_in 30000000 --path "$PATHJ"
$S contract invoke --id soroswap-router $M --build-only -- swap_exact_tokens_for_tokens \
  --amount_in 30000000 --amount_out_min <99% of quote> --path "$PATHJ" --to privy-wallet \
  --deadline $(( $(date +%s) + 600 )) | $S tx simulate $M --source-account privy-wallet | psend.sh mainnet
```

### Blend: supply, then withdraw

Check `get_config` (`status` 0–3 allows supply and withdraw) and the USDC
reserve's utilization (`get_reserve`: `d_supply*d_rate / b_supply*b_rate`, stay
well under `max_util`) first.

```bash
$S contract invoke --id blend-pool $M --build-only -- submit --from privy-wallet --spender privy-wallet --to privy-wallet \
  --requests '[{"address":"CCW67TSZ...MI75","amount":"20000000","request_type":0}]' \
  | $S tx simulate $M --source-account privy-wallet | psend.sh mainnet
$S contract invoke --id blend-pool $M --send=no -q -- get_positions --address privy-wallet
# withdraw: request_type 1, ask a little more than the position (it's capped)
```

2 USDC for 40 minutes earned 0.000011 USDC. A Blend call costs about 0.05 XLM.

### Soroswap liquidity

Size from `get_reserves` on the pair. Remove with minimums from
`reserves * lp / total_supply`, less 1%.

```bash
$S contract invoke --id soroswap-router $M --build-only -- add_liquidity --token_a <USDC> --token_b <XLM> \
  --amount_a_desired 5000000 --amount_b_desired 25000000 --amount_a_min 4750000 --amount_b_min 23500000 \
  --to privy-wallet --deadline <unix+600> | $S tx simulate $M --source-account privy-wallet | psend.sh mainnet
$S contract invoke --id soroswap-router $M --build-only -- remove_liquidity --token_a <USDC> --token_b <XLM> \
  --liquidity <LP> --amount_a_min <USDC min> --amount_b_min <XLM min> --to privy-wallet --deadline <unix+600> \
  | $S tx simulate $M --source-account privy-wallet | psend.sh mainnet
```

### Classic AMM (Stellar's built-in pools)

Two workarounds, both in plain Python:

```python
# poolshare.py [limit]: turn a decoded change-trust tx into the XLM/<asset> pool-share trustline (fee 30)
import json, sys
d = json.load(sys.stdin); body = d["tx"]["tx"]["operations"][0]["body"]["change_trust"]
body["line"] = {"pool_share": {"liquidity_pool_constant_product": {"asset_a": "native", "asset_b": body["line"], "fee": 30}}}
if len(sys.argv) > 1: body["limit"] = sys.argv[1]
print(json.dumps(d))
```

```python
# lpid.py <hex>: Horizon's hex pool id -> the L... strkey the CLI wants
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

```bash
$S tx new change-trust $M --build-only --line USDC:GA5ZSEJ...KZVN | $S tx decode --output json \
  | python3 poolshare.py | $S tx encode | psend.sh mainnet          # 1 XLM reserve
$S tx new liquidity-pool-deposit $M --build-only --liquidity-pool-id LCSGRVA5...IQQUG \
  --max-amount-a 5000000 --max-amount-b 1000000 --min-price 47:10 --max-price 53:10 | psend.sh mainnet
$S tx new liquidity-pool-withdraw $M --build-only --liquidity-pool-id LCSGRVA5...IQQUG \
  --amount <shares in stroops> --min-amount-a <XLM min> --min-amount-b <USDC min> | psend.sh mainnet
# remove the trustline to free the reserve: same as the first line, with `poolshare.py 0`
```

The price band is XLM per USDC (asset A per asset B), about 4.99 that day.

### Resting offer on the order book

```bash
$S tx new manage-sell-offer $M --build-only --selling USDC:GA5ZSEJ...KZVN --buying native --amount 1000000 --price 10:1 | psend.sh mainnet
curl -sS https://horizon.stellar.org/accounts/<G>/offers        # offer id
$S tx new manage-sell-offer $M --build-only --selling USDC:GA5ZSEJ...KZVN --buying native --amount 0 --price 10:1 --offer-id <id> | psend.sh mainnet
```

## Gotchas Claude hit

- **`token balance` prints stroops.** Claude read 1011561 as 1.01 USDC (it's
  0.1011561), and the offer failed `Underfunded`.
- **`tx send` can time out and the transaction never lands.** Check with
  `tx fetch result --hash <h> $M`. If it isn't found, rebuild (fresh simulate,
  fresh minimums, longer deadline) and send again.
- **Summaries can hide fields.** `privy.mjs` showed only the type for liquidity
  pool ops until a fix on 2026-09-24. When a summary looks thin, check with
  `tx decode --output json` before signing.
- **Fees and reserves dominate at this size.** 14 transactions cost 0.09 XLM. Each
  trustline locks 0.5 XLM and a pool-share trustline 1 XLM, until removed.
- **Blend pools on mainnet were On Ice or Frozen** (backstop depositors queued to
  leave). Supply and withdraw worked in the On Ice Fixed pool, but that status is a
  warning sign.
- **Prices matched across venues:** DEX, Soroswap and the classic AMM were within
  about 0.5% of each other (4.98–5.0 XLM per USDC).

## Not tried

Aquarius, K2 Lend, SushiSwap V3, Upshift, Sentora, Solv, Etherfuse and Templar
exist only on mainnet, so there's no testnet rehearsal. Claude only read
Aquarius's API. The approach it would take: simulate against mainnet state with
`--send=no` and `tx simulate`, verify the contract in the registry and on
stellar.expert, then a tiny live round trip, starting with the protocols you can
exit at any time.
