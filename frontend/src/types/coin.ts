// Typy pro mince a kolekce

export interface Coin {
  id: string
  catalog_id?: string
  name: string
  country: string
  year_minted?: number
  year_range?: string
  denomination?: number
  currency?: string
  material?: string
  weight_grams?: number
  diameter_mm?: number
  thickness_mm?: number
  edge_type?: string
  coin_type?: string
  series?: string
  condition?: string
  rarity_level?: number
  current_value?: number
  acquisition_price?: number
  acquisition_date?: string
  acquisition_source?: string
  storage_location?: string
  description?: string
  metadata?: Record<string, unknown>
  images?: CoinImage[]
  created_at: string
  updated_at: string
}

export interface CoinImage {
  id: string
  coin_id: string
  image_url: string
  image_type: 'obverse' | 'reverse' | 'edge' | 'detail' | 'other'
  is_primary: boolean
  order_index: number
  created_at: string
}

export interface CoinFormData {
  name: string
  country: string
  year_minted?: number
  year_range?: string
  denomination?: number
  currency?: string
  material?: string
  weight_grams?: number
  diameter_mm?: number
  thickness_mm?: number
  edge_type?: string
  coin_type?: string
  series?: string
  condition?: string
  rarity_level?: number
  current_value?: number
  acquisition_price?: number
  acquisition_date?: string
  acquisition_source?: string
  storage_location?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface CoinSearchFilters {
  search?: string
  country?: string
  coin_type?: string
  material?: string
  year_from?: number
  year_to?: number
  rarity_min?: number
  rarity_max?: number
}

export interface CoinStats {
  total_coins: number
  total_value: number
  by_country: Array<{ country: string; count: number }>
  by_type: Array<{ coin_type: string; count: number }>
}

export interface Collection {
  id: string
  name: string
  description?: string
  is_public: boolean
  created_at: string
  updated_at: string
  coin_count?: number
}

export interface CollectionCoin {
  collection_id: string
  coin_id: string
  added_at: string
  coin?: Coin
}

// AI typy

export interface CoinIdentification {
  name: string | null
  country: string | null
  year_minted: number | null
  denomination: number | null
  currency: string | null
  material: string | null
  weight_grams: number | null
  diameter_mm: number | null
  coin_type: string | null
  condition: string | null
  rarity_level: number | null
  series: string | null
  description: string | null
  confidence: number
}

export interface ValueEstimate {
  estimated_value_czk: number
  estimated_value_eur: number
  value_range_czk: { min: number; max: number }
  confidence: number
  factors: string[]
  notes: string
}

// Konstanty pro formuláře
export const COIN_TYPES = [
  { value: 'oběžná', label: 'Oběžná' },
  { value: 'pamětní', label: 'Pamětní' },
  { value: 'investiční', label: 'Investiční' },
  { value: 'antická', label: 'Antická' },
  { value: 'zkušební', label: 'Zkušební / Proof' },
] as const

export const EDGE_TYPES = [
  { value: 'hladký', label: 'Hladký' },
  { value: 'rýhovaný', label: 'Rýhovaný' },
  { value: 'nápis', label: 'Nápis' },
  { value: 'ozdobný', label: 'Ozdobný' },
] as const

export const CONDITION_GRADES = [
  { value: 'UNC', label: 'UNC – Nekola' },
  { value: 'AU', label: 'AU – Takřka nekola' },
  { value: 'XF', label: 'XF – Výborný stav' },
  { value: 'VF', label: 'VF – Velmi pěkný' },
  { value: 'F', label: 'F – Pěkný' },
  { value: 'VG', label: 'VG – Velmi dobrý' },
  { value: 'G', label: 'G – Dobrý' },
  { value: 'AG', label: 'AG – Přijatelný' },
  { value: 'PR', label: 'PR – Proof' },
] as const

export const CURRENCIES = ['CZK', 'EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'] as const

export const MATERIALS = [
  'Stříbro',
  'Zlato',
  'Měď',
  'Nikl',
  'Bronz',
  'Bimetal',
  'Platina',
  'Palladium',
  'Tombak',
  'Nerezová ocel',
] as const

export const COUNTRIES = [
  'Česká republika',
  'Slovensko',
  'Německo',
  'Rakousko',
  'Francie',
  'Itálie',
  'Španělsko',
  'Velká Británie',
  'USA',
  'Kanada',
  'Austrálie',
  'Japonsko',
  'Čína',
  'Rusko',
  'Polsko',
  'Maďarsko',
  'Rumunsko',
  'Bulharsko',
  'Řecko',
  'Turecko',
  'Izrael',
  'Jihoafrická republika',
  'Mexiko',
  'Argentina',
  'Brazílie',
] as const
