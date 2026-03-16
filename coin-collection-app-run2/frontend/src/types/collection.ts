export interface Collection {
  id: number;
  name: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  items_count: number;
  total_value?: number;
  cover_image?: string;
  tags?: string[];
}

export interface CollectionItem {
  id: number;
  collection_id: number;
  coin_id: number;
  coin: {
    id: number;
    name: string;
    country: string;
    year?: number;
    currency: string;
    current_value?: number;
    main_image?: string;
  };
  coin_name: string;
  coin_country: string;
  coin_year?: number;
  coin_denomination?: number;
  coin_currency?: string;
  condition_grade?: string;
  condition_notes?: string;
  acquisition_date?: string;
  acquisition_price?: number;
  acquisition_source?: string;
  current_estimated_value?: number;
  last_valuation_date?: string;
  valuation_source?: string;
  storage_location?: string;
  insurance_value?: number;
  notes?: string;
  primary_image?: string;
  purchase_price?: number;
  purchase_date?: string;
  condition?: string;
  added_at: string;
  updated_at: string;
  created_at: string;
}

export interface CollectionFormData {
  name: string;
  description?: string;
  is_public?: boolean;
  tags?: string[];
}

export interface CollectionItemFormData {
  coin_id: number;
  condition_grade?: string;
  condition_notes?: string;
  acquisition_date?: string;
  acquisition_price?: number;
  acquisition_source?: string;
  current_estimated_value?: number;
  last_valuation_date?: string;
  valuation_source?: string;
  storage_location?: string;
  insurance_value?: number;
  notes?: string;
  purchase_price?: number;
  purchase_date?: string;
  condition?: string;
}

export interface CollectionStats {
  total_items: number;
  total_acquisition_value: number;
  total_current_value: number;
  total_insurance_value: number;
  roi_percentage: number;
  by_condition: Array<{
    condition: string;
    count: number;
    total_value: number;
  }>;
  by_country: Array<{
    country: string;
    count: number;
    total_value: number;
  }>;
  most_valuable: Array<{
    id: number;
    coin_name: string;
    value: number;
  }>;
  recent_additions: Array<{
    id: number;
    coin_name: string;
    added_date: string;
  }>;
}

export interface CollectionFilters {
  condition?: string;
  min_value?: number;
  max_value?: number;
  acquisition_year?: number;
  storage_location?: string;
  country?: string;
}

export const ACQUISITION_SOURCES = [
  'aukce',
  'obchod',
  'dědictví',
  'dárek',
  'výměna',
  'nález',
  'jiné'
] as const;

export type AcquisitionSource = typeof ACQUISITION_SOURCES[number];