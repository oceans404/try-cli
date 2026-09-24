# example-x402-seller

A minimal paid API on Stellar using [x402](https://www.x402.org/).
`GET /fortune` returns a one-line tip about Stellar, x402, or the Stellar CLI
for $0.01 in USDC. Unpaid requests get HTTP 402 with the payment terms; a
facilitator verifies and settles each payment onchain and sponsors the network
fee, so buyers need USDC but no XLM.

Pick the facilitator in `.env`:

| Facilitator | Networks | API key | Listed in a marketplace |
| --- | --- | --- | --- |
| [OZ Channels](https://channels.openzeppelin.com) (default) | testnet, mainnet | required | no |
| [Rail402](https://docs.rail402.dev) | testnet | none | yes, the [Rail402 Bazaar](https://explorer.rail402.dev/testnet/sellers?registered=true) |

Based on the Agentic Payments skill's
[x402 guide](https://skills.stellar.org/skills/agentic-payments/x402.md) and
Rail402's [seller quickstart](https://docs.rail402.dev/sellers/quickstart).

## Files

| File | What it is |
| --- | --- |
| `server.js` | The seller: Express + `@x402/express` gating `GET /fortune` |
| `buy.mjs` | A buyer: `@x402/fetch` pays any Stellar x402 URL and prints the result |
| `.env.example` | Settings to copy into `.env` |

## Setup (testnet)

You need Node 20+, the [Stellar CLI](https://developers.stellar.org/docs/tools/cli),
and two identities: one to receive payments, one to buy with.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a recipient and give it a USDC trustline. `payTo` must hold a
   trustline or settlement fails with `op_no_trust`.

   ```bash
   stellar keys generate seller --network testnet --fund
   stellar tx new change-trust --source seller --network testnet \
     --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
   ```

3. Create `.env` and set `STELLAR_RECIPIENT` (`stellar keys address seller`):

   ```bash
   cp .env.example .env
   ```

   Then choose a facilitator:

   - **OZ Channels:** keep the default `FACILITATOR_URL` and set `OZ_API_KEY`.
     Get a free testnet key with `curl -s https://channels.openzeppelin.com/testnet/gen`
     (each request creates a new key).
   - **Rail402:** set `FACILITATOR_URL=https://facilitator.rail402.dev` and
     leave `OZ_API_KEY` empty. See [Listing on Rail402](#listing-on-rail402)
     before the first payment.

   `.env` is git-ignored. Never commit it.

4. Start the seller:

   ```bash
   npm start
   # x402 seller on http://localhost:3001 (stellar:testnet, facilitator …)
   ```

## Try it

Check the terms without paying:

```bash
curl -s -D - -o /dev/null http://localhost:3001/fortune \
  | grep -i '^payment-required:' | sed 's/^[^:]*: //' | tr -d '\r' | base64 -d
```

Buy one with a funded identity that holds testnet USDC (a trustline, then swap
XLM for USDC on the DEX with `stellar tx new path-payment-strict-send`):

```bash
STELLAR_SECRET="$(stellar keys secret buyer)" npm run buy -- "http://localhost:3001/fortune?topic=x402"
```

```text
status: 200
payment-response: { success: true, payer: 'G…', transaction: '<HASH>', network: 'stellar:testnet' }
body: {"fortune":"Read the challenge before you pay it.","topic":"x402","network":"stellar:testnet"}
```

`topic` is optional (`stellar`, `x402`, or `cli`). Each run pays again.
`buy.mjs` works on any Stellar x402 endpoint, not just this one.

Verify on stellar.expert at `https://stellar.expert/explorer/testnet/tx/<HASH>`,
or from the CLI:

```bash
stellar tx fetch events --hash <HASH> --network testnet
```

The USDC `transfer` event should name the buyer, your `payTo`, and `100000`
(0.01 USDC at 7 decimals).

## Listing on Rail402

With the Rail402 facilitator, the route's discovery metadata (the description
and the `describeEndpoint` parameters in `server.js`) is cataloged
automatically when a payment settles. There is no registration step. The
listing is owned by the `payTo` that got paid, and it ranks higher with more
distinct buyers; paying yourself adds no ranking. See Rail402's
[Get discovered](https://docs.rail402.dev/sellers/get-discovered).

**Deploy to a public URL before the first payment.** The catalog records the
URL the buyer paid. A payment against `http://localhost:3001` publishes a dead
localhost listing.

Once a payment settles, confirm the listing:

```bash
curl -s "https://facilitator.rail402.dev/discovery/resources?payTo=<YOUR_G_ADDRESS>"
```

## Hosting on Render

Create a **Web Service** on [Render](https://render.com) from this repository:

| Setting | Value |
| --- | --- |
| Root Directory | `example-x402-seller` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Environment variables | `STELLAR_NETWORK`, `STELLAR_RECIPIENT`, `FACILITATOR_URL`, and `OZ_API_KEY` for OZ Channels |

Don't set `PORT`; Render provides it and `server.js` reads it. Render's free
instances sleep when idle, so the first request after a pause is slow.

Then check the public 402 and buy from the public URL:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<your-service>.onrender.com/fortune   # 402
STELLAR_SECRET="$(stellar keys secret buyer)" npm run buy -- https://<your-service>.onrender.com/fortune
```

## Going to mainnet

Mainnet uses OZ Channels (Rail402 is testnet only). Change only the
environment:

| Setting | Mainnet value |
| --- | --- |
| `STELLAR_NETWORK` | `stellar:pubnet` |
| `FACILITATOR_URL` | `https://channels.openzeppelin.com/x402` |
| `OZ_API_KEY` | a mainnet key from https://channels.openzeppelin.com/gen |
| `STELLAR_RECIPIENT` | a mainnet account with a USDC trustline |

For `buy.mjs`, set `STELLAR_NETWORK=stellar:pubnet`. On mainnet that spends
real USDC, so test on testnet first.

## Notes

- Change the price, route, or response in `server.js`. Prices like `"$0.01"`
  convert to 7-decimal USDC units (Stellar USDC has 7 decimals, not 6).
- Keep every `@x402/*` package on the same version; they're pinned to match.
- The facilitator sees each payment before the network does. Choosing one is a
  trust decision.
- In Claude Code cloud sessions, run `node` with `NODE_USE_ENV_PROXY=1`, or
  outbound requests (to the facilitator and RPC) are rejected with 403.
