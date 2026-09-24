# example-x402-pet-sketch

**Pet Pen Portraits:** send a photo of a dog, cat, or any pet and get back a
black pen-drawn portrait of its head as a print-ready SVG, for wedding napkins,
cards, and invitations. $0.25 in USDC per sketch over
[x402](https://www.x402.org/) on Stellar.

`POST /sketch` with JSON `{"image": "<base64 or data URL>"}` returns
`image/svg+xml`: one color (`#000000`), transparent background, vector paths.

## How it works

1. **Draw:** OpenAI `gpt-image-1` (image edit) redraws the photo as fine ink
   line art: head and neck only, white background, no scenery. The prompt is
   `STYLE_PROMPT` in `sketch.js`.
2. **Trace:** the line art is thresholded to pure black and white, and
   [potrace](https://www.npmjs.com/package/potrace) turns it into vector paths.

A sketch takes 20 to 60 seconds. Each run is a fresh drawing, so results vary.
The payment settles only after the SVG is returned, so a failed drawing
isn't charged. The authorization is valid for 300 seconds to cover the wait.

| File | What it is |
| --- | --- |
| `sketch.js` | The pipeline: `drawLineArt` (image model) and `traceToSvg` (potrace) |
| `server.js` | Express + `@x402/express` gating `POST /sketch` at $0.25 |
| `cli.js` | `npm run sketch -- <photo>`: run the pipeline without the server |
| `buy.mjs` | A buyer: uploads a photo, pays over x402, saves the SVG |

## Setup

Node 20+ and an OpenAI API key with image access.

```bash
npm install
cp .env.example .env   # set OPENAI_API_KEY
```

### 1. Try the pipeline

```bash
npm run sketch -- photo.jpg        # writes photo.svg and photo.lineart.png
```

### 2. Free demo server

With `PAYWALL=off` (the `.env.example` default), `/sketch` is free and `/` is
an upload page with a download button:

```bash
npm start   # open http://localhost:3002
```

### 3. Charge for it

Remove `PAYWALL=off` and set `STELLAR_RECIPIENT` (funded, with a USDC
trustline). For a paid test on your machine, use OZ Channels (`FACILITATOR_URL`
and `OZ_API_KEY`, see `.env.example`); Rail402 would publish a `localhost`
listing.

```bash
npm start
STELLAR_SECRET="$(stellar keys secret buyer)" node buy.mjs photo.jpg http://localhost:3002/sketch out.svg
```

The buyer needs 0.25 testnet USDC and no XLM.

## Hosting and listing

Deploy and list it exactly like [example-x402-seller](../example-x402-seller/README.md)
(Hosting on Render, Listing on Rail402), with:

- Root Directory `example-x402-pet-sketch`
- `OPENAI_API_KEY` in the host's environment variables, never in the repo
- `FACILITATOR_URL=https://facilitator.rail402.dev` and your `STELLAR_RECIPIENT`
- the first paid call made against the public `https://` URL

## Notes

- Price vs. cost: OpenAI bills each drawing to your key. Check current
  `gpt-image-1` pricing against the $0.25 price, set in `server.js`.
- In Claude Code cloud sessions, run `node` with `NODE_USE_ENV_PROXY=1`, or
  requests to OpenAI and the facilitator are rejected with 403.
- Keep every `@x402/*` package on the same version; they're pinned to match.
