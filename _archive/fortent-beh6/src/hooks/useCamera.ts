import { useState, useEffect, useCallback } from 'react';
import { Camera } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

interface CameraPermissions {
  camera: boolean;
  mediaLibrary: boolean;
}

interface CameraHook {
  hasPermission: boolean;
  permissions: CameraPermissions;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
  takePicture: (cameraRef: any) => Promise<string | null>;
  pickImage: () => Promise<string | null>;
  saveToLibrary: (uri: string) => Promise<boolean>;
}

export const useCamera = (): CameraHook => {
  const [permissions, setPermissions] = useState<CameraPermissions>({
    camera: false,
    mediaLibrary: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [cameraStatus, mediaStatus] = await Promise.all([
        Camera.getCameraPermissionsAsync(),
        MediaLibrary.getPermissionsAsync()
      ]);

      const newPermissions = {
        camera: cameraStatus.status === 'granted',
        mediaLibrary: mediaStatus.status === 'granted'
      };

      setPermissions(newPermissions);
    } catch (err) {
      setError('Nepodařilo se zkontrolovat oprávnění');
      console.error('Permission check error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Požádat o oprávnění ke kameře
      const cameraResult = await Camera.requestCameraPermissionsAsync();
      
      if (cameraResult.status !== 'granted') {
        setError('Přístup ke kameře byl zamítnut');
        return;
      }

      // Požádat o oprávnění k mediální knihovně
      const mediaResult = await MediaLibrary.requestPermissionsAsync();
      
      if (mediaResult.status !== 'granted') {
        setError('Přístup k mediální knihovně byl zamítnut');
        return;
      }

      setPermissions({
        camera: true,
        mediaLibrary: true
      });

    } catch (err) {
      setError('Nepodařilo se získat oprávnění');
      console.error('Permission request error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const takePicture = useCallback(async (cameraRef: any): Promise<string | null> => {
    if (!cameraRef.current || !permissions.camera) {
      setError('Kamera není dostupná');
      return null;
    }

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
        skipProcessing: false,
      });

      return photo.uri;
    } catch (err) {
      setError('Nepodařilo se pořídit fotografii');
      console.error('Take picture error:', err);
      return null;
    }
  }, [permissions.camera]);

  const pickImage = useCallback(async (): Promise<string | null> => {
    try {
      // Zkontrolovat oprávnění pro výběr obrázků
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Oprávnění',
          'Pro výběr obrázků z galerie je potřeba oprávnění k přístupu k fotkám.'
        );
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }

      return null;
    } catch (err) {
      setError('Nepodařilo se vybrat obrázek');
      console.error('Pick image error:', err);
      return null;
    }
  }, []);

  const saveToLibrary = useCallback(async (uri: string): Promise<boolean> => {
    if (!permissions.mediaLibrary) {
      setError('Není oprávnění k ukládání do galerie');
      return false;
    }

    try {
      const asset = await MediaLibrary.createAssetAsync(uri);
      
      // Vytvořit album pro aplikaci, pokud neexistuje
      const album = await MediaLibrary.getAlbumAsync('Coin Collection');
      
      if (album == null) {
        await MediaLibrary.createAlbumAsync('Coin Collection', asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      return true;
    } catch (err) {
      setError('Nepodařilo se uložit fotografii');
      console.error('Save to library error:', err);
      return false;
    }
  }, [permissions.mediaLibrary]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return {
    hasPermission: permissions.camera && permissions.mediaLibrary,
    permissions,
    isLoading,
    error,
    requestPermission,
    takePicture,
    pickImage,
    saveToLibrary
  };
};

// Hook pro detekci mincí v obraze
export const useCoinDetection = () => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<any>(null);

  const detectCoin = useCallback(async (imageUri: string) => {
    try {
      setIsDetecting(true);
      setDetectionResult(null);

      // Zde by byla implementace AI detekce mincí
      // Například pomocí TensorFlow.js nebo externího API
      
      // Simulace detekce
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockResult = {
        detected: true,
        confidence: 0.85,
        coinType: 'unknown',
        diameter: 24.5,
        boundingBox: {
          x: 100,
          y: 150,
          width: 200,
          height: 200
        },
        features: {
          hasText: true,
          hasSymbols: true,
          edgeType: 'smooth',
          color: 'copper'
        }
      };

      setDetectionResult(mockResult);
      return mockResult;

    } catch (error) {
      console.error('Coin detection error:', error);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const resetDetection = useCallback(() => {
    setDetectionResult(null);
  }, []);

  return {
    isDetecting,
    detectionResult,
    detectCoin,
    resetDetection
  };
};

// Hook pro správu fotografií mincí
export const useCoinPhotos = () => {
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const addPhoto = useCallback((uri: string) => {
    setPhotos(prev => [...prev, uri]);
  }, []);

  const removePhoto = useCallback((uri: string) => {
    setPhotos(prev => prev.filter(photo => photo !== uri));
  }, []);

  const uploadPhotos = useCallback(async (coinId: string) => {
    if (photos.length === 0) return [];

    try {
      setIsUploading(true);
      
      const uploadPromises = photos.map(async (uri, index) => {
        // Zde by byla implementace uploadu na server
        // Například do Supabase Storage
        
        const formData = new FormData();
        formData.append('file', {
          uri,
          type: 'image/jpeg',
          name: `coin_${coinId}_${index}.jpg`
        } as any);

        // Simulace uploadu
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return `https://storage.example.com/coins/${coinId}_${index}.jpg`;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      return uploadedUrls;

    } catch (error) {
      console.error('Photo upload error:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [photos]);

  const clearPhotos = useCallback(() => {
    setPhotos([]);
  }, []);

  return {
    photos,
    isUploading,
    addPhoto,
    removePhoto,
    uploadPhotos,
    clearPhotos
  };
};