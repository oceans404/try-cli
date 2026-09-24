# example-x402-seller

**Live on testnet:** https://try-cli-jukj.onrender.com/fortune
(listed on Rail402 as ["Stellar Fortunes"](https://explorer.rail402.dev/testnet/address/GBCKZHYGFWRS77UVZCOGTST55OL3HHXDSAYZRKPNBQGO5DXHSCBGRL7B))

A minimal paid API on Stellar using [x402](https://www.x402.org/).
`GET /fortune` returns a fortune-cookie fortune with six lucky numbers for
$0.01 in USDC. Unpaid requests get HTTP 402 with the payment terms; a
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
| `fortunes.js` | The fortunes (20 per topic) and the lucky-number picker |
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
STELLAR_SECRET="$(stellar keys secret buyer)" npm run buy -- "http://localhost:3001/fortune?topic=luck"
```

```text
status: 200
payment-response: { success: true, payer: 'G…', transaction: '<HASH>', network: 'stellar:testnet' }
body: {"fortune":"A pleasant surprise is waiting for you.","topic":"luck","luckyNumbers":[3,12,19,27,34,41]}
```

`topic` is optional (`wisdom`, `luck`, `love`, `work`, or `adventure`); the
100 fortunes live in `fortunes.js`. Each run pays again.
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

A route is listed in Rail402's [Bazaar](https://explorer.rail402.dev/testnet/sellers?registered=true)
automatically once a payment for it settles through Rail402's facilitator. No
sign-up. The listing is owned by the `payTo` and only updates on a settled
payment.

The route needs:

- `FACILITATOR_URL=https://facilitator.rail402.dev` on `stellar:testnet`
- `registerExtension(bazaarResourceServerExtension)` on the resource server
- `serviceName` (the explorer won't show the route without it), `tags`,
  `description`, `mimeType`, and `maxTimeoutSeconds`
- `extensions: describeEndpoint({ params, outputExample })`
- a public `https://` URL (behind a proxy, `app.set("trust proxy", true)`)
- a funded `payTo` with a trustline for the payment asset

Then:

1. Deploy, and check the live 402 shows an `https://` URL, your
   `serviceName`, and your `payTo`.
2. Pay the plain route URL (no query string) from an account other than
   `payTo`:
   `STELLAR_SECRET="$(stellar keys secret buyer)" npm run buy -- https://<your-host>/<route>`
3. Confirm: `curl -s "https://facilitator.rail402.dev/discovery/resources?payTo=<G_ADDRESS>"`

After changing any metadata, redeploy and pay once more to update the listing.
Details: Rail402's [Get discovered](https://docs.rail402.dev/sellers/get-discovered).

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
