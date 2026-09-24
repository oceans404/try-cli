// Try the pipeline without the server or payments.
// Usage: npm run sketch -- <photo> [out.svg]   (also writes <out>.lineart.png)
import "dotenv/config";
import fs from "node:fs";
import { drawLineArt, traceToSvg } from "./sketch.js";

const [photoPath, outPath = photoPath.replace(/\.[^.]+$/, "") + ".svg"] = process.argv.slice(2);
if (!photoPath) throw new Error("usage: npm run sketch -- <photo> [out.svg]");

const t0 = Date.now();
const lineArt = await drawLineArt(fs.readFileSync(photoPath));
fs.writeFileSync(outPath.replace(/\.svg$/, "") + ".lineart.png", lineArt);
const t1 = Date.now();
const svg = await traceToSvg(lineArt);
fs.writeFileSync(outPath, svg);
console.log(`${outPath}: ${svg.length} bytes (draw ${t1 - t0} ms, trace ${Date.now() - t1} ms)`);
