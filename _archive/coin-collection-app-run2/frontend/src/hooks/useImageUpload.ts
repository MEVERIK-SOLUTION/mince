import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { imageApi } from '../services/imageApi';
import { validateImages } from '../utils/validators';
import { CoinImage, ImageUploadData } from '../types/coin';

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  result?: CoinImage;
}

export interface UseImageUploadOptions {
  coinId?: number;
  onSuccess?: (images: CoinImage[]) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
}

/**
 * Hook pro upload obrázků s progress tracking
 */
export const useImageUpload = (options: UseImageUploadOptions = {}) => {
  const { coinId, onSuccess, onError, maxFiles = 10 } = options;
  const queryClient = useQueryClient();
  
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Mutation pro upload jednoho obrázku
  const uploadMutation = useMutation({
    mutationFn: (data: ImageUploadData) => imageApi.uploadImage(data),
    onSuccess: (result, variables) => {
      // Aktualizace progress
      setUploadProgress(prev => 
        prev.map(item => 
          item.file === variables.file 
            ? { ...item, status: 'success', progress: 100, result }
            : item
        )
      );

      // Invalidace cache pro obrázky mince
      if (coinId) {
        queryClient.invalidateQueries({ queryKey: ['coin', coinId] });
        queryClient.invalidateQueries({ queryKey: ['coin-images', coinId] });
      }
    },
    onError: (error: any, variables) => {
      const errorMessage = error.response?.data?.detail || 'Chyba při uploadu obrázku';
      
      setUploadProgress(prev => 
        prev.map(item => 
          item.file === variables.file 
            ? { ...item, status: 'error', error: errorMessage }
            : item
        )
      );
      
      onError?.(errorMessage);
    },
  });

  /**
   * Upload více souborů najednou
   */
  const uploadFiles = useCallback(async (files: File[]) => {
    // Validace souborů
    const validation = validateImages(files);
    if (!validation.isValid) {
      onError?.(validation.errors.join('\n'));
      return;
    }

    // Kontrola maximálního počtu souborů
    if (files.length > maxFiles) {
      onError?.(`Můžete nahrát maximálně ${maxFiles} souborů najednou`);
      return;
    }

    // Inicializace progress
    const initialProgress: UploadProgress[] = files.map(file => ({
      file,
      progress: 0,
      status: 'pending',
    }));
    
    setUploadProgress(initialProgress);

    // Upload souborů postupně
    const results: CoinImage[] = [];
    
    for (const file of files) {
      try {
        // Aktualizace statusu na uploading
        setUploadProgress(prev => 
          prev.map(item => 
            item.file === file 
              ? { ...item, status: 'uploading', progress: 0 }
              : item
          )
        );

        // Simulace progress (v reálné aplikaci by to bylo z XMLHttpRequest)
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => 
            prev.map(item => 
              item.file === file && item.status === 'uploading'
                ? { ...item, progress: Math.min(item.progress + 10, 90) }
                : item
            )
          );
        }, 100);

        // Upload souboru
        const result = await uploadMutation.mutateAsync({
          file,
          coinId,
          imageType: 'other', // Default typ, uživatel může změnit později
        });

        clearInterval(progressInterval);
        results.push(result);

      } catch (error) {
        // Chyba je už zpracována v onError mutation
        console.error('Upload error:', error);
      }
    }

    // Callback po dokončení všech uploadů
    if (results.length > 0) {
      onSuccess?.(results);
    }

    // Vyčištění progress po 3 sekundách
    setTimeout(() => {
      setUploadProgress([]);
    }, 3000);

  }, [uploadMutation, coinId, onSuccess, onError, maxFiles]);

  /**
   * Upload z drag & drop
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      uploadFiles(imageFiles);
    }
  }, [uploadFiles]);

  /**
   * Upload z file input
   */
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
    // Reset input
    e.target.value = '';
  }, [uploadFiles]);

  /**
   * Drag over handler
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  /**
   * Drag leave handler
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  /**
   * Zrušení uploadu
   */
  const cancelUpload = useCallback((file: File) => {
    setUploadProgress(prev => prev.filter(item => item.file !== file));
  }, []);

  /**
   * Vyčištění všech uploadů
   */
  const clearUploads = useCallback(() => {
    setUploadProgress([]);
  }, []);

  /**
   * Retry failed upload
   */
  const retryUpload = useCallback((file: File) => {
    uploadFiles([file]);
  }, [uploadFiles]);

  // Computed values
  const isUploading = uploadProgress.some(item => item.status === 'uploading');
  const hasErrors = uploadProgress.some(item => item.status === 'error');
  const successCount = uploadProgress.filter(item => item.status === 'success').length;
  const totalFiles = uploadProgress.length;
  const overallProgress = totalFiles > 0 
    ? uploadProgress.reduce((sum, item) => sum + item.progress, 0) / totalFiles 
    : 0;

  return {
    // State
    uploadProgress,
    isDragOver,
    isUploading,
    hasErrors,
    successCount,
    totalFiles,
    overallProgress,

    // Actions
    uploadFiles,
    handleDrop,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    cancelUpload,
    clearUploads,
    retryUpload,
  };
};

