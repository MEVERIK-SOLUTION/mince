import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coinApi } from '../services/coinApi';
import { 
  Coin, 
  CoinListItem, 
  CoinFormData, 
  CoinQueryParams, 
  CoinStats 
} from '../types/coin';

/**
 * Hook pro načítání seznamu mincí
 */
export const useCoins = (params: CoinQueryParams = {}) => {
  return useQuery({
    queryKey: ['coins', params],
    queryFn: () => coinApi.getCoins(params),
    staleTime: 5 * 60 * 1000, // 5 minut
    cacheTime: 10 * 60 * 1000, // 10 minut
  });
};

/**
 * Hook pro načítání detailu mince
 */
export const useCoin = (id: number | null) => {
  return useQuery({
    queryKey: ['coin', id],
    queryFn: () => coinApi.getCoin(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
};

/**
 * Hook pro statistiky katalogu
 */
export const useCoinStats = () => {
  return useQuery({
    queryKey: ['coin-stats'],
    queryFn: () => coinApi.getStats(),
    staleTime: 10 * 60 * 1000, // 10 minut
    cacheTime: 30 * 60 * 1000, // 30 minut
  });
};

/**
 * Hook pro vytvoření nové mince
 */
export const useCreateCoin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (coinData: CoinFormData) => coinApi.createCoin(coinData),
    onSuccess: (newCoin) => {
      // Invalidace cache pro seznam mincí
      queryClient.invalidateQueries({ queryKey: ['coins'] });
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] });
      
      // Přidání nové mince do cache
      queryClient.setQueryData(['coin', newCoin.id], newCoin);
    },
  });
};

/**
 * Hook pro aktualizaci mince
 */
export const useUpdateCoin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CoinFormData> }) =>
      coinApi.updateCoin(id, data),
    onSuccess: (updatedCoin) => {
      // Aktualizace cache
      queryClient.setQueryData(['coin', updatedCoin.id], updatedCoin);
      queryClient.invalidateQueries({ queryKey: ['coins'] });
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] });
    },
  });
};

/**
 * Hook pro smazání mince
 */
export const useDeleteCoin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => coinApi.deleteCoin(id),
    onSuccess: (_, deletedId) => {
      // Odstranění z cache
      queryClient.removeQueries({ queryKey: ['coin', deletedId] });
      queryClient.invalidateQueries({ queryKey: ['coins'] });
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] });
    },
  });
};

/**
 * Hook pro duplikaci mince
 */
export const useDuplicateCoin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => coinApi.duplicateCoin(id),
    onSuccess: (newCoin) => {
      queryClient.invalidateQueries({ queryKey: ['coins'] });
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] });
      queryClient.setQueryData(['coin', newCoin.id], newCoin);
    },
  });
};

/**
 * Hook pro bulk operace
 */
export const useBulkDeleteCoins = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => coinApi.bulkDelete(ids),
    onSuccess: (_, deletedIds) => {
      // Odstranění z cache
      deletedIds.forEach(id => {
        queryClient.removeQueries({ queryKey: ['coin', id] });
      });
      queryClient.invalidateQueries({ queryKey: ['coins'] });
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] });
    },
  });
};

/**
 * Hook pro pokročilé vyhledávání s debounce
 */
export const useCoinSearch = (initialParams: CoinQueryParams = {}) => {
  const [searchParams, setSearchParams] = useState<CoinQueryParams>(initialParams);
  const [debouncedParams, setDebouncedParams] = useState<CoinQueryParams>(initialParams);

  // Debounce pro vyhledávání
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedParams(searchParams);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchParams]);

  const { data: coins, isLoading, error } = useCoins(debouncedParams);

  const updateSearch = useCallback((newParams: Partial<CoinQueryParams>) => {
    setSearchParams(prev => ({ ...prev, ...newParams }));
  }, []);

  const resetSearch = useCallback(() => {
    setSearchParams({});
  }, []);

  return {
    coins,
    isLoading,
    error,
    searchParams,
    updateSearch,
    resetSearch,
  };
};

/**
 * Hook pro správu filtrů
 */
export const useCoinFilters = () => {
  const [filters, setFilters] = useState<CoinQueryParams>({});

  const updateFilter = useCallback((key: keyof CoinQueryParams, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const removeFilter = useCallback((key: keyof CoinQueryParams) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const hasActiveFilters = Object.keys(filters).length > 0;

  return {
    filters,
    updateFilter,
    removeFilter,
    clearFilters,
    hasActiveFilters,
  };
};

/**
 * Hook pro načítání možností filtrů
 */
export const useFilterOptions = () => {
  return useQuery({
    queryKey: ['filter-options'],
    queryFn: () => coinApi.getFilterOptions(),
    staleTime: 30 * 60 * 1000, // 30 minut
    cacheTime: 60 * 60 * 1000, // 1 hodina
  });
};

/**
 * Hook pro export dat
 */
export const useExportCoins = () => {
  return useMutation({
    mutationFn: (format: 'csv' | 'json' = 'csv') => coinApi.exportCoins(format),
    onSuccess: (blob, format) => {
      // Automatické stažení souboru
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `coins-export.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

/**
 * Hook pro sledování změn v datech
 */
export const useCoinDataSync = () => {
  const queryClient = useQueryClient();

  const syncData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['coins'] });
    queryClient.invalidateQueries({ queryKey: ['coin-stats'] });
  }, [queryClient]);

  // Automatická synchronizace každých 5 minut
  useEffect(() => {
    const interval = setInterval(syncData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [syncData]);

  return { syncData };
};

/**
 * Hook pro optimistické aktualizace
 */
export const useOptimisticCoinUpdate = () => {
  const queryClient = useQueryClient();

  const optimisticUpdate = useCallback(
    (coinId: number, updates: Partial<Coin>) => {
      queryClient.setQueryData(['coin', coinId], (oldData: Coin | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, ...updates };
      });
    },
    [queryClient]
  );

  const revertOptimisticUpdate = useCallback(
    (coinId: number) => {
      queryClient.invalidateQueries({ queryKey: ['coin', coinId] });
    },
    [queryClient]
  );

  return {
    optimisticUpdate,
    revertOptimisticUpdate,
  };
};