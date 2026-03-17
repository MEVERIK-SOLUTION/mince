export interface MetalPrice {
  name: string
  symbol: string
  price_usd: number
  price_eur: number
  price_czk: number
  change_24h: number
  unit: string
}

export interface MetalsResponse {
  success: boolean
  timestamp: number
  metals: MetalPrice[]
  rates: { EUR: number; CZK: number }
  stale?: boolean
}

const BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''

export async function fetchMetals(): Promise<MetalsResponse> {
  const res = await fetch(`${BASE}/api/metals`)
  if (!res.ok) throw new Error(`Metals API ${res.status}`)
  return res.json()
}
