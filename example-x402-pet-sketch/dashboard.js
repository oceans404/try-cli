// Seller dashboard: sketches sold and revenue, refreshed every few seconds.
// Data comes from the Rail402 explorer's public API, which indexes settled
// payments per payTo. It labels payments by recipient, not by route, so sales
// are the payments to STELLAR_RECIPIENT of exactly the sketch price in USDC.
const EXPLORER = process.env.EXPLORER_API || "https://explorer-explorer.up.railway.app";

export function mountDashboard(app, { payTo, priceUnits, asset, network }) {
  const expert = `https://stellar.expert/explorer/${network === "stellar:pubnet" ? "public" : "testnet"}`;

  app.get("/dashboard/data", async (_req, res) => {
    try {
      const r = await fetch(`${EXPLORER}/seller/${payTo}`);
      if (!r.ok) throw new Error(`explorer ${r.status}`);
      const { payments = [] } = await r.json();
      const sales = payments
        .filter((p) => p.amount === priceUnits && p.assetContract === asset)
        .map((p) => ({ tx: p.txHash, buyer: p.buyer, usdc: p.amountDecimal, at: p.closedAt, link: `${expert}/tx/${p.txHash}` }));
      const revenue = sales.reduce((sum, s) => sum + BigInt(priceUnits), 0n);
      res.json({
        payTo,
        count: sales.length,
        revenueUsdc: (Number(revenue) / 1e7).toFixed(2),
        buyers: new Set(sales.map((s) => s.buyer)).size,
        sales,
        updatedAt: new Date().toISOString(),
      });
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
