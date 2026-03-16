import { useState, useEffect, useCallback } from 'react';
import NetInfo from '@react-native-netinfo/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'coin' | 'collection' | 'wishlist' | 'photo';
  data: any;
  timestamp: number;
  retryCount: number;
}

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingActions: number;
  lastSyncTime: Date | null;
  syncErrors: string[];
}

interface OfflineSyncHook {
  syncStatus: SyncStatus;
  addOfflineAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) => Promise<void>;
  syncPendingActions: () => Promise<void>;
  clearPendingActions: () => Promise<void>;
  getPendingActions: () => Promise<OfflineAction[]>;
}

const STORAGE_KEYS = {
  PENDING_ACTIONS: 'offline_pending_actions',
  LAST_SYNC: 'offline_last_sync',
  OFFLINE_DATA: 'offline_data',
};

const MAX_RETRY_COUNT = 3;
const SYNC_RETRY_DELAY = 5000; // 5 sekund

export const useOfflineSync = (): OfflineSyncHook => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    isSyncing: false,
    pendingActions: 0,
    lastSyncTime: null,
    syncErrors: [],
  });

  useEffect(() => {
    initializeSync();
    setupNetworkListener();
    loadSyncStatus();
  }, []);

  const initializeSync = async () => {
    try {
      const pendingActions = await getPendingActions();
      const lastSyncString = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      const lastSyncTime = lastSyncString ? new Date(lastSyncString) : null;

      setSyncStatus(prev => ({
        ...prev,
        pendingActions: pendingActions.length,
        lastSyncTime,
      }));
    } catch (error) {
      console.error('Error initializing sync:', error);
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !syncStatus.isOnline;
      const isNowOnline = state.isConnected && state.isInternetReachable;

      setSyncStatus(prev => ({
        ...prev,
        isOnline: isNowOnline || false,
      }));

      // Automatická synchronizace při obnovení připojení
      if (wasOffline && isNowOnline) {
        syncPendingActions();
      }
    });

    return unsubscribe;
  };

  const loadSyncStatus = async () => {
    try {
      const pendingActions = await getPendingActions();
      setSyncStatus(prev => ({
        ...prev,
        pendingActions: pendingActions.length,
      }));
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const addOfflineAction = useCallback(async (
    action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<void> => {
    try {
      const newAction: OfflineAction = {
        ...action,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        retryCount: 0,
      };

      const existingActions = await getPendingActions();
      const updatedActions = [...existingActions, newAction];

      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_ACTIONS,
        JSON.stringify(updatedActions)
      );

      setSyncStatus(prev => ({
        ...prev,
        pendingActions: updatedActions.length,
      }));

      // Pokusit se o okamžitou synchronizaci, pokud jsme online
      if (syncStatus.isOnline && !syncStatus.isSyncing) {
        syncPendingActions();
      }
    } catch (error) {
      console.error('Error adding offline action:', error);
    }
  }, [syncStatus.isOnline, syncStatus.isSyncing]);

  const getPendingActions = useCallback(async (): Promise<OfflineAction[]> => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_ACTIONS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting pending actions:', error);
      return [];
    }
  }, []);

  const syncPendingActions = useCallback(async (): Promise<void> => {
    if (!syncStatus.isOnline || syncStatus.isSyncing) {
      return;
    }

    try {
      setSyncStatus(prev => ({ ...prev, isSyncing: true, syncErrors: [] }));

      const pendingActions = await getPendingActions();
      if (pendingActions.length === 0) {
        setSyncStatus(prev => ({ ...prev, isSyncing: false }));
        return;
      }

      const successfulActions: string[] = [];
      const failedActions: OfflineAction[] = [];
      const errors: string[] = [];

      for (const action of pendingActions) {
        try {
          const success = await executeAction(action);
          
          if (success) {
            successfulActions.push(action.id);
          } else {
            if (action.retryCount < MAX_RETRY_COUNT) {
              failedActions.push({
                ...action,
                retryCount: action.retryCount + 1,
              });
            } else {
              errors.push(`Akce ${action.type} pro ${action.entity} selhala po ${MAX_RETRY_COUNT} pokusech`);
            }
          }
        } catch (error) {
          console.error(`Error executing action ${action.id}:`, error);
          
          if (action.retryCount < MAX_RETRY_COUNT) {
            failedActions.push({
              ...action,
              retryCount: action.retryCount + 1,
            });
          } else {
            errors.push(`Akce ${action.type} pro ${action.entity} selhala: ${error}`);
          }
        }
      }

      // Uložit pouze neúspěšné akce pro další pokus
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_ACTIONS,
        JSON.stringify(failedActions)
      );

      // Uložit čas poslední synchronizace
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_SYNC,
        new Date().toISOString()
      );

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        pendingActions: failedActions.length,
        lastSyncTime: new Date(),
        syncErrors: errors,
      }));

      // Zobrazit výsledek synchronizace
      if (successfulActions.length > 0) {
        console.log(`Synchronizováno ${successfulActions.length} akcí`);
      }

      if (errors.length > 0) {
        Alert.alert(
          'Chyby synchronizace',
          `Některé akce se nepodařilo synchronizovat:\n${errors.join('\n')}`,
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('Error syncing pending actions:', error);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncErrors: ['Chyba při synchronizaci: ' + error],
      }));
    }
  }, [syncStatus.isOnline, syncStatus.isSyncing]);

  const executeAction = async (action: OfflineAction): Promise<boolean> => {
    try {
      // Zde by byla implementace skutečných API volání
      switch (action.entity) {
        case 'coin':
          return await executeCoinAction(action);
        case 'collection':
          return await executeCollectionAction(action);
        case 'wishlist':
          return await executeWishlistAction(action);
        case 'photo':
          return await executePhotoAction(action);
        default:
          console.warn(`Unknown entity type: ${action.entity}`);
          return false;
      }
    } catch (error) {
      console.error(`Error executing ${action.type} action for ${action.entity}:`, error);
      return false;
    }
  };

  const executeCoinAction = async (action: OfflineAction): Promise<boolean> => {
    // Simulace API volání pro mince
    switch (action.type) {
      case 'CREATE':
        // await api.coins.create(action.data);
        console.log('Creating coin:', action.data);
        break;
      case 'UPDATE':
        // await api.coins.update(action.data.id, action.data);
        console.log('Updating coin:', action.data);
        break;
      case 'DELETE':
        // await api.coins.delete(action.data.id);
        console.log('Deleting coin:', action.data);
        break;
    }
    
    // Simulace úspěchu (90% úspěšnost)
    return Math.random() > 0.1;
  };

  const executeCollectionAction = async (action: OfflineAction): Promise<boolean> => {
    // Simulace API volání pro kolekce
    console.log(`Executing ${action.type} for collection:`, action.data);
    return Math.random() > 0.1;
  };

  const executeWishlistAction = async (action: OfflineAction): Promise<boolean> => {
    // Simulace API volání pro wishlist
    console.log(`Executing ${action.type} for wishlist:`, action.data);
    return Math.random() > 0.1;
  };

  const executePhotoAction = async (action: OfflineAction): Promise<boolean> => {
    // Simulace API volání pro fotografie
    console.log(`Executing ${action.type} for photo:`, action.data);
    return Math.random() > 0.1;
  };

  const clearPendingActions = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_ACTIONS);
      setSyncStatus(prev => ({
        ...prev,
        pendingActions: 0,
        syncErrors: [],
      }));
    } catch (error) {
      console.error('Error clearing pending actions:', error);
    }
  }, []);

  return {
    syncStatus,
    addOfflineAction,
    syncPendingActions,
    clearPendingActions,
    getPendingActions,
  };
};

