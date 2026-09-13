// RENT · property reader: Blockscout (name / symbol / holders / supply) + Dexscreener (price / mcap / liquidity / volume / chart)
const UA = 'Mozilla/5.0 (rent; +https://rent.vercel.app)';

async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  const ca = String((req.query && req.query.ca) || '').trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(ca)) return res.status(400).json({ error: 'bad address' });
  const out = { ca, at: Date.now() };
  try {
    const t = await getJSON(`https://robinhoodchain.blockscout.com/api/v2/tokens/${ca}`);
    out.name = t.name || null; out.symbol = t.symbol || null;
    out.holders = Number(t.holders_count ?? t.holders ?? 0) || null;
    out.supply = t.total_supply || null; out.decimals = Number(t.decimals || 18);
    out.explorer = `https://robinhoodchain.blockscout.com/token/${ca}`;
  } catch (e) { out.blockscout_error = String(e.message || e); }
  try {
    const d = await getJSON(`https://api.dexscreener.com/latest/dex/tokens/${ca}`);
    const pairs = (d.pairs || []).filter(p => (p.chainId || '').toLowerCase() === 'robinhood');
    pairs.sort((a, b) => ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0));
    const p = pairs[0];
    if (p) {
      out.price = Number(p.priceUsd) || null;
      out.mcap = p.marketCap || p.fdv || null;
      out.liquidity = (p.liquidity && p.liquidity.usd) || null;
      out.volume24 = (p.volume && p.volume.h24) || 0;
      out.change24 = (p.priceChange && p.priceChange.h24) ?? null;
      out.chart = p.url || null; out.pair = p.pairAddress || null;
      out.quote = (p.quoteToken && p.quoteToken.symbol) || null;
      if (!out.name && p.baseToken) { out.name = p.baseToken.name; out.symbol = p.baseToken.symbol; }
    } else out.dex = 'no pair yet';
  } catch (e) { out.dex_error = String(e.message || e); }
  // the rent: 1% per trade, 70% of it to the landlords
  out.feeIncome24 = out.volume24 != null ? out.volume24 * 0.007 : null;
  out.rentPerHour = out.feeIncome24 != null ? out.feeIncome24 / 24 : null;
  out.capRate = (out.feeIncome24 != null && out.mcap) ? (out.feeIncome24 * 365) / out.mcap : null;
  res.status(200).json(out);
};
