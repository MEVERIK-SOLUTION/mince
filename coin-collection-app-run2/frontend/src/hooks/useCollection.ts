import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionApi } from '../services/collectionApi';
import { 
  Collection, 
  CollectionItem, 
  CollectionFormData,
  CollectionStats 
} from '../types/collection';

/**
 * Hook pro načítání kolekcí uživatele
 */
export const useCollections = () => {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionApi.getCollections(),
    staleTime: 5 * 60 * 1000, // 5 minut
    cacheTime: 10 * 60 * 1000, // 10 minut
  });
};

/**
 * Hook pro načítání detailu kolekce
 */
export const useCollection = (id: number | null) => {
  return useQuery({
    queryKey: ['collection', id],
    queryFn: () => collectionApi.getCollection(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
};

/**
 * Hook pro načítání položek kolekce
 */
export const useCollectionItems = (collectionId: number | null) => {
  return useQuery({
    queryKey: ['collection-items', collectionId],
    queryFn: () => collectionApi.getCollectionItems(collectionId!),
    enabled: !!collectionId,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
};

/**
 * Hook pro statistiky kolekce
 */
export const useCollectionStats = (collectionId: number | null) => {
  return useQuery({
    queryKey: ['collection-stats', collectionId],
    queryFn: () => collectionApi.getCollectionStats(collectionId!),
    enabled: !!collectionId,
    staleTime: 10 * 60 * 1000, // 10 minut
    cacheTime: 30 * 60 * 1000, // 30 minut
  });
};

/**
 * Hook pro vytvoření nové kolekce
 */
export const useCreateCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CollectionFormData) => collectionApi.createCollection(data),
    onSuccess: (newCollection) => {
      // Invalidace cache pro seznam kolekcí
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      
      // Přidání nové kolekce do cache
      queryClient.setQueryData(['collection', newCollection.id], newCollection);
    },
  });
};

/**
 * Hook pro aktualizaci kolekce
 */
export const useUpdateCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CollectionFormData> }) =>
      collectionApi.updateCollection(id, data),
    onSuccess: (updatedCollection) => {
      // Aktualizace cache
      queryClient.setQueryData(['collection', updatedCollection.id], updatedCollection);
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
};

/**
 * Hook pro smazání kolekce
 */
export const useDeleteCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => collectionApi.deleteCollection(id),
    onSuccess: (_, deletedId) => {
      // Odstranění z cache
      queryClient.removeQueries({ queryKey: ['collection', deletedId] });
      queryClient.removeQueries({ queryKey: ['collection-items', deletedId] });
      queryClient.removeQueries({ queryKey: ['collection-stats', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
};

/**
 * Hook pro přidání mince do kolekce
 */
export const useAddCoinToCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      collectionId, 
      coinId, 
      purchasePrice, 
      purchaseDate, 
      notes 
    }: {
      collectionId: number;
      coinId: number;
      purchasePrice?: number;
      purchaseDate?: string;
      notes?: string;
    }) => collectionApi.addCoinToCollection(collectionId, coinId, {
      purchase_price: purchasePrice,
      purchase_date: purchaseDate,
      notes,
    }),
    onSuccess: (_, { collectionId }) => {
      // Invalidace cache pro položky kolekce
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });
};

/**
 * Hook pro odebrání mince z kolekce
 */
export const useRemoveCoinFromCollection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, coinId }: { collectionId: number; coinId: number }) =>
      collectionApi.removeCoinFromCollection(collectionId, coinId),
    onSuccess: (_, { collectionId }) => {
      // Invalidace cache
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection', collectionId] });
    },
  });
};

/**
 * Hook pro aktualizaci položky kolekce
 */
export const useUpdateCollectionItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      collectionId, 
      coinId, 
      data 
    }: {
      collectionId: number;
      coinId: number;
      data: Partial<CollectionItem>;
    }) => collectionApi.updateCollectionItem(collectionId, coinId, data),
    onSuccess: (_, { collectionId }) => {
      // Invalidace cache
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats', collectionId] });
    },
  });
};

/**
 * Hook pro správu kolekce s lokálním stavem
 */
