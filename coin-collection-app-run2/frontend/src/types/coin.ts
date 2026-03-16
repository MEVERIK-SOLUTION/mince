export interface Coin {
  id: number;
  catalog_id?: string;
  name: string;
  country: string;
  year_minted?: number;
  year_range?: string;
  denomination?: number;
  currency?: string;
  material?: string;
  weight_grams?: number;
  diameter_mm?: number;
  thickness_mm?: number;
  edge_type?: string;
  coin_type?: string;
  series?: string;
  rarity_level?: number;
  metadata?: Record<string, any>;
  images: CoinImage[];
  created_at: string;
  updated_at: string;
}

export interface CoinImage {
  id: number;
  type: 'obverse' | 'reverse' | 'edge' | 'detail';
  file_path: string;
  is_primary: boolean;
}

export interface CoinListItem {
  id: number;
  name: string;
  country: string;
  year_minted?: number;
  denomination?: number;
  currency?: string;
  coin_type?: string;
  material?: string;
  rarity_level?: number;
  primary_image?: string;
  created_at: string;
}

export interface CoinFormData {
  name: string;
  country: string;
  year_minted?: number;
  year_range?: string;
  denomination?: number;
  currency?: string;
  material?: string;
  weight_grams?: number;
  diameter_mm?: number;
  thickness_mm?: number;
  edge_type?: string;
  coin_type?: string;
  series?: string;
  rarity_level?: number;
  metadata?: Record<string, any>;
}

export interface CoinSearchFilters {
  search?: string;
  country?: string;
  coin_type?: string;
  material?: string;
  year_from?: number;
  year_to?: number;
  denomination_from?: number;
  denomination_to?: number;
  rarity_min?: number;
  rarity_max?: number;
}

export interface CoinStats {
  total_coins: number;
  by_country: Array<{ country: string; count: number }>;
  by_type: Array<{ type: string; count: number }>;
  by_decade: Array<{ decade: number; count: number }>;
}

// Konstanty pro formuláře
export const COIN_TYPES = [
  'oběžná',
  'pamětní', 
  'investiční',
  'antická',
  'circulation',
  'commemorative',
  'bullion',
  'ancient'
] as const;

export const EDGE_TYPES = [
  'hladký',
  'rýhovaný',
  'nápis',
  'smooth',
  'reeded',
  'lettered'
] as const;

export const CONDITION_GRADES = [
  'UNC',
  'AU',
  'XF', 
  'VF',
  'F',
  'VG',
  'G',
  'AG',
  'FA',
  'PR'
] as const;

export const CURRENCIES = [
  'CZK',
  'EUR',
  'USD',
  'GBP',
  'CHF',
  'CAD',
  'AUD',
  'JPY',
  'CNY',
  'RUB'
] as const;

export type CoinType = typeof COIN_TYPES[number];
export type EdgeType = typeof EDGE_TYPES[number];
export type ConditionGrade = typeof CONDITION_GRADES[number];
export type Currency = typeof CURRENCIES[number];