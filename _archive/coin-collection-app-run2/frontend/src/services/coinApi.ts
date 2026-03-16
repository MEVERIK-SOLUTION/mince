import { apiRequest } from './api';
import { 
  Coin, 
  CoinListItem, 
  CoinFormData, 
  CoinSearchFilters, 
  CoinStats,
  CoinQueryParams 
} from '../types/coin';
import { PaginatedResponse } from '../types/api';

export const coinApi = {
  // Získání seznamu mincí s filtrováním
  getCoins: async (params: CoinQueryParams = {}): Promise<CoinListItem[]> => {
    const queryParams = {
      skip: params.skip || 0,
      limit: params.limit || 100,
      ...(params.search && { search: params.search }),
      ...(params.country && { country: params.country }),
      ...(params.coin_type && { coin_type: params.coin_type }),
      ...(params.year_from && { year_from: params.year_from }),
      ...(params.year_to && { year_to: params.year_to }),
    };
    
    return apiRequest.get<CoinListItem[]>('/api/coins/', queryParams);
  },

  // Získání detailu konkrétní mince
  getCoin: async (id: number): Promise<Coin> => {
    return apiRequest.get<Coin>(`/api/coins/${id}`);
  },

  // Vytvoření nové mince
  createCoin: async (coinData: CoinFormData): Promise<Coin> => {
    return apiRequest.post<Coin>('/api/coins/', coinData);
  },

  // Aktualizace existující mince
  updateCoin: async (id: number, coinData: Partial<CoinFormData>): Promise<Coin> => {
    return apiRequest.put<Coin>(`/api/coins/${id}`, coinData);
  },

  // Smazání mince
  deleteCoin: async (id: number): Promise<{ message: string }> => {
    return apiRequest.delete<{ message: string }>(`/api/coins/${id}`);
  },

  // Získání statistik katalogu
  getStats: async (): Promise<CoinStats> => {
    return apiRequest.get<CoinStats>('/api/coins/stats/summary');
  },

  // Pokročilé vyhledávání
  searchCoins: async (filters: CoinSearchFilters): Promise<CoinListItem[]> => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined && value !== '')
    );
    
    return apiRequest.get<CoinListItem[]>('/api/coins/', params);
  },

  // Získání unikátních hodnot pro filtry
  getFilterOptions: async (): Promise<{
    countries: string[];
    coin_types: string[];
    materials: string[];
    currencies: string[];
  }> => {
    // Toto by mělo být implementováno v backendu jako samostatný endpoint
    // Pro teď použijeme mock data nebo extrahujeme z existujících mincí
    const coins = await coinApi.getCoins({ limit: 1000 });
    
    const countries = [...new Set(coins.map(coin => coin.country))].sort();
    const coin_types = [...new Set(coins.map(coin => coin.coin_type).filter(Boolean))].sort();
    const materials = [...new Set(coins.map(coin => coin.material).filter(Boolean))].sort();
    const currencies = [...new Set(coins.map(coin => coin.currency).filter(Boolean))].sort();
    
    return {
      countries,
      coin_types,
      materials,
      currencies,
    };
  },

  // Duplikace mince (vytvoření kopie)
  duplicateCoin: async (id: number): Promise<Coin> => {
    const originalCoin = await coinApi.getCoin(id);
    
    // Odstranění ID a úprava názvu
    const duplicateData: CoinFormData = {
      ...originalCoin,
      name: `${originalCoin.name} (kopie)`,
    };
    
    // Odstranění properties které nejsou v CoinFormData
    delete (duplicateData as any).id;
    delete (duplicateData as any).catalog_id;
    delete (duplicateData as any).images;
    delete (duplicateData as any).created_at;
    delete (duplicateData as any).updated_at;
    
    return coinApi.createCoin(duplicateData);
  },

  // Bulk operace
  bulkDelete: async (ids: number[]): Promise<{ deleted: number; errors: string[] }> => {
    const results = await Promise.allSettled(
      ids.map(id => coinApi.deleteCoin(id))
    );
    
    const deleted = results.filter(result => result.status === 'fulfilled').length;
    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason.detail || 'Neznámá chyba');
    
    return { deleted, errors };
  },

  // Export dat
  exportCoins: async (format: 'csv' | 'json' = 'csv'): Promise<Blob> => {
    const response = await fetch(`/api/coins/export?format=${format}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Export se nezdařil');
    }
    
    return response.blob();
  },
};

export default coinApi;