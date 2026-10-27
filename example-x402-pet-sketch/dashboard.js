// Seller dashboard: sketches sold and revenue, refreshed every few seconds.
// Data comes straight from the chain through Horizon: every USDC payment to
// STELLAR_RECIPIENT, whichever facilitator settled it (Rail402, OZ Channels,
// x402.org) and back to the account's creation. An x402 payment is a Soroban
// USDC transfer, which Horizon lists as an invoke_host_function operation with
// asset_balance_changes. Payments are labeled by recipient, not by route, so
// sales are the payments of exactly the sketch price in USDC.
const HORIZON = {
  "stellar:testnet": "https://horizon-testnet.stellar.org",
  "stellar:pubnet": "https://horizon.stellar.org",
};
// USDC's issuer for each network's USDC contract (Horizon names the classic asset).
const USDC_ISSUER = {
  CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};
const MAX_PAGES = 25; // 200 operations per page
const CACHE_MS = 10_000; // every viewer polls every 5 s; Horizon rate-limits per IP

// "0.2500000" -> 2500000n
const toUnits = (amount) => {
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(frac.padEnd(7, "0").slice(0, 7));
};

// Every incoming payment of `issuer`'s USDC to `payTo`, newest first.
async function usdcPaymentsTo(payTo, issuer, network) {
  const payments = [];
  let url = `${process.env.HORIZON_URL || HORIZON[network]}/accounts/${payTo}/payments?order=desc&limit=200&include_failed=false`;
  for (let page = 0; page < MAX_PAGES && url; page++) {
    const r = await fetch(url);
    if (r.status === 404) return payments; // account not created yet
    if (!r.ok) throw new Error(`horizon ${r.status}`);
    const records = (await r.json())._embedded.records;
    for (const op of records) {
      const changes =
        op.type === "invoke_host_function"
          ? (op.asset_balance_changes || []).filter((c) => c.type === "transfer")
          : op.type.startsWith("payment") || op.type.startsWith("path_payment")
            ? [{ from: op.from, to: op.to, amount: op.amount, asset_code: op.asset_code, asset_issuer: op.asset_issuer }]
            : [];
      for (const c of changes) {
        if (c.to === payTo && c.asset_code === "USDC" && c.asset_issuer === issuer) {
          payments.push({ tx: op.transaction_hash, buyer: c.from, units: toUnits(c.amount), at: op.created_at });
        }
      }
    }
    url = records.length === 200 ? `${url.split("?")[0]}?order=desc&limit=200&include_failed=false&cursor=${records.at(-1).paging_token}` : null;
  }
  return payments;
}

export function mountDashboard(app, { payTo, priceUnits, asset, network }) {
  const expert = `https://stellar.expert/explorer/${network === "stellar:pubnet" ? "public" : "testnet"}`;
  const issuer = USDC_ISSUER[asset];
  const price = BigInt(priceUnits);
  let cache = { at: 0, body: null };

  app.get("/dashboard/data", async (_req, res) => {
    try {
      if (!cache.body || Date.now() - cache.at > CACHE_MS) {
        const sales = (await usdcPaymentsTo(payTo, issuer, network))
          .filter((p) => p.units === price)
          .map((p) => ({ tx: p.tx, buyer: p.buyer, usdc: (Number(p.units) / 1e7).toFixed(2), at: p.at, link: `${expert}/tx/${p.tx}` }));
        cache = {
          at: Date.now(),
          body: {
            payTo,
            count: sales.length,
            revenueUsdc: (Number(price * BigInt(sales.length)) / 1e7).toFixed(2),
            buyers: new Set(sales.map((s) => s.buyer)).size,
            sales,
            updatedAt: new Date().toISOString(),
          },
        };
      }
      res.json(cache.body);
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  app.get("/dashboard", (_req, res) => res.type("html").send(PAGE));
}

const PAGE = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pet Pen Portraits · Sales</title>
<style>
:root{--bg:#faf9f7;--card:#fff;--ink:#1a1a1a;--mut:#6b6b6b;--line:#e6e3de;--acc:#1f7a4d;--new:#eaf6ef}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--card:#1d1d1d;--ink:#f1f1f1;--mut:#a0a0a0;--line:#2e2e2e;--acc:#4fc58a;--new:#16301f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:960px;margin:0 auto;padding:32px 16px}
h1{font-size:22px;margin:0}.sub{color:var(--mut);margin:4px 0 24px;font-size:13px;word-break:break-all}
.live{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--acc);margin-right:6px;animation:p 2s infinite}
@keyframes p{50%{opacity:.3}}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
.tile b{display:block;font-size:32px;font-variant-numeric:tabular-nums}.tile span{color:var(--mut);font-size:13px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);font-size:14px}th{color:var(--mut);font-weight:500}
td.mono{font-family:ui-monospace,monospace;font-size:13px}tr.new{background:var(--new);transition:background 3s}
a{color:var(--acc)}.wrap{overflow-x:auto}#err{color:#c0392b}
</style>
<main>
<h1><span class="live"></span>Pet Pen Portraits · Sales</h1>
<p class="sub" id="sub">Loading…</p>
<div class="tiles">
  <div class="tile"><span>Sketches sold</span><b id="count">–</b></div>
  <div class="tile"><span>Total revenue</span><b id="rev">–</b></div>
  <div class="tile"><span>Unique buyers</span><b id="buyers">–</b></div>
</div>
<p id="err"></p>
<div class="wrap"><table><thead><tr><th>Time</th><th>Buyer</th><th>Amount</th><th>Transaction</th></tr></thead><tbody id="rows"></tbody></table></div>
</main>
<script>
const seen = new Set(); let first = true;
const short = (s) => s.slice(0, 6) + "…" + s.slice(-4);
async function tick() {
  try {
    const d = await (await fetch("/dashboard/data")).json();
    if (d.error) throw new Error(d.error);
    err.textContent = "";
    count.textContent = d.count; rev.textContent = d.revenueUsdc + " USDC"; buyers.textContent = d.buyers;
    sub.textContent = "Payments to " + d.payTo + " · updated " + new Date(d.updatedAt).toLocaleTimeString();
    rows.innerHTML = d.sales.map((s) => '<tr data-tx="' + s.tx + '"' + (!first && !seen.has(s.tx) ? ' class="new"' : '') + '><td>' +
      new Date(s.at).toLocaleString() + '</td><td class="mono">' + short(s.buyer) + '</td><td>' + s.usdc + ' USDC</td><td class="mono"><a href="' +
      s.link + '" target="_blank" rel="noopener">' + short(s.tx) + '</a></td></tr>').join("") || '<tr><td colspan="4">No sales yet</td></tr>';
    d.sales.forEach((s) => seen.add(s.tx)); first = false;
  } catch (e) { err.textContent = "Couldn't load sales: " + e.message; }
}
tick(); setInterval(tick, 5000);
</script></html>`;
