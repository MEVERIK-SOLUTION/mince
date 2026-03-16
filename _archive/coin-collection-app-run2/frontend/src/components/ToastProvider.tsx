import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  IconButton,
  Box,
  Slide,
  Fade,
  Grow,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { TransitionProps } from '@mui/material/transitions';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type ToastTransition = 'slide' | 'fade' | 'grow';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => string;
  hideToast: (id: string) => void;
  hideAllToasts: () => void;
  success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => string;
  error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => string;
  warning: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => string;
  info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
  defaultDuration?: number;
  position?: ToastPosition;
  transition?: ToastTransition;
}

const SlideTransition = (props: TransitionProps & { children: React.ReactElement }) => {
  return <Slide {...props} direction="left" />;
};

const FadeTransition = (props: TransitionProps & { children: React.ReactElement }) => {
  return <Fade {...props} />;
};

const GrowTransition = (props: TransitionProps & { children: React.ReactElement }) => {
  return <Grow {...props} />;
};

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5,
  defaultDuration = 4000,
  position = 'bottom-right',
  transition = 'slide',
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const getTransitionComponent = () => {
    switch (transition) {
      case 'fade':
        return FadeTransition;
      case 'grow':
        return GrowTransition;
      case 'slide':
      default:
        return SlideTransition;
    }
  };

  const getAnchorOrigin = () => {
    const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
    return {
      vertical,
      horizontal,
    };
  };

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateId();
    const newToast: Toast = {
      id,
      duration: defaultDuration,
      ...toast,
    };

    setToasts(prev => {
      const updated = [...prev, newToast];
      // Limit number of toasts
      if (updated.length > maxToasts) {
        return updated.slice(-maxToasts);
      }
      return updated;
    });

    // Auto-hide toast if not persistent
    if (!newToast.persistent && newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, newToast.duration);
    }

    return id;
  }, [defaultDuration, maxToasts]);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const hideAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback((message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return showToast({ type: 'success', message, ...options });
  }, [showToast]);

  const error = useCallback((message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return showToast({ type: 'error', message, persistent: true, ...options });
  }, [showToast]);

  const warning = useCallback((message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return showToast({ type: 'warning', message, ...options });
  }, [showToast]);

  const info = useCallback((message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) => {
    return showToast({ type: 'info', message, ...options });
  }, [showToast]);

  const handleClose = (toast: Toast) => {
    if (toast.onClose) {
      toast.onClose();
    }
    hideToast(toast.id);
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon />;
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
      default:
        return null;
    }
  };

  const contextValue: ToastContextType = {
    showToast,
    hideToast,
    hideAllToasts,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Container */}
      <Box
        sx={{
          position: 'fixed',
          zIndex: 9999,
          pointerEvents: 'none',
          ...getAnchorOrigin(),
          ...(position.includes('top') ? { top: 24 } : { bottom: 24 }),
          ...(position.includes('left') ? { left: 24 } : 
              position.includes('right') ? { right: 24 } : 
              { left: '50%', transform: 'translateX(-50%)' }),
        }}
      >
        {toasts.map((toast, index) => (
          <Snackbar
            key={toast.id}
            open={true}
            anchorOrigin={getAnchorOrigin()}
            TransitionComponent={getTransitionComponent()}
            sx={{
              position: 'relative',
              pointerEvents: 'auto',
              mb: index > 0 ? 1 : 0,
              '& .MuiSnackbar-root': {
                position: 'relative',
              },
            }}
          >
            <Alert
              severity={toast.type}
              icon={getIcon(toast.type)}
              action={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {toast.action && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        toast.action!.onClick();
                        hideToast(toast.id);
                      }}
                    >
                      {toast.action.label}
                    </Button>
                  )}
                  <IconButton
                    size="small"
                    color="inherit"
                    onClick={() => handleClose(toast)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
              sx={{
                width: '100%',
                minWidth: 300,
                maxWidth: 500,
                '& .MuiAlert-message': {
                  width: '100%',
                },
              }}
            >
              {toast.title && <AlertTitle>{toast.title}</AlertTitle>}
              {toast.message}
            </Alert>
          </Snackbar>
        ))}
      </Box>
    </ToastContext.Provider>
  );
};

// Utility hooks for common toast patterns
export const useApiToast = () => {
  const toast = useToast();

  const apiSuccess = useCallback((message: string = 'Operace byla úspěšně dokončena') => {
    return toast.success(message);
  }, [toast]);

  const apiError = useCallback((error: any, defaultMessage: string = 'Došlo k chybě') => {
    const message = error?.response?.data?.detail || error?.message || defaultMessage;
    return toast.error(message, { persistent: true });
  }, [toast]);

  const apiLoading = useCallback((message: string = 'Zpracovávám...') => {
    return toast.info(message, { persistent: true });
  }, [toast]);

  return {
    apiSuccess,
    apiError,
    apiLoading,
    ...toast,
  };
};

export const useFormToast = () => {
  const toast = useToast();

  const validationError = useCallback((message: string = 'Zkontrolujte vyplněné údaje') => {
    return toast.warning(message);
  }, [toast]);

  const saveSuccess = useCallback((message: string = 'Změny byly uloženy') => {
    return toast.success(message);
  }, [toast]);

  const saveError = useCallback((error: any) => {
    const message = error?.response?.data?.detail || error?.message || 'Nepodařilo se uložit změny';
    return toast.error(message);
  }, [toast]);

  return {
    validationError,
    saveSuccess,
    saveError,
    ...toast,
  };
};

export const useUploadToast = () => {
  const toast = useToast();

  const uploadStart = useCallback((fileName: string) => {
    return toast.info(`Nahrávám soubor: ${fileName}`, { persistent: true });
  }, [toast]);

  const uploadSuccess = useCallback((fileName: string) => {
    return toast.success(`Soubor ${fileName} byl úspěšně nahrán`);
  }, [toast]);

  const uploadError = useCallback((fileName: string, error?: any) => {
    const message = error?.response?.data?.detail || error?.message || 'Chyba při nahrávání';
    return toast.error(`${fileName}: ${message}`);
  }, [toast]);

  const uploadProgress = useCallback((fileName: string, progress: number) => {
    return toast.info(`${fileName}: ${progress}% dokončeno`, { 
      persistent: true,
      duration: 1000,
    });
  }, [toast]);

  return {
    uploadStart,
    uploadSuccess,
    uploadError,
    uploadProgress,
    ...toast,
  };
};

// Toast notification component for manual use
interface ToastNotificationProps {
  open: boolean;
  type: ToastType;
  title?: string;
  message: string;
  onClose: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  position?: ToastPosition;
  transition?: ToastTransition;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  open,
  type,
  title,
  message,
  onClose,
  action,
  position = 'bottom-right',
  transition = 'slide',
}) => {
  const getTransitionComponent = () => {
    switch (transition) {
      case 'fade':
        return FadeTransition;
      case 'grow':
        return GrowTransition;
      case 'slide':
      default:
        return SlideTransition;
    }
  };

  const getAnchorOrigin = () => {
    const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
    return { vertical, horizontal };
  };

  return (
    <Snackbar
      open={open}
      onClose={onClose}
      anchorOrigin={getAnchorOrigin()}
      TransitionComponent={getTransitionComponent()}
    >
      <Alert
        severity={type}
        onClose={onClose}
        action={
          action && (
            <Button color="inherit" size="small" onClick={action.onClick}>
              {action.label}
            </Button>
          )
        }
      >
        {title && <AlertTitle>{title}</AlertTitle>}
        {message}
      </Alert>
    </Snackbar>
  );
};

export default ToastProvider;