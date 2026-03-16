import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  isStandalone: boolean;
  updateAvailable: boolean;
  cacheSize: number;
}

interface PWAActions {
  installApp: () => Promise<boolean>;
  updateApp: () => Promise<void>;
  clearCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;
  showInstallPrompt: () => void;
  dismissInstallPrompt: () => void;
}

export const usePWA = (): PWAState & PWAActions => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isStandalone, setIsStandalone] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Detekce standalone módu
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://');
      
      setIsStandalone(isStandaloneMode);
      setIsInstalled(isStandaloneMode);
    };

    checkStandalone();
    window.addEventListener('resize', checkStandalone);
    
    return () => window.removeEventListener('resize', checkStandalone);
  }, []);

  // Registrace service workeru
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);

          // Kontrola aktualizací
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Detekce install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Sledování online/offline stavu
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Získání velikosti cache
  const getCacheSize = useCallback(async (): Promise<number> => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return 0;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.size || 0);
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [messageChannel.port2]
      );
    });
  }, []);

  // Aktualizace velikosti cache
  useEffect(() => {
    const updateCacheSize = async () => {
      const size = await getCacheSize();
      setCacheSize(size);
    };

    updateCacheSize();
    const interval = setInterval(updateCacheSize, 30000); // Každých 30 sekund

    return () => clearInterval(interval);
  }, [getCacheSize]);

  // Instalace aplikace
  const installApp = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error during app installation:', error);
      return false;
    }
  }, [deferredPrompt]);

  // Aktualizace aplikace
  const updateApp = useCallback(async (): Promise<void> => {
    if (!registration || !registration.waiting) {
      return;
    }

    // Pošleme zprávu waiting service workeru
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Čekáme na aktivaci nového service workeru
    const refreshApp = () => {
      window.location.reload();
    };

    // Nastavíme listener pro controllerchange
    navigator.serviceWorker.addEventListener('controllerchange', refreshApp, { once: true });

    setUpdateAvailable(false);
  }, [registration]);

  // Vyčištění cache
  const clearCache = useCallback(async (): Promise<void> => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      return;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = () => {
        setCacheSize(0);
        resolve();
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      );
    });
  }, []);

  // Zobrazení install promptu
  const showInstallPrompt = useCallback(() => {
    if (deferredPrompt) {
      installApp();
    }
  }, [deferredPrompt, installApp]);

  // Skrytí install promptu
  const dismissInstallPrompt = useCallback(() => {
    setIsInstallable(false);
    setDeferredPrompt(null);
  }, []);

  return {
    // State
    isInstallable,
    isInstalled,
    isOnline,
    isStandalone,
    updateAvailable,
    cacheSize,
    
    // Actions
    installApp,
    updateApp,
    clearCache,
    getCacheSize,
    showInstallPrompt,
    dismissInstallPrompt,
  };
};

// Hook pro offline storage
export const useOfflineStorage = () => {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('indexedDB' in window);
  }, []);

  const saveOfflineData = useCallback(async (key: string, data: any): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const request = indexedDB.open('CoinCollectionOffline', 1);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['offlineData'], 'readwrite');
          const store = transaction.objectStore('offlineData');
          
          const putRequest = store.put({
            id: key,
            data: data,
            timestamp: Date.now()
          });
          
          putRequest.onsuccess = () => resolve(true);
          putRequest.onerror = () => reject(putRequest.error);
        };
        
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('offlineData')) {
            db.createObjectStore('offlineData', { keyPath: 'id' });
          }
        };
      });
    } catch (error) {
      console.error('Error saving offline data:', error);
      return false;
    }
  }, [isSupported]);

  const getOfflineData = useCallback(async (key: string): Promise<any | null> => {
    if (!isSupported) return null;

    try {
      const request = indexedDB.open('CoinCollectionOffline', 1);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['offlineData'], 'readonly');
          const store = transaction.objectStore('offlineData');
          
          const getRequest = store.get(key);
          
          getRequest.onsuccess = () => {
            resolve(getRequest.result?.data || null);
          };
          getRequest.onerror = () => reject(getRequest.error);
        };
      });
    } catch (error) {
      console.error('Error getting offline data:', error);
      return null;
    }
  }, [isSupported]);

  const removeOfflineData = useCallback(async (key: string): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const request = indexedDB.open('CoinCollectionOffline', 1);
      
      return new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['offlineData'], 'readwrite');
          const store = transaction.objectStore('offlineData');
          
          const deleteRequest = store.delete(key);
          
          deleteRequest.onsuccess = () => resolve(true);
          deleteRequest.onerror = () => reject(deleteRequest.error);
        };
      });
    } catch (error) {
      console.error('Error removing offline data:', error);
      return false;
    }
  }, [isSupported]);

  return {
    isSupported,
    saveOfflineData,
    getOfflineData,
    removeOfflineData,
  };
};

// Hook pro push notifikace
export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    setIsSupported('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (vapidPublicKey: string): Promise<PushSubscription | null> => {
    if (!isSupported || permission !== 'granted') return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey
      });
      
      setSubscription(sub);
      return sub;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }, [isSupported, permission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription) return false;

    try {
      const result = await subscription.unsubscribe();
      if (result) {
        setSubscription(null);
      }
      return result;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }, [subscription]);

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
  };
};