import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

interface GeolocationHook {
  location: LocationData | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
  watchLocation: () => void;
  stopWatching: () => void;
  getAddressFromCoords: (lat: number, lng: number) => Promise<string | null>;
}

export const useGeolocation = (): GeolocationHook => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [watchSubscription, setWatchSubscription] = useState<Location.LocationSubscription | null>(null);

  useEffect(() => {
    checkPermissions();
    
    return () => {
      if (watchSubscription) {
        watchSubscription.remove();
      }
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (err) {
      setError('Nepodařilo se zkontrolovat oprávnění k poloze');
      console.error('Permission check error:', err);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Přístup k poloze byl zamítnut');
        Alert.alert(
          'Oprávnění k poloze',
          'Pro určení polohy nálezů mincí je potřeba přístup k vaší poloze.',
          [
            { text: 'OK' }
          ]
        );
        return false;
      }

      setHasPermission(true);
      return true;
    } catch (err) {
      setError('Nepodařilo se získat oprávnění k poloze');
      console.error('Permission request error:', err);
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      const locationResult = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 1,
      });

      const locationData: LocationData = {
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        accuracy: locationResult.coords.accuracy || 0,
        altitude: locationResult.coords.altitude || undefined,
        heading: locationResult.coords.heading || undefined,
        speed: locationResult.coords.speed || undefined,
        timestamp: locationResult.timestamp,
      };

      setLocation(locationData);
      return locationData;

    } catch (err) {
      setError('Nepodařilo se získat aktuální polohu');
      console.error('Get location error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission, requestPermission]);

  const watchLocation = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      setError(null);

      if (watchSubscription) {
        watchSubscription.remove();
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // Aktualizace každých 10 sekund
          distanceInterval: 10, // Aktualizace při změně o 10 metrů
        },
        (locationResult) => {
          const locationData: LocationData = {
            latitude: locationResult.coords.latitude,
            longitude: locationResult.coords.longitude,
            accuracy: locationResult.coords.accuracy || 0,
            altitude: locationResult.coords.altitude || undefined,
            heading: locationResult.coords.heading || undefined,
            speed: locationResult.coords.speed || undefined,
            timestamp: locationResult.timestamp,
          };

          setLocation(locationData);
        }
      );

      setWatchSubscription(subscription);

    } catch (err) {
      setError('Nepodařilo se spustit sledování polohy');
      console.error('Watch location error:', err);
    }
  }, [hasPermission, requestPermission, watchSubscription]);

  const stopWatching = useCallback(() => {
    if (watchSubscription) {
      watchSubscription.remove();
      setWatchSubscription(null);
    }
  }, [watchSubscription]);

  const getAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string | null> => {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        const parts = [
          address.street,
          address.streetNumber,
          address.city,
          address.region,
          address.country
        ].filter(Boolean);

        return parts.join(', ');
      }

      return null;
    } catch (err) {
      console.error('Reverse geocoding error:', err);
      return null;
    }
  }, []);

  return {
    location,
    isLoading,
    error,
    hasPermission,
    requestPermission,
    getCurrentLocation,
    watchLocation,
    stopWatching,
    getAddressFromCoords,
  };
};

// Hook pro výpočet vzdálenosti mezi dvěma body
export const useDistanceCalculator = () => {
  const calculateDistance = useCallback((
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371; // Poloměr Země v kilometrech
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }, []);

  const toRadians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  const formatDistance = useCallback((distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    } else if (distance < 10) {
      return `${distance.toFixed(1)} km`;
    } else {
      return `${Math.round(distance)} km`;
    }
  }, []);

  return {
    calculateDistance,
    formatDistance,
  };
};

// Hook pro práci s mapami
export const useMapIntegration = () => {
  const openInMaps = useCallback(async (latitude: number, longitude: number, label?: string) => {
    try {
      const url = `https://maps.apple.com/?q=${latitude},${longitude}&ll=${latitude},${longitude}`;
      
      if (label) {
        const encodedLabel = encodeURIComponent(label);
        return `${url}&t=m&z=16&q=${encodedLabel}`;
      }
      
      return url;
    } catch (error) {
      console.error('Error opening maps:', error);
      return null;
    }
  }, []);

  const getStaticMapUrl = useCallback((
    latitude: number,
    longitude: number,
    zoom: number = 15,
    width: number = 300,
    height: number = 200
  ): string => {
    // Použití MapBox Static API (vyžaduje API klíč)
    const mapboxToken = 'YOUR_MAPBOX_TOKEN'; // Nahradit skutečným tokenem
    
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/pin-s+ff0000(${longitude},${latitude})/${longitude},${latitude},${zoom}/${width}x${height}?access_token=${mapboxToken}`;
  }, []);

  const searchNearbyPlaces = useCallback(async (
    latitude: number,
    longitude: number,
    radius: number = 1000,
    type: string = 'point_of_interest'
  ) => {
    try {
      // Implementace vyhledávání míst v okolí
      // Můžete použít Google Places API, Foursquare API, nebo jiné služby
      
      // Simulace výsledků
      return [
        {
          id: '1',
          name: 'Muzeum mincí',
          type: 'museum',
          distance: 0.5,
          address: 'Václavské náměstí 1, Praha',
          coordinates: { latitude: latitude + 0.001, longitude: longitude + 0.001 }
        },
        {
          id: '2',
          name: 'Numismatická prodejna',
          type: 'shop',
          distance: 0.8,
          address: 'Národní třída 15, Praha',
          coordinates: { latitude: latitude - 0.001, longitude: longitude + 0.002 }
        }
      ];
    } catch (error) {
      console.error('Error searching nearby places:', error);
      return [];
    }
  }, []);

  return {
    openInMaps,
    getStaticMapUrl,
    searchNearbyPlaces,
  };
};

export default useGeolocation;