/**
 * Hook pro správu obrázků mince
 */
export const useCoinImages = (coinId: number | null) => {
  const queryClient = useQueryClient();

  // Načítání obrázků
  const { data: images, isLoading } = useQuery({
    queryKey: ['coin-images', coinId],
    queryFn: () => imageApi.getCoinImages(coinId!),
    enabled: !!coinId,
    staleTime: 5 * 60 * 1000,
  });

  // Aktualizace obrázku
  const updateImageMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CoinImage> }) =>
      imageApi.updateImage(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coin-images', coinId] });
      if (coinId) {
        queryClient.invalidateQueries({ queryKey: ['coin', coinId] });
      }
    },
  });

  // Smazání obrázku
  const deleteImageMutation = useMutation({
    mutationFn: (imageId: number) => imageApi.deleteImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coin-images', coinId] });
      if (coinId) {
        queryClient.invalidateQueries({ queryKey: ['coin', coinId] });
      }
    },
  });

  // Nastavení hlavního obrázku
  const setMainImageMutation = useMutation({
    mutationFn: (imageId: number) => imageApi.setMainImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coin-images', coinId] });
      if (coinId) {
        queryClient.invalidateQueries({ queryKey: ['coin', coinId] });
      }
    },
  });

  return {
    images: images || [],
    isLoading,
    updateImage: updateImageMutation.mutate,
    deleteImage: deleteImageMutation.mutate,
    setMainImage: setMainImageMutation.mutate,
    isUpdating: updateImageMutation.isPending,
    isDeleting: deleteImageMutation.isPending,
    isSettingMain: setMainImageMutation.isPending,
  };
};

/**
 * Hook pro preview obrázků před uploadem
 */
export const useImagePreview = () => {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);

  const createPreviews = useCallback((files: File[]) => {
    // Vyčištění starých preview
    previews.forEach(preview => URL.revokeObjectURL(preview.url));

    // Vytvoření nových preview
    const newPreviews = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setPreviews(newPreviews);
  }, [previews]);

  const clearPreviews = useCallback(() => {
    previews.forEach(preview => URL.revokeObjectURL(preview.url));
    setPreviews([]);
  }, [previews]);

  const removePreview = useCallback((file: File) => {
    setPreviews(prev => {
      const updated = prev.filter(preview => preview.file !== file);
      // Revoke URL for removed preview
      const removed = prev.find(preview => preview.file === file);
      if (removed) {
        URL.revokeObjectURL(removed.url);
      }
      return updated;
    });
  }, []);

  // Cleanup při unmount
  useEffect(() => {
    return () => {
      previews.forEach(preview => URL.revokeObjectURL(preview.url));
    };
  }, []);

  return {
    previews,
    createPreviews,
    clearPreviews,
    removePreview,
  };
};