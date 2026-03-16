import { apiRequest } from './api';
import { Collection, CollectionItem, CollectionFormData, CollectionStats } from '../types/collection';

export const collectionApi = {
  // Získání všech kolekcí uživatele
  getCollections: async (): Promise<Collection[]> => {
    return apiRequest.get<Collection[]>('/api/collections/');
  },

  // Získání detailu kolekce
  getCollection: async (id: number): Promise<Collection> => {
    return apiRequest.get<Collection>(`/api/collections/${id}`);
  },

  // Vytvoření nové kolekce
  createCollection: async (data: CollectionFormData): Promise<Collection> => {
    return apiRequest.post<Collection>('/api/collections/', data);
  },

  // Aktualizace kolekce
  updateCollection: async (id: number, data: Partial<CollectionFormData>): Promise<Collection> => {
    return apiRequest.put<Collection>(`/api/collections/${id}`, data);
  },

  // Smazání kolekce
  deleteCollection: async (id: number): Promise<{ message: string }> => {
    return apiRequest.delete<{ message: string }>(`/api/collections/${id}`);
  },

  // Získání položek kolekce
  getCollectionItems: async (collectionId: number): Promise<CollectionItem[]> => {
    return apiRequest.get<CollectionItem[]>(`/api/collections/${collectionId}/items`);
  },

  // Přidání mince do kolekce
  addCoinToCollection: async (
    collectionId: number,
    coinId: number,
    data?: {
      purchase_price?: number;
      purchase_date?: string;
      notes?: string;
      condition?: string;
      storage_location?: string;
    }
  ): Promise<CollectionItem> => {
    return apiRequest.post<CollectionItem>(`/api/collections/${collectionId}/items`, {
      coin_id: coinId,
      ...data,
    });
  },

  // Odebrání mince z kolekce
  removeCoinFromCollection: async (
    collectionId: number,
    coinId: number
  ): Promise<{ message: string }> => {
    return apiRequest.delete<{ message: string }>(`/api/collections/${collectionId}/items/${coinId}`);
  },

  // Aktualizace položky kolekce
  updateCollectionItem: async (
    collectionId: number,
    coinId: number,
    data: Partial<CollectionItem>
  ): Promise<CollectionItem> => {
    return apiRequest.put<CollectionItem>(`/api/collections/${collectionId}/items/${coinId}`, data);
  },

  // Získání statistik kolekce
  getCollectionStats: async (collectionId: number): Promise<CollectionStats> => {
    return apiRequest.get<CollectionStats>(`/api/collections/${collectionId}/stats`);
  },

  // Duplikace kolekce
  duplicateCollection: async (id: number, newName?: string): Promise<Collection> => {
    return apiRequest.post<Collection>(`/api/collections/${id}/duplicate`, {
      name: newName,
    });
  },

  // Sloučení kolekcí
  mergeCollections: async (
    targetCollectionId: number,
    sourceCollectionIds: number[]
  ): Promise<Collection> => {
    return apiRequest.post<Collection>(`/api/collections/${targetCollectionId}/merge`, {
      source_collection_ids: sourceCollectionIds,
    });
  },

  // Bulk přidání mincí do kolekce
  addMultipleCoinsToCollection: async (
    collectionId: number,
    coinIds: number[],
    defaultData?: {
      purchase_price?: number;
      purchase_date?: string;
      notes?: string;
      condition?: string;
      storage_location?: string;
    }
  ): Promise<CollectionItem[]> => {
    return apiRequest.post<CollectionItem[]>(`/api/collections/${collectionId}/items/bulk`, {
      coin_ids: coinIds,
      default_data: defaultData,
    });
  },

  // Bulk odebrání mincí z kolekce
  removeMultipleCoinsFromCollection: async (
    collectionId: number,
    coinIds: number[]
  ): Promise<{ message: string; removed_count: number }> => {
    return apiRequest.delete<{ message: string; removed_count: number }>(
      `/api/collections/${collectionId}/items/bulk`,
      { coin_ids: coinIds }
    );
  },

  // Vyhledávání v kolekci
  searchCollectionItems: async (
    collectionId: number,
    query: string,
    filters?: {
      condition?: string;
      year_from?: number;
      year_to?: number;
      price_from?: number;
      price_to?: number;
    }
  ): Promise<CollectionItem[]> => {
    const params = {
      q: query,
      ...filters,
    };

    return apiRequest.get<CollectionItem[]>(`/api/collections/${collectionId}/search`, params);
  },

  // Export kolekce
  exportCollection: async (
    collectionId: number,
    format: 'csv' | 'json' | 'pdf' = 'csv'
  ): Promise<Blob> => {
    const response = await fetch(`/api/collections/${collectionId}/export?format=${format}`, {
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

  // Import kolekce
  importCollection: async (
    file: File,
    collectionId?: number
  ): Promise<{ message: string; imported_count: number; errors: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    if (collectionId) {
      formData.append('collection_id', collectionId.toString());
    }

    const response = await fetch('/api/collections/import', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Import se nezdařil');
    }

    return response.json();
  },

  // Získání historie změn kolekce
  getCollectionHistory: async (collectionId: number): Promise<{
    id: number;
    action: string;
    details: any;
    created_at: string;
  }[]> => {
    return apiRequest.get<any[]>(`/api/collections/${collectionId}/history`);
  },

  // Obnovení kolekce ze zálohy
  restoreCollection: async (
    collectionId: number,
    backupDate: string
  ): Promise<Collection> => {
    return apiRequest.post<Collection>(`/api/collections/${collectionId}/restore`, {
      backup_date: backupDate,
    });
  },

  // Sdílení kolekce
  shareCollection: async (
    collectionId: number,
    options: {
      is_public: boolean;
      allow_comments?: boolean;
      password?: string;
      expires_at?: string;
    }
  ): Promise<{ share_url: string; share_token: string }> => {
    return apiRequest.post<{ share_url: string; share_token: string }>(
      `/api/collections/${collectionId}/share`,
      options
    );
  },

  // Zrušení sdílení kolekce
  unshareCollection: async (collectionId: number): Promise<{ message: string }> => {
    return apiRequest.delete<{ message: string }>(`/api/collections/${collectionId}/share`);
  },

  // Získání veřejné kolekce
  getPublicCollection: async (shareToken: string): Promise<{
    collection: Collection;
    items: CollectionItem[];
    stats: CollectionStats;
  }> => {
    return apiRequest.get<any>(`/api/collections/public/${shareToken}`);
  },

  // Porovnání kolekcí
  compareCollections: async (
    collectionIds: number[]
  ): Promise<{
    common_coins: CollectionItem[];
    unique_coins: { [collectionId: number]: CollectionItem[] };
    stats_comparison: { [collectionId: number]: CollectionStats };
  }> => {
    return apiRequest.post<any>('/api/collections/compare', {
      collection_ids: collectionIds,
    });
  },

  // Doporučení mincí pro kolekci
  getCollectionRecommendations: async (
    collectionId: number,
    limit: number = 10
  ): Promise<{
    coin_id: number;
    coin_name: string;
    reason: string;
    confidence_score: number;
  }[]> => {
    return apiRequest.get<any[]>(`/api/collections/${collectionId}/recommendations`, {
      limit,
    });
  },

  // Analýza hodnoty kolekce v čase
  getCollectionValueHistory: async (
    collectionId: number,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<{
    date: string;
    total_value: number;
    purchase_value: number;
    gain_loss: number;
    gain_loss_percentage: number;
  }[]> => {
    return apiRequest.get<any[]>(`/api/collections/${collectionId}/value-history`, {
      period,
    });
  },

  // Získání podobných kolekcí
  getSimilarCollections: async (
    collectionId: number,
    limit: number = 5
  ): Promise<{
    collection: Collection;
    similarity_score: number;
    common_coins_count: number;
  }[]> => {
    return apiRequest.get<any[]>(`/api/collections/${collectionId}/similar`, {
      limit,
    });
  },
};

export default collectionApi;