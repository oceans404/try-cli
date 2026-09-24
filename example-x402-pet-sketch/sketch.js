// Pet photo -> black pen-drawing SVG for printing (napkins, cards).
//   1. An image model redraws the photo as fine black line art (OpenAI gpt-image-1).
//   2. The line art is thresholded to pure black and white.
//   3. potrace turns it into vector paths: one color (#000), transparent background.
import sharp from "sharp";
import potrace from "potrace";

export const STYLE_PROMPT = [
  "Redraw this pet as a fine black ink line-art portrait, like a hand-drawn pen illustration.",
  "Head and neck only, centered, facing the viewer as in the photo.",
  "Thin, confident pen strokes that follow the direction of the fur; detailed, expressive eyes and nose.",
  "Pure white background. No color, no gray fill, no shading blocks, no text, no border, no body, leash, or scenery.",
  "Keep the pet's real markings, ear shape, and fur texture so it is recognizably this animal.",
].join(" ");

const OPENAI_URL = "https://api.openai.com/v1/images/edits";

// Step 1: photo -> line-art PNG (buffer).
export async function drawLineArt(photo, { apiKey = process.env.OPENAI_API_KEY, model = process.env.IMAGE_MODEL || "gpt-image-1" } = {}) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  // Normalize the upload: honor EXIF rotation, cap the size, send PNG.
  const png = await sharp(photo).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", STYLE_PROMPT);
  form.append("size", "1024x1024");
  form.append("image", new Blob([png], { type: "image/png" }), "pet.png");
  const res = await fetch(OPENAI_URL, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`image model ${res.status}: ${body.error?.message || "request failed"}`);
  const b64 = body.data?.[0]?.b64_json;
  if (!b64) throw new Error("image model returned no image");
  return Buffer.from(b64, "base64");
}

// Steps 2-3: line-art raster -> single-color SVG.
export async function traceToSvg(lineArt, { threshold = 170, size = 1600 } = {}) {
  const bw = await sharp(lineArt)
    .flatten({ background: "#ffffff" })
    .resize(size, size, { fit: "inside" })
    .grayscale()
    .threshold(threshold)
    .png()
    .toBuffer();
  const svg = await new Promise((resolve, reject) =>
    potrace.trace(bw, { threshold: 128, turdSize: 4, optTolerance: 0.2, color: "#000000", background: "transparent" },
      (err, out) => (err ? reject(err) : resolve(out))));
  return svg;
}

export async function photoToSvg(photo, opts = {}) {
  return traceToSvg(await drawLineArt(photo, opts), opts);
}