export const useCollectionManager = (collectionId: number | null) => {
  const [selectedCoins, setSelectedCoins] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const { data: collection } = useCollection(collectionId);
  const { data: items } = useCollectionItems(collectionId);
  const { data: stats } = useCollectionStats(collectionId);

  const addCoinMutation = useAddCoinToCollection();
  const removeCoinMutation = useRemoveCoinFromCollection();
  const updateItemMutation = useUpdateCollectionItem();

  // Výběr mincí
  const toggleCoinSelection = useCallback((coinId: number) => {
    setSelectedCoins(prev => 
      prev.includes(coinId)
        ? prev.filter(id => id !== coinId)
        : [...prev, coinId]
    );
  }, []);

  const selectAllCoins = useCallback(() => {
    if (items) {
      setSelectedCoins(items.map(item => item.coin_id));
    }
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedCoins([]);
    setIsSelectionMode(false);
  }, []);

  // Bulk operace
  const removeSelectedCoins = useCallback(async () => {
    if (!collectionId) return;

    const promises = selectedCoins.map(coinId =>
      removeCoinMutation.mutateAsync({ collectionId, coinId })
    );

    try {
      await Promise.all(promises);
      clearSelection();
    } catch (error) {
      console.error('Error removing coins:', error);
    }
  }, [collectionId, selectedCoins, removeCoinMutation, clearSelection]);

  // Kontrola, zda je mince v kolekci
  const isCoinInCollection = useCallback((coinId: number) => {
    return items?.some(item => item.coin_id === coinId) || false;
  }, [items]);

  // Získání položky kolekce pro minci
  const getCollectionItem = useCallback((coinId: number) => {
    return items?.find(item => item.coin_id === coinId);
  }, [items]);

  return {
    // Data
    collection,
    items: items || [],
    stats,

    // Selection state
    selectedCoins,
    isSelectionMode,

    // Selection actions
    toggleCoinSelection,
    selectAllCoins,
    clearSelection,
    setIsSelectionMode,

    // Collection actions
    addCoin: addCoinMutation.mutate,
    removeCoin: removeCoinMutation.mutate,
    updateItem: updateItemMutation.mutate,
    removeSelectedCoins,

    // Helpers
    isCoinInCollection,
    getCollectionItem,

    // Loading states
    isAddingCoin: addCoinMutation.isPending,
    isRemovingCoin: removeCoinMutation.isPending,
    isUpdatingItem: updateItemMutation.isPending,
  };
};

/**
 * Hook pro rychlé akce s kolekcemi
 */
export const useQuickCollectionActions = () => {
  const queryClient = useQueryClient();
  const { data: collections } = useCollections();

  // Rychlé přidání do kolekce
  const quickAddToCollection = useCallback(async (
    coinId: number,
    collectionId: number,
    options?: {
      purchasePrice?: number;
      purchaseDate?: string;
      notes?: string;
    }
  ) => {
    try {
      await collectionApi.addCoinToCollection(collectionId, coinId, {
        purchase_price: options?.purchasePrice,
        purchase_date: options?.purchaseDate,
        notes: options?.notes,
      });

      // Invalidace cache
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats', collectionId] });

      return true;
    } catch (error) {
      console.error('Error adding coin to collection:', error);
      return false;
    }
  }, [queryClient]);

  // Rychlé odebrání z kolekce
  const quickRemoveFromCollection = useCallback(async (
    coinId: number,
    collectionId: number
  ) => {
    try {
      await collectionApi.removeCoinFromCollection(collectionId, coinId);

      // Invalidace cache
      queryClient.invalidateQueries({ queryKey: ['collection-items', collectionId] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats', collectionId] });

      return true;
    } catch (error) {
      console.error('Error removing coin from collection:', error);
      return false;
    }
  }, [queryClient]);

  // Získání kolekcí obsahujících minci
  const getCollectionsWithCoin = useCallback(async (coinId: number) => {
    if (!collections) return [];

    const results = await Promise.all(
      collections.map(async (collection) => {
        try {
          const items = await collectionApi.getCollectionItems(collection.id);
          const hasItem = items.some(item => item.coin_id === coinId);
          return hasItem ? collection : null;
        } catch {
          return null;
        }
      })
    );

    return results.filter(Boolean) as Collection[];
  }, [collections]);

  return {
    collections: collections || [],
    quickAddToCollection,
    quickRemoveFromCollection,
    getCollectionsWithCoin,
  };
};

/**
 * Hook pro export kolekce
 */
export const useExportCollection = () => {
  return useMutation({
    mutationFn: ({ 
      collectionId, 
      format 
    }: { 
      collectionId: number; 
      format: 'csv' | 'json' | 'pdf' 
    }) => collectionApi.exportCollection(collectionId, format),
    onSuccess: (blob, { collectionId, format }) => {
      // Automatické stažení souboru
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `collection-${collectionId}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};