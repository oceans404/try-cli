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

## Hosting on Render

Create a **Web Service** on [Render](https://render.com) from this repository.
Render builds from the branch you pick, so push your changes first.

| Setting | Value |
| --- | --- |
| Language | **Node** (the form may default to Python 3) |
| Branch | the branch with your changes, e.g. `main` |
| Root Directory | `example-x402-seller` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** is enough for a demo (the form may preselect a paid one) |

Environment variables:

| Key | Value |
| --- | --- |
| `STELLAR_NETWORK` | `stellar:testnet` |
| `FACILITATOR_URL` | `https://facilitator.rail402.dev` (or the OZ Channels URL) |
| `STELLAR_RECIPIENT` | your `payTo` address (see below) |
| `OZ_API_KEY` | only for OZ Channels |

Don't set `PORT`; Render provides it and `server.js` reads it. Free instances
sleep when idle, so the first request after a pause can take a minute.
Changing an environment variable redeploys the service.

### The recipient (`payTo`)

- **Use an identity you keep.** Whoever holds its secret key controls the
  earnings and owns the Rail402 listing. Don't use a throwaway key from a
  temporary machine or session.
- **It must exist onchain.** A key from `stellar keys generate` without
  `--fund` is not an account yet. Fund it with
  `stellar keys fund <NAME> --network testnet`, or friendbot:
  `curl "https://friendbot.stellar.org/?addr=<G_ADDRESS>"`.
- **It needs a USDC trustline,** signed by its own key:
  `stellar tx new change-trust --source <NAME> --network testnet --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

Check both before anyone pays. The output should show `USDC` from issuer
`GBBD47IF…`:

```bash
curl -s https://horizon-testnet.stellar.org/accounts/<G_ADDRESS> | grep -E '"asset_(code|issuer)"'
```

A `404` means the account isn't funded yet.

### Check the deployed service

```bash
curl -s -D - -o /dev/null https://<your-service>.onrender.com/fortune \
  | grep -i '^payment-required:' | sed 's/^[^:]*: //' | tr -d '\r' | base64 -d
```

Expect HTTP 402 with your address as `payTo`, `areFeesSponsored: true`, and a
`resource.url` that starts with **`https://`**. Render terminates TLS at its
proxy, so `server.js` sets `app.set("trust proxy", true)`; without it the
challenge advertises `http://`, and that's the URL a Bazaar listing would
record.

## Listing on Rail402

With the Rail402 facilitator, the route's discovery metadata (`serviceName`,
`tags`, `description`, and the `describeEndpoint` parameters in `server.js`)
is cataloged
automatically when a payment settles. There is no registration step. The
listing is owned by the `payTo` that got paid, and it ranks higher with more
distinct buyers; paying yourself adds no ranking. See Rail402's
[Get discovered](https://docs.rail402.dev/sellers/get-discovered).

Before the first payment:

1. **Deploy to a public URL.** The catalog records the URL the buyer paid, so
   paying `http://localhost:3001` publishes a dead listing.
2. **Check the challenge** as above: `https://` resource URL, your `payTo`.
3. **Pay the plain route** (`/fortune`, no `?topic=`). The resource URL is
   built from the full request URL, query string included.
4. **Buy from a different account** than the recipient.
5. **Set `serviceName` and `tags`** on the route. They're the highest-weighted
   fields in Rail402's search, and every service on the explorer's registered
   list has a `serviceName`. The catalog only picks up metadata changes when a
   payment settles, so after changing them, redeploy and make one more paid
   call to refresh the listing.

```bash
STELLAR_SECRET="$(stellar keys secret buyer)" npm run buy -- https://<your-service>.onrender.com/fortune
```

Then confirm the listing:

```bash
curl -s "https://facilitator.rail402.dev/discovery/resources?payTo=<YOUR_G_ADDRESS>"
```

It should also appear in the explorer's
[registered sellers](https://explorer.rail402.dev/testnet/sellers?registered=true).

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
