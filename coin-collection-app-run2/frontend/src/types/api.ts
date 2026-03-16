export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: 'success' | 'error';
}

export interface ApiError {
  detail: string;
  status_code: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ImageUploadResponse {
  id: number;
  coin_id: number;
  image_type: string;
  file_path: string;
  file_size: number;
  width?: number;
  height?: number;
  is_primary: boolean;
  uploaded_at: string;
  message: string;
}

export interface BulkUploadResponse {
  message: string;
  uploaded: Array<{
    filename: string;
    type: string;
    size: number;
  }>;
  errors: string[];
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Query parameters pro API volání
export interface CoinQueryParams {
  skip?: number;
  limit?: number;
  search?: string;
  country?: string;
  coin_type?: string;
  year_from?: number;
  year_to?: number;
}

export interface CollectionQueryParams {
  skip?: number;
  limit?: number;
  condition?: string;
  min_value?: number;
  max_value?: number;
}

// Loading states
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

export interface AsyncState<T> extends LoadingState {
  data: T | null;
}

// Toast notification types
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// Form validation
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState<T> {
  data: T;
  errors: ValidationError[];
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
}