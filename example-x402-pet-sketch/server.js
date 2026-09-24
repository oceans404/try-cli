// Pet photo -> pen-drawn SVG, sold for $0.25 USDC over x402 on Stellar.
// POST /sketch with JSON {"image": "<base64 or data URL>"} returns image/svg+xml.
// PAYWALL=off serves it free (plus a browser demo at /) for testing.
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { describeEndpoint } from "@rail402.dev/sdk";
import { photoToSvg } from "./sketch.js";
import { mountDashboard } from "./dashboard.js";

const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://facilitator.rail402.dev";
const PORT = Number(process.env.PORT || 3002);
const PAYWALL = process.env.PAYWALL !== "off";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PRICE_UNITS = "2500000"; // $0.25 at 7 decimals; keep in sync with price below
const USDC_SAC = {
  "stellar:testnet": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  "stellar:pubnet": "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
}[NETWORK];

const isOZ = FACILITATOR_URL.includes("channels.openzeppelin.com");
const required = ["OPENAI_API_KEY", ...(PAYWALL ? ["STELLAR_RECIPIENT"] : []), ...(PAYWALL && isOZ ? ["OZ_API_KEY"] : [])];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required (see .env.example)`);
}

const app = express();
app.set("trust proxy", true); // https:// resource URLs behind Render's TLS proxy

if (PAYWALL) {
  const facilitator = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
    ...(isOZ && {
      createAuthHeaders: async () => {
        const h = { Authorization: `Bearer ${process.env.OZ_API_KEY}` };
        return { verify: h, settle: h, supported: h };
      },
    }),
  });
  const resourceServer = new x402ResourceServer(facilitator)
    .register(NETWORK, new ExactStellarScheme())
    .registerExtension(bazaarResourceServerExtension);

  app.use(
    paymentMiddleware(
      {
        "POST /sketch": {
          accepts: {
            scheme: "exact",
            price: "$0.25",
            network: NETWORK,
            payTo: process.env.STELLAR_RECIPIENT,
            // Generation takes 30-60s and settlement happens after the response,
            // so give the signed authorization room to stay valid.
            maxTimeoutSeconds: 300,
          },
          serviceName: "Pet Pen Portraits",
          tags: ["pet-portrait", "line-art", "svg", "dog", "cat", "wedding", "print"],
          description:
            "Turns a photo of a dog, cat, or other pet into a black pen-drawn line-art portrait of its head, as a print-ready single-color SVG (for wedding napkins, cards, and invitations).",
          mimeType: "image/svg+xml",
          extensions: describeEndpoint({
            bodyType: "json",
            params: {
              image: {
                description: "The pet photo as base64, or a data URL (data:image/jpeg;base64,...). JPEG, PNG, or WebP, up to 10 MB. One pet, face visible.",
                type: "string",
                required: true,
                example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
              },
            },
            // The Bazaar schema wants an object; the actual response body is the raw SVG.
            outputExample: {
              contentType: "image/svg+xml",
              body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600"><path fill="#000000" d="M..."/></svg>',
            },
          }),
        },
      },
      resourceServer,
    ),
  );
} else {
  console.warn("PAYWALL=off: /sketch is free and the demo page is enabled");
  app.get("/", (_req, res) => res.type("html").send(DEMO_PAGE));
}

app.post("/sketch", express.json({ limit: "15mb" }), async (req, res) => {
  const raw = typeof req.body?.image === "string" ? req.body.image.replace(/^data:[^,]*,/, "") : "";
  const photo = Buffer.from(raw, "base64");
  if (!photo.length) return res.status(400).json({ error: "Send JSON {\"image\": \"<base64 or data URL>\"}" });
  if (photo.length > MAX_IMAGE_BYTES) return res.status(413).json({ error: "Image is larger than 10 MB" });
  try {
    const started = Date.now();
    const svg = await photoToSvg(photo);
    console.log(`sketch: ${photo.length} bytes in, ${svg.length} bytes out, ${Date.now() - started} ms`);
    res.type("image/svg+xml").send(svg);
  } catch (err) {
    // A failed response is not settled, so the buyer isn't charged.
    console.error("sketch failed:", err.message);
    res.status(502).json({ error: "Could not draw this photo. You were not charged." });
  }
});

// Public sales dashboard (on-chain data, no secrets).
if (process.env.STELLAR_RECIPIENT) {
  mountDashboard(app, { payTo: process.env.STELLAR_RECIPIENT, priceUnits: PRICE_UNITS, asset: USDC_SAC, network: NETWORK });
}

app.get("/health", (_req, res) => res.json({ ok: true, paywall: PAYWALL, network: NETWORK }));

app.listen(PORT, () =>
  console.log(`pet sketch on http://localhost:${PORT} (${PAYWALL ? `${NETWORK}, facilitator ${FACILITATOR_URL}` : "PAYWALL=off"})`));

const DEMO_PAGE = `<!doctype html><meta charset="utf-8"><title>Pet Pen Portraits (demo)</title>
<style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:0 16px}#out svg{max-width:100%;height:auto;border:1px solid #ddd}</style>
<h1>Pet Pen Portraits (demo, free)</h1>
<p>Pick a pet photo. Drawing takes 30 to 60 seconds.</p>
<input type="file" id="f" accept="image/*"> <a id="dl" download="pet-portrait.svg" hidden>Download SVG</a>
<p id="s"></p><div id="out"></div>
<script>
f.onchange = async () => {
  const file = f.files[0]; if (!file) return;
  s.textContent = "Drawing..."; out.innerHTML = ""; dl.hidden = true;
  const image = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
  const res = await fetch("/sketch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image }) });
  if (!res.ok) { s.textContent = (await res.json()).error; return; }
  const svg = await res.text();
  out.innerHTML = svg; s.textContent = "Done.";
  dl.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); dl.hidden = false;
};
</script>`;
