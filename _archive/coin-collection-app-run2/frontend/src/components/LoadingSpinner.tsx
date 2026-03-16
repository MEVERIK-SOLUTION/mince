import React from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Skeleton,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

interface LoadingSpinnerProps {
  size?: number | string;
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'inherit';
  message?: string;
  fullScreen?: boolean;
  sx?: SxProps<Theme>;
}

interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
  backdrop?: boolean;
}

interface SkeletonLoaderProps {
  type: 'coin-card' | 'coin-list' | 'coin-detail' | 'collection-card' | 'image-gallery' | 'table';
  count?: number;
  height?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 40,
  color = 'primary',
  message,
  fullScreen = false,
  sx,
}) => {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        ...sx,
      }}
    >
      <CircularProgress size={size} color={color} />
      {message && (
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {message}
        </Typography>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          zIndex: 9999,
        }}
      >
        {content}
      </Box>
    );
  }

  return content;
};

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  loading,
  children,
  message = 'Načítání...',
  backdrop = true,
}) => {
  return (
    <Box sx={{ position: 'relative' }}>
      {children}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: backdrop ? 'rgba(255, 255, 255, 0.8)' : 'transparent',
            zIndex: 1,
            borderRadius: 'inherit',
          }}
        >
          <LoadingSpinner message={message} />
        </Box>
      )}
    </Box>
  );
};

export const ProgressBar: React.FC<{
  value?: number;
  message?: string;
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
}> = ({ value, message, color = 'primary' }) => {
  return (
    <Box sx={{ width: '100%' }}>
      {message && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {message}
        </Typography>
      )}
      <LinearProgress
        variant={value !== undefined ? 'determinate' : 'indeterminate'}
        value={value}
        color={color}
        sx={{ height: 8, borderRadius: 4 }}
      />
      {value !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {Math.round(value)}%
        </Typography>
      )}
    </Box>
  );
};

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type,
  count = 1,
  height,
}) => {
  const renderCoinCardSkeleton = () => (
    <Card sx={{ maxWidth: 300 }}>
      <Skeleton variant="rectangular" width="100%" height={200} />
      <CardContent>
        <Skeleton variant="text" width="80%" height={32} />
        <Box sx={{ display: 'flex', gap: 1, my: 1 }}>
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={50} height={24} />
          <Skeleton variant="rounded" width={40} height={24} />
        </Box>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" height={28} />
      </CardContent>
    </Card>
  );

  const renderCoinListSkeleton = () => (
    <Card sx={{ display: 'flex', height: 120 }}>
      <Skeleton variant="rectangular" width={120} height={120} />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, p: 2 }}>
        <Skeleton variant="text" width="70%" height={28} />
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="text" width="30%" />
        <Box sx={{ mt: 'auto' }}>
          <Skeleton variant="text" width="40%" height={24} />
        </Box>
      </Box>
    </Card>
  );

  const renderCoinDetailSkeleton = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Grid>
      <Grid item xs={12} md={6}>
        <Skeleton variant="text" width="80%" height={40} />
        <Box sx={{ my: 2 }}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="text" width="40%" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
          <Skeleton variant="rounded" width={80} height={32} />
          <Skeleton variant="rounded" width={60} height={32} />
          <Skeleton variant="rounded" width={70} height={32} />
        </Box>
        <Skeleton variant="rectangular" width="100%" height={120} />
      </Grid>
    </Grid>
  );

  const renderCollectionCardSkeleton = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Skeleton variant="text" width="60%" height={28} />
          <Skeleton variant="circular" width={24} height={24} />
        </Box>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="70%" />
        <Box sx={{ display: 'flex', gap: 1, my: 2 }}>
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={50} height={24} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Box>
            <Skeleton variant="text" width={40} />
            <Skeleton variant="text" width={60} height={28} />
          </Box>
          <Box>
            <Skeleton variant="text" width={50} />
            <Skeleton variant="text" width={80} height={28} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderImageGallerySkeleton = () => (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, index) => (
        <Grid item xs={6} sm={4} md={3} key={index}>
          <Card>
            <Skeleton variant="rectangular" width="100%" height={200} />
            <CardContent sx={{ p: 1 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderTableSkeleton = () => (
    <Paper sx={{ p: 2 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index} sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="50%" />
          </Box>
          <Skeleton variant="text" width="20%" />
        </Box>
      ))}
    </Paper>
  );

  const renderSkeleton = () => {
    switch (type) {
      case 'coin-card':
        return renderCoinCardSkeleton();
      case 'coin-list':
        return renderCoinListSkeleton();
      case 'coin-detail':
        return renderCoinDetailSkeleton();
      case 'collection-card':
        return renderCollectionCardSkeleton();
      case 'image-gallery':
        return renderImageGallerySkeleton();
      case 'table':
        return renderTableSkeleton();
      default:
        return <Skeleton variant="rectangular" width="100%" height={height || 200} />;
    }
  };

  if (type === 'image-gallery' || type === 'table' || type === 'coin-detail') {
    return renderSkeleton();
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index}>
          {renderSkeleton()}
        </Box>
      ))}
    </Box>
  );
};

export const LoadingButton: React.FC<{
  loading: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  fullWidth?: boolean;
  sx?: SxProps<Theme>;
}> = ({
  loading,
  children,
  onClick,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  disabled = false,
  startIcon,
  endIcon,
  fullWidth = false,
  sx,
}) => {
  return (
    <Box sx={{ position: 'relative', display: fullWidth ? 'block' : 'inline-block' }}>
      <Button
        variant={variant}
        color={color}
        size={size}
        onClick={onClick}
        disabled={disabled || loading}
        startIcon={!loading ? startIcon : undefined}
        endIcon={!loading ? endIcon : undefined}
        fullWidth={fullWidth}
        sx={sx}
      >
        {children}
      </Button>
      {loading && (
        <CircularProgress
          size={20}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-10px',
            marginLeft: '-10px',
          }}
        />
      )}
    </Box>
  );
};

export const InlineLoader: React.FC<{
  message?: string;
  size?: 'small' | 'medium' | 'large';
}> = ({ message = 'Načítání...', size = 'medium' }) => {
  const sizeMap = {
    small: 16,
    medium: 20,
    large: 24,
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1,
      }}
    >
      <CircularProgress size={sizeMap[size]} />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

export const LazyLoadWrapper: React.FC<{
  children: React.ReactNode;
  loading: boolean;
  error?: string | null;
  retry?: () => void;
  skeleton?: React.ReactNode;
  minHeight?: number;
}> = ({
  children,
  loading,
  error,
  retry,
  skeleton,
  minHeight = 200,
}) => {
  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight,
          p: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" color="error" gutterBottom>
          Chyba při načítání
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {error}
        </Typography>
        {retry && (
          <Button onClick={retry} variant="outlined" sx={{ mt: 2 }}>
            Zkusit znovu
          </Button>
        )}
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ minHeight }}>
        {skeleton || <LoadingSpinner message="Načítání..." />}
      </Box>
    );
  }

  return <>{children}</>;
};

export default LoadingSpinner;