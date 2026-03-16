import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
  Skeleton,
  Alert,
  Fab,
  Zoom,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateLeft as RotateLeftIcon,
  RotateRight as RotateRightIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Fullscreen as FullscreenIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { CoinImage } from '../types/coin';
import { IMAGE_TYPE_LABELS } from '../utils/constants';
import { imageApi } from '../services/imageApi';

interface ImageGalleryProps {
  images: CoinImage[];
  onImageUpdate?: (imageId: number, data: Partial<CoinImage>) => void;
  onImageDelete?: (imageId: number) => void;
  onSetMainImage?: (imageId: number) => void;
  editable?: boolean;
  showImageTypes?: boolean;
  maxHeight?: number;
  columns?: { xs: number; sm: number; md: number; lg: number };
}

interface ImageViewerProps {
  images: CoinImage[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  images,
  currentIndex,
  open,
  onClose,
  onNavigate,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const currentImage = images[currentIndex];

  const handlePrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    onNavigate(newIndex);
    setZoom(1);
    setRotation(0);
  };

  const handleNext = () => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    onNavigate(newIndex);
    setZoom(1);
    setRotation(0);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      handlePrevious();
    } else if (event.key === 'ArrowRight') {
      handleNext();
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  const handleDownload = async () => {
    if (currentImage) {
      try {
        const blob = await imageApi.downloadImage(currentImage.id);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `coin-image-${currentImage.id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  };

  if (!currentImage) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: 'black',
          color: 'white',
          maxHeight: '95vh',
          maxWidth: '95vw',
        },
      }}
      onKeyDown={handleKeyPress}
    >
      <DialogContent sx={{ p: 0, position: 'relative', overflow: 'hidden' }}>
        {/* Header */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ color: 'white' }}>
              {currentImage.description || IMAGE_TYPE_LABELS[currentImage.image_type as keyof typeof IMAGE_TYPE_LABELS]}
            </Typography>
            <Typography variant="body2" sx={{ color: 'grey.300' }}>
              {currentIndex + 1} z {images.length}
            </Typography>
          </Box>

          <Box>
            <IconButton onClick={handleDownload} sx={{ color: 'white' }}>
              <DownloadIcon />
            </IconButton>
            <IconButton onClick={onClose} sx={{ color: 'white' }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Image */}
        <Box
          sx={{
            height: isMobile ? '100vh' : '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
            doubleClick={{ mode: 'reset' }}
          >
            <TransformComponent
              wrapperStyle={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={imageApi.getImageUrl(currentImage.image_path, 'large')}
                alt={currentImage.description || 'Coin image'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.3s ease',
                }}
              />
            </TransformComponent>
          </TransformWrapper>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <IconButton
                onClick={handlePrevious}
                sx={{
                  position: 'absolute',
                  left: 16,
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <NavigateBeforeIcon />
              </IconButton>
              
              <IconButton
                onClick={handleNext}
                sx={{
                  position: 'absolute',
                  right: 16,
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <NavigateNextIcon />
              </IconButton>
            </>
          )}
        </Box>

        {/* Controls */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
            p: 2,
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
          }}
        >
          <IconButton
            onClick={() => setRotation(r => r - 90)}
            sx={{ color: 'white' }}
          >
            <RotateLeftIcon />
          </IconButton>
          
          <IconButton
            onClick={() => setRotation(r => r + 90)}
            sx={{ color: 'white' }}
          >
            <RotateRightIcon />
          </IconButton>
        </Box>

        {/* Thumbnails */}
        {images.length > 1 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 1,
              p: 1,
              bgcolor: 'rgba(0,0,0,0.5)',
              borderRadius: 1,
              maxWidth: '90%',
              overflowX: 'auto',
            }}
          >
            {images.map((image, index) => (
              <Box
                key={image.id}
                onClick={() => onNavigate(index)}
                sx={{
                  width: 60,
                  height: 60,
                  cursor: 'pointer',
                  border: index === currentIndex ? 2 : 1,
                  borderColor: index === currentIndex ? 'primary.main' : 'grey.500',
                  borderRadius: 1,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img
                  src={imageApi.getImageUrl(image.image_path, 'thumbnail')}
                  alt=""
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  onImageUpdate,
  onImageDelete,
  onSetMainImage,
  editable = false,
  showImageTypes = true,
  maxHeight,
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; imageId: number } | null>(null);
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set());

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, imageId: number) => {
    event.stopPropagation();
    setMenuAnchor({ element: event.currentTarget, imageId });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleImageLoad = (imageId: number) => {
    setLoadingImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  };

  const handleImageError = (imageId: number) => {
    setLoadingImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
    setErrorImages(prev => new Set(prev).add(imageId));
  };

  const handleSetMainImage = (imageId: number) => {
    if (onSetMainImage) {
      onSetMainImage(imageId);
    }
    handleMenuClose();
  };

  const handleDeleteImage = (imageId: number) => {
    if (onImageDelete) {
      onImageDelete(imageId);
    }
    handleMenuClose();
  };

  if (images.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          color: 'text.secondary',
        }}
      >
        <PhotoCameraIcon sx={{ fontSize: 64, mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Žádné obrázky
        </Typography>
        <Typography variant="body2">
          Zatím nebyly nahrány žádné obrázky této mince.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {images.map((image, index) => {
          const isLoading = loadingImages.has(image.id);
          const hasError = errorImages.has(image.id);
          const isMainImage = image.is_main;

          return (
            <Grid item xs={columns.xs} sm={columns.sm} md={columns.md} lg={columns.lg} key={image.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  '&:hover': {
                    boxShadow: 4,
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s ease-in-out',
                  ...(maxHeight && { height: maxHeight }),
                }}
                onClick={() => handleImageClick(index)}
              >
                {/* Main Image Badge */}
                {isMainImage && (
                  <Chip
                    icon={<StarIcon />}
                    label="Hlavní"
                    size="small"
                    color="primary"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      zIndex: 1,
                    }}
                  />
                )}

                {/* Actions Menu */}
                {editable && (
                  <IconButton
                    onClick={(e) => handleMenuOpen(e, image.id)}
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      bgcolor: 'rgba(255,255,255,0.8)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                    }}
                    size="small"
                  >
                    <MoreVertIcon />
                  </IconButton>
                )}

                {/* Image */}
                <Box sx={{ position: 'relative' }}>
                  {isLoading && (
                    <Skeleton
                      variant="rectangular"
                      width="100%"
                      height={maxHeight ? maxHeight - 100 : 200}
                    />
                  )}
                  
                  {hasError ? (
                    <Box
                      sx={{
                        height: maxHeight ? maxHeight - 100 : 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'grey.100',
                        color: 'grey.500',
                      }}
                    >
                      <PhotoCameraIcon sx={{ fontSize: 48 }} />
                    </Box>
                  ) : (
                    <CardMedia
                      component="img"
                      height={maxHeight ? maxHeight - 100 : 200}
                      image={imageApi.getImageUrl(image.image_path, 'medium')}
                      alt={image.description || 'Coin image'}
                      onLoad={() => handleImageLoad(image.id)}
                      onError={() => handleImageError(image.id)}
                      sx={{
                        objectFit: 'cover',
                        display: isLoading ? 'none' : 'block',
                      }}
                    />
                  )}

                  {/* Zoom Overlay */}
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
                      bgcolor: 'rgba(0,0,0,0.5)',
                      opacity: 0,
                      transition: 'opacity 0.2s ease-in-out',
                      '&:hover': { opacity: 1 },
                    }}
                  >
                    <Fab size="small" color="primary">
                      <FullscreenIcon />
                    </Fab>
                  </Box>
                </Box>

                {/* Content */}
                <CardContent sx={{ p: 1 }}>
                  {showImageTypes && (
                    <Chip
                      label={IMAGE_TYPE_LABELS[image.image_type as keyof typeof IMAGE_TYPE_LABELS]}
                      size="small"
                      variant="outlined"
                      sx={{ mb: 1 }}
                    />
                  )}
                  
                  {image.description && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {image.description}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Image Viewer */}
      {selectedImageIndex !== null && (
        <ImageViewer
          images={images}
          currentIndex={selectedImageIndex}
          open={selectedImageIndex !== null}
          onClose={() => setSelectedImageIndex(null)}
          onNavigate={setSelectedImageIndex}
        />
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
      >
        {onSetMainImage && (
          <MenuItem onClick={() => handleSetMainImage(menuAnchor!.imageId)}>
            <StarIcon sx={{ mr: 1 }} />
            Nastavit jako hlavní
          </MenuItem>
        )}
        
        {onImageUpdate && (
          <MenuItem onClick={handleMenuClose}>
            <EditIcon sx={{ mr: 1 }} />
            Upravit
          </MenuItem>
        )}
        
        {onImageDelete && (
          <MenuItem 
            onClick={() => handleDeleteImage(menuAnchor!.imageId)}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1 }} />
            Smazat
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default ImageGallery;