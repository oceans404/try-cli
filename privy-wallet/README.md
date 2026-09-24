# privy-wallet

The secure/mainnet Stellar wallet. Its key lives in Privy and never reaches
this repo, the container, or an agent. The Stellar CLI builds transactions;
`privy.mjs` shows what each one does and signs through Privy only with `--yes`.

Agents use it only when the user asks (see `../CLAUDE.md`). Testnet work uses
plain CLI identities.

**Spending cap:** Privy can't enforce limits on Stellar. So the main wallet
grants this wallet a USDC allowance (`stellar token approve`), and the USDC
contract enforces it on-chain.

## Setup

`PRIVY_APP_SECRET` comes from the cloud environment's settings; new sessions
pick it up.

```bash
cd privy-wallet && npm install
NODE_USE_ENV_PROXY=1 node privy.mjs create --app-id cmrpejbk700es0ckwpdu1hxcj   # done (wallet.json)
stellar keys add privy-wallet --public-key "$(node privy.mjs address)"
```

`wallet.json` holds the wallet id and address (not secret). Commit it, or the
next session creates a second wallet.

## Use

Each command prints a summary and stops until re-run with `--yes`. Pass
`--network testnet` or `--network mainnet`; the address is the same on both.
In cloud sessions use the `testnet-relay` / `mainnet-relay` CLI networks.

```bash
# Classic operation
stellar tx new change-trust --source privy-wallet --network testnet-relay --build-only \
  --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
  | node privy.mjs sign --network testnet --yes | stellar tx send --network testnet-relay

# Contract call (needs simulating first), e.g. pulling from the allowance
stellar contract invoke --id <USDC SAC> --source privy-wallet --network testnet-relay --build-only -- \
  transfer_from --spender privy-wallet --from <main wallet> --to privy-wallet --amount 5000000 \
  | stellar tx simulate --network testnet-relay --source-account privy-wallet \
  | node privy.mjs sign --network testnet --yes | stellar tx send --network testnet-relay

# Allowance, granted by the main wallet: 1 USDC for ~1 day
stellar token approve --id <USDC SAC> --from <main wallet> --spender privy-wallet \
  --amount 10000000 --expiration-ledger <current ledger + 17280> --network testnet-relay

# Pay an x402 API (refuses prices above --max USDC, default 0.10)
NODE_USE_ENV_PROXY=1 node privy.mjs buy https://try-cli-jukj.onrender.com/fortune --network testnet --yes
```

| USDC | Testnet | Mainnet |
| --- | --- | --- |
| Issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

## Testing

`npm test` runs offline against `test/mock-privy.mjs`, which stands in for
Privy with a local key. The same mock ran the full flow on testnet
(trustline, allowance, `transfer_from`, over-cap rejection, x402 payment).

## Next steps

The wallet exists: `GDCSXONEADAR56IFW6SU3LPG4ILIR5CDVQ2ALTB3JCAGFMLVFWIJEBOM`
(Privy id `nba78jsed38y19957h3j0e63`, no owner, so the app secret alone
controls it). It holds 10,000 testnet XLM from friendbot. Don't run `create`
again.

The testnet flow and a first round of small mainnet DeFi (DEX, Soroswap swap and
LP, Blend supply, classic AMM, order book) ran on 2026-09-24 with the real Privy.
Every transaction and what was learned is in [LOG.md](LOG.md).

Next, with `PRIVY_APP_SECRET` and the user's OK:

1. Before holding real value, consider a Privy owner or authorization key on the
   wallet: today the app secret alone controls it.
2. Discuss the mainnet allowance setup with the user. They sign it themselves.
