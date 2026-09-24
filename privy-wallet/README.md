# privy-wallet

A Stellar wallet whose private key lives in [Privy](https://privy.io)'s secure
enclave (TEE). The key is never in this repo, this container, or an agent's
context. The Stellar CLI builds transactions, and `privy.mjs` shows what each
one does and signs it through Privy only when you pass `--yes`.

This is the **secure / mainnet wallet**. Testnet work uses plain CLI
identities (`stellar keys generate`). Agents follow the opt-in rules in
[`../CLAUDE.md`](../CLAUDE.md#privy-mainnet-wallet-opt-in-only): they touch
`PRIVY_APP_SECRET` only when asked, and they show every mainnet transaction
before signing it.

Based on the Privy signer in
[oceans404/x402-stellar-aws-poc](https://github.com/oceans404/x402-stellar-aws-poc/blob/main/docs/privy-wallet.md).

## How it limits risk

Privy supports Stellar at Tier 2. It can create wallets and `raw_sign` a
32-byte hash, but Privy [policies](https://docs.privy.io/controls/policies/overview)
don't cover Stellar, and a raw hash hides the amount and recipient anyway.
So there are two layers:

| Layer | What it stops |
| --- | --- |
| **Privy holds the key** | Copying or leaking the key. Revoke access by rotating the App Secret. |
| **USDC allowance from your main wallet** | Spending more than you granted. The USDC contract enforces the cap on the network, whoever holds `PRIVY_APP_SECRET`. |

Your main wallet's key stays with you. You grant (and top up) the allowance
with `stellar token approve`. The Privy wallet pulls funds with `transfer_from`,
up to the cap and until it expires.

For a hard stop that doesn't rely on the agent following rules, make the
wallet owner-controlled with a Privy
[authorization key](https://docs.privy.io/controls/authorization-keys/owners/overview)
you keep. The App Secret alone then can't sign. `privy.mjs` doesn't support
that yet.

## Files

| File | What it is |
| --- | --- |
| `privy.mjs` | The tool: `create`, `address`, `sign`, `buy` |
| `wallet.json` | Written by `create`: App ID, wallet id, address. Not secret. Commit it so every session uses the same wallet. |
| `test/mock-privy.mjs` | Test stand-in for Privy's API that signs with a local key |
| `test/selftest.mjs` | Offline tests (`npm test`) |

## Setup

1. Add `PRIVY_APP_SECRET` in the cloud environment's settings (environment
   menu, **Edit**), not in a file or chat. New sessions pick it up.
2. Install and create the wallet once:

   ```bash
   cd privy-wallet
   npm install
   node privy.mjs create --app-id cmrpejbk700es0ckwpdu1hxcj
   ```

3. Register its address with the CLI so commands can name it:

   ```bash
   stellar keys add privy-wallet --public-key "$(node privy.mjs address)"
   ```

## Use

Every signing command prints a summary to stderr and stops (exit code 3)
until you re-run it with `--yes`. Use `--network testnet` or `--network mainnet`.
It's the same key and address on both. In a cloud session, use the
`testnet-relay` / `mainnet-relay` CLI networks from `../CLAUDE.md`.

**Sign anything the CLI can build.** Classic operations go straight from
`--build-only`:

```bash
stellar tx new change-trust --source privy-wallet --network testnet-relay --build-only \
  --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
  | node privy.mjs sign --network testnet --yes \
  | stellar tx send --network testnet-relay
```

Contract calls need a simulation step (`--build-only` output has no footprint):

```bash
stellar contract invoke --id <contract> --source privy-wallet --network testnet-relay --build-only -- <fn> <args> \
  | stellar tx simulate --network testnet-relay --source-account privy-wallet \
  | node privy.mjs sign --network testnet --yes \
  | stellar tx send --network testnet-relay
```

**Allowance.** The main wallet grants 1 USDC (7 decimals) for about a day
(17,280 ledgers at 5 seconds each):

```bash
stellar token approve --id <USDC SAC> --from <main wallet> --spender privy-wallet \
  --amount 10000000 --expiration-ledger <current ledger + 17280> --network testnet-relay
stellar token allowance --id <USDC SAC> --from <main wallet> --spender privy-wallet --network testnet-relay
```

The Privy wallet then pulls from it with `transfer_from`. Build this with
`contract invoke`, since `stellar token transfer-from` can't `--build-only`:

```bash
stellar contract invoke --id <USDC SAC> --source privy-wallet --network testnet-relay --build-only -- \
  transfer_from --spender privy-wallet --from <main wallet> --to privy-wallet --amount 5000000 \
  | stellar tx simulate --network testnet-relay --source-account privy-wallet \
  | node privy.mjs sign --network testnet --yes \
  | stellar tx send --network testnet-relay
```

**Pay for an x402 API.** It checks the price first and refuses anything
above `--max` (USDC, default 0.10). The facilitator pays the network fee.

```bash
NODE_USE_ENV_PROXY=1 node privy.mjs buy https://try-cli-jukj.onrender.com/fortune --network testnet --yes
```

`NODE_USE_ENV_PROXY=1` is only needed in cloud sessions. For mainnet the RPC
defaults to `https://mainnet.sorobanrpc.com/`; override with `--rpc-url`.

| Asset | Testnet | Mainnet |
| --- | --- | --- |
| USDC issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |
| USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

## Testing without Privy

`test/mock-privy.mjs` answers Privy's create and `raw_sign` calls with a local
key, so the whole flow runs without the App Secret:

```bash
npm test   # offline: create, the --yes gate, signatures, network binding
```

The same mock ran the full flow against testnet with a throwaway key
standing in for Privy (2026-09-24):

| Step | Transaction |
| --- | --- |
| USDC trustline, signed by `privy.mjs` | [33dab514…](https://stellar.expert/explorer/testnet/tx/33dab51478980982316bea3e7c82c049974379dca90f81c9bafc23c1eae7a9e0) |
| Main wallet approves 1 USDC | [5987978f…](https://stellar.expert/explorer/testnet/tx/5987978f2c53e842e7cc6bf1e567f5cabddb6d5bb7fe10461553f3424ba9ed53) |
| `transfer_from` 0.5 USDC | [e338dc09…](https://stellar.expert/explorer/testnet/tx/e338dc093af6b35ec2c5ff5b21859ec312281d6fbbed6ce44aab0efc9573ff0d) |
| `transfer_from` 0.6 more | rejected in simulation: `Error(Contract, #9)`, insufficient allowance |
| x402 fortune, 0.01 USDC | [85f9069d…](https://stellar.expert/explorer/testnet/tx/85f9069d9c5ac3aa114af514777ee67b60d84c076f9de0078550316ddb95ae06) |

What the mock can't prove is Privy's side: that `raw_sign` accepts the
request and returns a signature for the wallet's address. `privy.mjs` checks
every signature against the address before using it.

## Status and next steps (2026-09-24)

Everything above ran against the mock. Still to do, in a session that has
`PRIVY_APP_SECRET` and the user's go-ahead to use it:

1. Start the testnet relay and `testnet-relay` network (`../CLAUDE.md`), then
   `npm install` here.
2. Check the secret without printing it: `[ -n "$PRIVY_APP_SECRET" ] && echo set`.
3. `node privy.mjs create --app-id cmrpejbk700es0ckwpdu1hxcj`, then commit
   `wallet.json` so later sessions reuse the wallet instead of making another.
4. Repeat the testnet dry run with the real wallet: fund it with friendbot
   (`stellar keys add privy-wallet --public-key ...`, then `stellar keys fund`),
   add the trustline, have a testnet "main wallet" grant an allowance, pull
   with `transfer_from`, then `buy` the fortune. The CLI identities from the
   first dry run (`my-wallet` etc.) lived in an earlier container and are gone,
   so make a new main wallet with testnet USDC (trustline, then a
   `path-payment-strict-receive` swap from XLM).
5. Only then talk to the user about mainnet: funding, and the allowance from
   their real main wallet, which they sign themselves.

## Gotcha

stellar-sdk 17 returns `Uint8Array`s (from `tx.hash()`, `Keypair.sign()`) and
decodes XDR into plain objects. `.toString("hex")` on a `Uint8Array` gives a
comma list, not hex, so wrap it in `Buffer.from()` first.
