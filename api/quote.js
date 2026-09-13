// RENT · stock quotes: Yahoo chart API with a Stooq fallback. ?s=NVDA,TSLA,AAPL
const UA = 'Mozilla/5.0 (rent; +https://rent.vercel.app)';

async function yahoo(sym) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('yahoo ' + r.status);
  const j = await r.json();
  const m = j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
  if (!m || !m.regularMarketPrice) throw new Error('yahoo empty');
  const prev = m.chartPreviousClose || m.previousClose || null;
  return { s: sym, price: m.regularMarketPrice, prev, change: prev ? (m.regularMarketPrice / prev - 1) : null, src: 'yahoo' };
}
async function stooq(sym) {
  const r = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(sym.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('stooq ' + r.status);
  const t = await r.text(); const line = t.trim().split('\n')[1]; if (!line) throw new Error('stooq empty');
  const c = line.split(','); const close = Number(c[6]), open = Number(c[3]);
  if (!close) throw new Error('stooq nd');
  return { s: sym, price: close, prev: open || null, change: open ? close / open - 1 : null, src: 'stooq' };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  const syms = String((req.query && req.query.s) || 'NVDA').split(',').map(s => s.trim().toUpperCase()).filter(s => /^[A-Z.]{1,6}$/.test(s)).slice(0, 12);
  const out = await Promise.all(syms.map(async s => {
    try { return await yahoo(s); } catch (e) { try { return await stooq(s); } catch (e2) { return { s, error: String(e2.message || e2) }; } }
  }));
  res.status(200).json({ at: Date.now(), quotes: out });
};
