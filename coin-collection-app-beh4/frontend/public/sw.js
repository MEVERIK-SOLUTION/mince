const CACHE_NAME = 'coin-collection-v1.0.0';
const STATIC_CACHE_NAME = 'coin-collection-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'coin-collection-dynamic-v1.0.0';
const IMAGE_CACHE_NAME = 'coin-collection-images-v1.0.0';

// Soubory pro statické cachování
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Offline stránka
  '/offline.html'
];

// API endpointy pro cachování
const CACHEABLE_APIS = [
  '/api/collections',
  '/api/coins',
  '/api/countries',
  '/api/materials',
  '/api/conditions'
];

// Maximální velikost cache
const MAX_CACHE_SIZE = 50; // MB
const MAX_IMAGE_CACHE_SIZE = 100; // MB
const MAX_DYNAMIC_CACHE_ITEMS = 100;

// Install event - cachování statických souborů
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Error caching static assets', error);
      })
  );
});

// Activate event - čištění starých cache
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== IMAGE_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - strategie cachování
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorovat non-GET požadavky
  if (request.method !== 'GET') {
    return;
  }

  // Ignorovat chrome-extension požadavky
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Strategie pro různé typy požadavků
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
  } else if (isImageRequest(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE_NAME));
  } else if (isAPIRequest(request)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME));
  } else if (isNavigationRequest(request)) {
    event.respondWith(networkFirstWithOfflineFallback(request));
  } else {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME));
  }
});

// Background Sync pro offline akce
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-sync-coins') {
    event.waitUntil(syncOfflineCoins());
  } else if (event.tag === 'background-sync-images') {
    event.waitUntil(syncOfflineImages());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Nová notifikace z Coin Manager',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Zobrazit',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Zavřít',
        icon: '/icons/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Coin Collection Manager', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Utility functions
function isStaticAsset(request) {
  return request.url.includes('/static/') || 
         request.url.includes('/manifest.json') ||
         request.url.includes('/icons/');
}

function isImageRequest(request) {
  return request.destination === 'image' ||
         request.url.includes('/uploads/') ||
         request.url.includes('/images/');
}

function isAPIRequest(request) {
  return request.url.includes('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// Cache strategies
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log('Service Worker: Serving from cache', request.url);
      return cachedResponse;
    }

    console.log('Service Worker: Fetching and caching', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName, MAX_DYNAMIC_CACHE_ITEMS);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Cache first strategy failed', error);
    
    if (isNavigationRequest(request)) {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

async function networkFirst(request, cacheName) {
  try {
    console.log('Service Worker: Network first for', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, networkResponse.clone());
      await limitCacheSize(cacheName, MAX_DYNAMIC_CACHE_ITEMS);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache', request.url);
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed for navigation, serving offline page');
    return caches.match('/offline.html');
  }
}

// Cache management
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const itemsToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(
      itemsToDelete.map(key => cache.delete(key))
    );
    console.log(`Service Worker: Cleaned ${itemsToDelete.length} items from ${cacheName}`);
  }
}

async function getCacheSize(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  let totalSize = 0;
  
  for (const key of keys) {
    const response = await cache.match(key);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }
  
  return totalSize;
}

// Offline sync functions
async function syncOfflineCoins() {
  try {
    console.log('Service Worker: Syncing offline coins');
    
    // Získat offline data z IndexedDB
    const offlineCoins = await getOfflineCoins();
    
    for (const coin of offlineCoins) {
      try {
        const response = await fetch('/api/coins', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${coin.token}`
          },
          body: JSON.stringify(coin.data)
        });
        
        if (response.ok) {
          await removeOfflineCoin(coin.id);
          console.log('Service Worker: Synced offline coin', coin.id);
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync coin', coin.id, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Sync offline coins failed', error);
  }
}

async function syncOfflineImages() {
  try {
    console.log('Service Worker: Syncing offline images');
    
    const offlineImages = await getOfflineImages();
    
    for (const image of offlineImages) {
      try {
        const formData = new FormData();
        formData.append('image', image.blob);
        formData.append('coin_id', image.coinId);
        
        const response = await fetch('/api/coins/images', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${image.token}`
          },
          body: formData
        });
        
        if (response.ok) {
          await removeOfflineImage(image.id);
          console.log('Service Worker: Synced offline image', image.id);
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync image', image.id, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Sync offline images failed', error);
  }
}

// IndexedDB helpers (simplified - would need full implementation)
async function getOfflineCoins() {
  // Implementation would use IndexedDB to get offline coins
  return [];
}

async function removeOfflineCoin(id) {
  // Implementation would remove coin from IndexedDB
}

async function getOfflineImages() {
  // Implementation would use IndexedDB to get offline images
  return [];
}

async function removeOfflineImage(id) {
  // Implementation would remove image from IndexedDB
}

// Message handling
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    getCacheSize(DYNAMIC_CACHE_NAME).then(size => {
      event.ports[0].postMessage({ size });
    });
  } else if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(DYNAMIC_CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

console.log('Service Worker: Loaded');