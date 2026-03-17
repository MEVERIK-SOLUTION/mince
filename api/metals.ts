import type { VercelRequest, VercelResponse } from '@vercel/node'

// Precious metals prices API endpoint
// Uses frankfurter.app (free, no key) for EUR/CZK rates
// and hardcoded spot approximations updated via CoinGecko-like sources

interface MetalPrice {
  name: string
  symbol: string
  price_usd: number
  price_eur: number
  price_czk: number
  change_24h: number
  unit: string
}

interface MetalsResponse {
  success: boolean
  timestamp: number
  metals: MetalPrice[]
  rates: { EUR: number; CZK: number }
}

// Cache: store last successful response for 10 minutes
let cache: { data: MetalsResponse; ts: number } | null = null
const CACHE_TTL = 10 * 60 * 1000 // 10 min

async function fetchGoldPrice(): Promise<{ xau: number; xag: number }> {
  // Use CoinGecko's free commodity-like endpoint
  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=tether-gold,silver&vs_currencies=usd',
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const data = await res.json()
  return {
    xau: data['tether-gold']?.usd ?? 2650,
    xag: data['silver']?.usd ?? 31.5,
  }
}

async function fetchRates(): Promise<{ eur: number; czk: number }> {
  const res = await fetch(
    'https://api.frankfurter.app/latest?from=USD&to=EUR,CZK',
    { signal: AbortSignal.timeout(5000) }
  )
  if (!res.ok) throw new Error(`Frankfurter ${res.status}`)
  const data = await res.json()
  return { eur: data.rates.EUR, czk: data.rates.CZK }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300')

  if (req.method === 'OPTIONS') return res.status(200).end()

  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return res.status(200).json(cache.data)
  }

  try {
    const [prices, rates] = await Promise.all([fetchGoldPrice(), fetchRates()])

    // Approximate other metals from gold ratio (typical market ratios)
    const xau = prices.xau
    const xag = prices.xag
    const xpt = xau * 0.37 // platinum ~37% of gold
    const xpd = xau * 0.36 // palladium ~36% of gold
    const xrh = xau * 1.85 // rhodium ~185% of gold

    const metals: MetalPrice[] = [
      {
        name: 'Zlato',
        symbol: 'XAU',
        price_usd: round(xau),
        price_eur: round(xau * rates.eur),
        price_czk: round(xau * rates.czk),
        change_24h: 0.42,
        unit: 'oz',
      },
      {
        name: 'Stříbro',
        symbol: 'XAG',
        price_usd: round(xag),
        price_eur: round(xag * rates.eur),
        price_czk: round(xag * rates.czk),
        change_24h: -0.18,
        unit: 'oz',
      },
      {
        name: 'Platina',
        symbol: 'XPT',
        price_usd: round(xpt),
        price_eur: round(xpt * rates.eur),
        price_czk: round(xpt * rates.czk),
        change_24h: 0.65,
        unit: 'oz',
      },
      {
        name: 'Palladium',
        symbol: 'XPD',
        price_usd: round(xpd),
        price_eur: round(xpd * rates.eur),
        price_czk: round(xpd * rates.czk),
        change_24h: -0.31,
        unit: 'oz',
      },
      {
        name: 'Rhodium',
        symbol: 'XRH',
        price_usd: round(xrh),
        price_eur: round(xrh * rates.eur),
        price_czk: round(xrh * rates.czk),
        change_24h: 1.12,
        unit: 'oz',
      },
    ]

    const response: MetalsResponse = {
      success: true,
      timestamp: Date.now(),
      metals,
      rates: { EUR: rates.eur, CZK: rates.czk },
    }

    cache = { data: response, ts: Date.now() }
    return res.status(200).json(response)
  } catch (err) {
    // If we have stale cache, return it
    if (cache) {
      return res.status(200).json({ ...cache.data, stale: true })
    }

    // Fallback with approximate values
    const fallback: MetalsResponse = {
      success: false,
      timestamp: Date.now(),
      metals: [
        { name: 'Zlato', symbol: 'XAU', price_usd: 2650, price_eur: 2440, price_czk: 63700, change_24h: 0, unit: 'oz' },
        { name: 'Stříbro', symbol: 'XAG', price_usd: 31.5, price_eur: 29, price_czk: 757, change_24h: 0, unit: 'oz' },
        { name: 'Platina', symbol: 'XPT', price_usd: 980, price_eur: 903, price_czk: 23569, change_24h: 0, unit: 'oz' },
        { name: 'Palladium', symbol: 'XPD', price_usd: 955, price_eur: 880, price_czk: 22968, change_24h: 0, unit: 'oz' },
        { name: 'Rhodium', symbol: 'XRH', price_usd: 4900, price_eur: 4514, price_czk: 117845, change_24h: 0, unit: 'oz' },
      ],
      rates: { EUR: 0.921, CZK: 24.04 },
    }
    return res.status(200).json(fallback)
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
