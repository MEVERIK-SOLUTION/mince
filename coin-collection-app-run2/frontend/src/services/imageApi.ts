import { apiRequest } from './api';
import { CoinImage } from '../types/coin';

export interface ImageUploadData {
  file: File;
  coinId?: number;
  imageType: 'obverse' | 'reverse' | 'edge' | 'detail' | 'packaging' | 'certificate' | 'other';
  description?: string;
}

export const imageApi = {
  // Upload obrázku
  uploadImage: async (data: ImageUploadData): Promise<CoinImage> => {
    const formData = new FormData();
    formData.append('file', data.file);
    
    if (data.coinId) {
      formData.append('coin_id', data.coinId.toString());
    }
    
    formData.append('image_type', data.imageType);
    
    if (data.description) {
      formData.append('description', data.description);
    }

    const response = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  },

  // Získání obrázků mince
  getCoinImages: async (coinId: number): Promise<CoinImage[]> => {
    return apiRequest.get<CoinImage[]>(`/api/coins/${coinId}/images`);
  },

  // Získání detailu obrázku
  getImage: async (id: number): Promise<CoinImage> => {
    return apiRequest.get<CoinImage>(`/api/images/${id}`);
  },

  // Aktualizace obrázku
  updateImage: async (id: number, data: Partial<CoinImage>): Promise<CoinImage> => {
    return apiRequest.put<CoinImage>(`/api/images/${id}`, data);
  },

  // Smazání obrázku
  deleteImage: async (id: number): Promise<{ message: string }> => {
    return apiRequest.delete<{ message: string }>(`/api/images/${id}`);
  },

  // Nastavení hlavního obrázku
  setMainImage: async (imageId: number): Promise<{ message: string }> => {
    return apiRequest.post<{ message: string }>(`/api/images/${imageId}/set-main`, {});
  },

  // Bulk upload obrázků
  uploadMultipleImages: async (
    files: File[],
    coinId?: number
  ): Promise<CoinImage[]> => {
    const formData = new FormData();
    
    files.forEach((file, index) => {
      formData.append(`files`, file);
    });
    
    if (coinId) {
      formData.append('coin_id', coinId.toString());
    }

    const response = await fetch('/api/images/upload-multiple', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Bulk upload failed');
    }

    return response.json();
  },

  // Změna pořadí obrázků
  reorderImages: async (
    coinId: number,
    imageIds: number[]
  ): Promise<{ message: string }> => {
    return apiRequest.post<{ message: string }>(`/api/coins/${coinId}/images/reorder`, {
      image_ids: imageIds,
    });
  },

  // Optimalizace obrázku
  optimizeImage: async (imageId: number): Promise<CoinImage> => {
    return apiRequest.post<CoinImage>(`/api/images/${imageId}/optimize`, {});
  },

  // Generování thumbnailů
  generateThumbnails: async (imageId: number): Promise<{ message: string }> => {
    return apiRequest.post<{ message: string }>(`/api/images/${imageId}/thumbnails`, {});
  },

  // Získání URL pro různé velikosti obrázku
  getImageUrl: (imagePath: string, size: 'thumbnail' | 'medium' | 'large' | 'original' = 'medium'): string => {
    if (!imagePath) return '';
    
    // Pokud už je to plná URL, vrátíme jak je
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }

    // Přidáme size parameter
    const baseUrl = process.env.REACT_APP_API_URL || '';
    return `${baseUrl}/api/images/serve/${imagePath}?size=${size}`;
  },

  // Stažení obrázku
  downloadImage: async (imageId: number): Promise<Blob> => {
    const response = await fetch(`/api/images/${imageId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return response.blob();
  },
};

export default imageApi;