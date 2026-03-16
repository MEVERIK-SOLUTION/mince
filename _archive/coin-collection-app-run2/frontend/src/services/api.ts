import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ApiError, ToastMessage } from '../types/api';

// Konfigurace API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Vytvoření axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Přidání auth tokenu pokud existuje
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Logging pro development
    if (import.meta.env.DEV) {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Logging pro development
    if (import.meta.env.DEV) {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    }
    
    return response;
  },
  (error: AxiosError) => {
    // Logging pro development
    if (import.meta.env.DEV) {
      console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`, error);
    }
    
    // Zpracování různých typů chyb
    if (error.response?.status === 401) {
      // Unauthorized - vymazání tokenu a přesměrování na login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    
    // Transformace chyby do standardního formátu
    const apiError: ApiError = {
      detail: error.response?.data?.detail || error.message || 'Neočekávaná chyba',
      status_code: error.response?.status || 500,
    };
    
    return Promise.reject(apiError);
  }
);

// Utility funkce pro API volání
export const apiRequest = {
  get: <T>(url: string, params?: any): Promise<T> => 
    apiClient.get(url, { params }).then(response => response.data),
    
  post: <T>(url: string, data?: any): Promise<T> => 
    apiClient.post(url, data).then(response => response.data),
    
  put: <T>(url: string, data?: any): Promise<T> => 
    apiClient.put(url, data).then(response => response.data),
    
  delete: <T>(url: string): Promise<T> => 
    apiClient.delete(url).then(response => response.data),
    
  patch: <T>(url: string, data?: any): Promise<T> => 
    apiClient.patch(url, data).then(response => response.data),
};

// Utility pro upload souborů
export const uploadFile = async (
  url: string,
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<any> => {
  return apiClient.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  }).then(response => response.data);
};

// Utility pro stažení souborů
export const downloadFile = async (url: string, filename: string): Promise<void> => {
  const response = await apiClient.get(url, {
    responseType: 'blob',
  });
  
  const blob = new Blob([response.data]);
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
};

// Error handling utility
export const handleApiError = (error: ApiError): ToastMessage => {
  let title = 'Chyba';
  let message = error.detail;
  
  switch (error.status_code) {
    case 400:
      title = 'Neplatné údaje';
      break;
    case 401:
      title = 'Neautorizovaný přístup';
      message = 'Přihlaste se prosím znovu';
      break;
    case 403:
      title = 'Zakázaný přístup';
      message = 'Nemáte oprávnění k této akci';
      break;
    case 404:
      title = 'Nenalezeno';
      message = 'Požadovaný zdroj nebyl nalezen';
      break;
    case 422:
      title = 'Chyba validace';
      break;
    case 500:
      title = 'Chyba serveru';
      message = 'Zkuste to prosím později';
      break;
    default:
      title = 'Neočekávaná chyba';
  }
  
  return {
    id: Date.now().toString(),
    type: 'error',
    title,
    message,
    duration: 5000,
  };
};

// Health check
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    await apiRequest.get('/api/health');
    return true;
  } catch (error) {
    return false;
  }
};

export default apiClient;