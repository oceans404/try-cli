# example-x402-hello

**Proof of concept: USDT0 works for x402 payments on Stellar mainnet.**

On 2026-09-29 a buyer paid 0.001 USDT0 for `GET /hello` and got
`{"message":"hello world mainnet"}` back, settled on mainnet by the
[Built on Stellar](https://developers.stellar.org/docs/build/agentic-payments/x402/built-on-stellar)
facilitator:
[0b4036ac… on stellar.expert](https://stellar.expert/explorer/public/tx/0b4036ac85456a841d1909c20afb53bd1204fec5a898018246314cd2218a6b66).

The service sells a fixed `hello world <network>` message for 0.001 per call:

| Network | Accepts | Facilitator |
| --- | --- | --- |
| testnet (`stellar:testnet`) | USDC | `https://channels.openzeppelin.com/x402/testnet` |
| mainnet (`stellar:pubnet`) | USDC or USDT0 (the buyer picks) | `https://channels.openzeppelin.com/x402` |

Receipts: [USDT0 on mainnet](https://stellar.expert/explorer/public/tx/0b4036ac85456a841d1909c20afb53bd1204fec5a898018246314cd2218a6b66),
[USDC on mainnet](https://stellar.expert/explorer/public/tx/b75e3bdaabc9eba9f8ea94afe30cdc098f302728bb291515f5d32034f1b9ff1e),
[USDC on testnet](https://stellar.expert/explorer/testnet/tx/71403e939255ed4be90953561f6b0f409d3d9deb070cefd9cdca4c0ac9558019)
(0.01, before the price dropped to 0.001).

| File | What it is |
| --- | --- |
| `server.js` | Express + `@x402/express` gating `GET /hello`; `STELLAR_NETWORK` picks the network, facilitator, key, and assets |
| `buy.mjs` | A buyer: `node buy.mjs [url] [USDC\|USDT0]` |
| `.env.example` | Settings to copy into `.env` |

## Assets

| | Testnet | Mainnet |
| --- | --- | --- |
| USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| USDT0 SAC | none | `CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF` (`USDT0:GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q`, [docs](https://developers.stellar.org/launch/usdt0)) |

Both have 7 decimals, so `10000` is 0.001. The mainnet IDs were checked
on-chain (`stellar contract id asset`, `token symbol`, `token decimals`).

## Run it

Get a Built on Stellar API key per network
([testnet](https://channels.openzeppelin.com/testnet/gen), no login;
[mainnet](https://channels.openzeppelin.com/gen), GitHub login).

```bash
npm install
cp .env.example .env   # set the key(s) and STELLAR_RECIPIENT
npm start                                   # testnet on :3004
STELLAR_NETWORK=stellar:pubnet PORT=3005 npm start   # mainnet on :3005
```

`STELLAR_RECIPIENT` must hold a trustline for every asset it accepts (USDC,
and USDT0 on mainnet), or settlement fails with `op_no_trust`.

Buy (testnet shown; for mainnet set `STELLAR_NETWORK=stellar:pubnet` and use
a mainnet key only in a wallet you control, never a plaintext key on a shared
machine):

```bash
STELLAR_SECRET="$(stellar keys secret buyer)" node buy.mjs http://localhost:3004/hello USDC
```

## Paying with anything other than USDC

Two things are needed beyond a USDC setup.

**Buyers:** the x402 client (`@x402/core`) only pays each network's default
asset (USDC on Stellar), capped at $1 per payment. Other tokens are dropped
before signing unless allow-listed:

```js
wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [...],
  spendControls: {
    allowedAssets: [{ network: "stellar:pubnet", asset: "CBSJZEIO…R26YF", maxAmountPerPayment: "10000" }],
  },
});
```

`maxAmountPerPayment` is in atomic units. `buy.mjs` does this for the asset
you pass.

**Sellers:** price in explicit units (`price: { amount, asset }`), since
`"$0.001"` assumes USDC. The facilitator must also allow the asset. Built on
Stellar keeps a per-network asset allowlist in its deployment config and
rejects other tokens at `/verify` with `unsupported_asset`. USDT0 was added to
its mainnet allowlist on 2026-09-29; before that, the same USDT0 payment was
rejected. Check any other facilitator the same way before relying on it.

## Notes

- The API keys for both networks live only in `.env` (git-ignored). On a host
  like Render, set them as environment variables.
- In Claude Code cloud sessions, run `node` with `NODE_USE_ENV_PROXY=1`, or
  requests to the facilitator are rejected with 403.
- Keep every `@x402/*` package on the same version; they're pinned to match.