// Hook pro offline data cache
export const useOfflineCache = () => {
  const [cacheSize, setCacheSize] = useState(0);

  const cacheData = useCallback(async (key: string, data: any): Promise<void> => {
    try {
      const cacheKey = `${STORAGE_KEYS.OFFLINE_DATA}_${key}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
      updateCacheSize();
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }, []);

  const getCachedData = useCallback(async (key: string, maxAge?: number): Promise<any | null> => {
    try {
      const cacheKey = `${STORAGE_KEYS.OFFLINE_DATA}_${key}`;
      const stored = await AsyncStorage.getItem(cacheKey);
      
      if (!stored) return null;

      const { data, timestamp } = JSON.parse(stored);
      
      if (maxAge && Date.now() - timestamp > maxAge) {
        // Data jsou příliš stará, smazat je
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }, []);

  const clearCache = useCallback(async (): Promise<void> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.OFFLINE_DATA));
      await AsyncStorage.multiRemove(cacheKeys);
      setCacheSize(0);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, []);

  const updateCacheSize = useCallback(async (): Promise<void> => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.OFFLINE_DATA));
      setCacheSize(cacheKeys.length);
    } catch (error) {
      console.error('Error updating cache size:', error);
    }
  }, []);

  useEffect(() => {
    updateCacheSize();
  }, [updateCacheSize]);

  return {
    cacheSize,
    cacheData,
    getCachedData,
    clearCache,
  };
};

export default useOfflineSync;