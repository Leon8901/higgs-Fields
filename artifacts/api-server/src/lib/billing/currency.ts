// Razorpay is an India-first processor: standard accounts settle in INR, so
// USD-denominated prices in our catalog (pricing.ts, credit-packs.ts) need
// converting to INR paise before creating any Order/Plan/Subscription.
//
// We fetch a live USD->INR rate from a free, keyless public endpoint and
// cache it in memory for an hour. If the fetch fails for any reason (network
// down, endpoint changed, offline dev), we fall back to a hardcoded rate
// rather than blocking checkout on an FX API being reachable.
const FALLBACK_USD_TO_INR = 87;
const CACHE_TTL_MS = 60 * 60 * 1000;

let cachedRate: { rate: number; fetchedAt: number } | null = null;

async function fetchUsdToInrRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (!res.ok) throw new Error(`FX endpoint returned ${res.status}`);
    const body: any = await res.json();
    const rate = body?.rates?.INR;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("FX endpoint returned an unusable INR rate");
    }
    cachedRate = { rate, fetchedAt: Date.now() };
    return rate;
  } catch {
    // Swallow and fall back — a stale/hardcoded rate is far better than a
    // broken checkout flow. Not logged as an error since this is expected
    // to happen occasionally (rate limits, transient network issues).
    return FALLBACK_USD_TO_INR;
  }
}

// Returns the amount in paise (1 INR = 100 paise), rounded — the unit
// Razorpay's Orders/Subscriptions/Plans APIs expect for INR.
export async function usdToInrPaise(usd: number): Promise<number> {
  const rate = await fetchUsdToInrRate();
  return Math.round(usd * rate * 100);
}
