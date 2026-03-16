import React, { useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Alert,
  Chip,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useImageUpload, useImagePreview } from '../hooks/useImageUpload';
import { IMAGE_TYPE_LABELS, IMAGE_TYPES } from '../utils/constants';
import { formatFileSize } from '../utils/formatters';
import { CoinImage } from '../types/coin';

interface ImageUploadProps {
  coinId?: number;
  onSuccess?: (images: CoinImage[]) => void;
  onError?: (error: string) => void;
  maxFiles?: number;
  disabled?: boolean;
  existingImages?: CoinImage[];
}

interface ImagePreviewProps {
  file: File;
  url: string;
  onRemove: () => void;
  onEdit: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ file, url, onRemove, onEdit }) => {
  return (
    <Card sx={{ maxWidth: 200, position: 'relative' }}>
      <CardMedia
        component="img"
        height="140"
        image={url}
        alt={file.name}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ p: 1 }}>
        <Typography variant="caption" noWrap title={file.name}>
          {file.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          {formatFileSize(file.size)}
        </Typography>
      </CardContent>
      <CardActions sx={{ p: 1, pt: 0 }}>
        <IconButton size="small" onClick={onEdit}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onRemove} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </CardActions>
    </Card>
  );
};

interface ImageEditDialogProps {
  open: boolean;
  file: File | null;
  imageUrl: string;
  onClose: () => void;
  onSave: (data: { imageType: string; description: string }) => void;
}

const ImageEditDialog: React.FC<ImageEditDialogProps> = ({
  open,
  file,
  imageUrl,
  onClose,
  onSave,
}) => {
  const [imageType, setImageType] = useState<string>('other');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    onSave({ imageType, description });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Upravit obrázek
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {imageUrl && (
          <Box sx={{ mb: 2, textAlign: 'center' }}>
            <img
              src={imageUrl}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: 200,
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />
          </Box>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Typ obrázku</InputLabel>
              <Select
                value={imageType}
                label="Typ obrázku"
                onChange={(e) => setImageType(e.target.value)}
              >
                {IMAGE_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {IMAGE_TYPE_LABELS[type]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Popis obrázku"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              placeholder="Volitelný popis obrázku..."
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button onClick={handleSave} variant="contained">
          Uložit
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ImageUpload: React.FC<ImageUploadProps> = ({
  coinId,
  onSuccess,
  onError,
  maxFiles = 10,
  disabled = false,
  existingImages = [],
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingImage, setEditingImage] = useState<{ file: File; url: string } | null>(null);

  const {
    uploadProgress,
    isDragOver,
    isUploading,
    hasErrors,
    successCount,
    totalFiles,
    overallProgress,
    uploadFiles,
    handleDrop,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    cancelUpload,
    clearUploads,
    retryUpload,
  } = useImageUpload({
    coinId,
    onSuccess,
    onError,
    maxFiles,
  });

  const {
    previews,
    createPreviews,
    clearPreviews,
    removePreview,
  } = useImagePreview();

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      createPreviews(files);
    }
    handleFileSelect(event);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUploadPreviews = () => {
    const files = previews.map(p => p.file);
    uploadFiles(files);
    clearPreviews();
  };

  const handleEditImage = (file: File, url: string) => {
    setEditingImage({ file, url });
  };

  const handleSaveImageEdit = (data: { imageType: string; description: string }) => {
    // Zde by se mohly uložit metadata obrázku
    console.log('Saving image metadata:', data);
  };

  const canUploadMore = existingImages.length + previews.length < maxFiles;

  return (
    <Box>
      {/* Upload Area */}
      <Paper
        sx={{
          p: 3,
          border: '2px dashed',
          borderColor: isDragOver ? 'primary.main' : 'grey.300',
          bgcolor: isDragOver ? 'primary.50' : 'background.paper',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease-in-out',
          opacity: disabled ? 0.6 : 1,
        }}
        onDrop={disabled ? undefined : handleDrop}
        onDragOver={disabled ? undefined : handleDragOver}
        onDragLeave={disabled ? undefined : handleDragLeave}
        onClick={disabled || !canUploadMore ? undefined : handleUploadClick}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CloudUploadIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          
          <Typography variant="h6" gutterBottom>
            {isDragOver ? 'Pusťte soubory zde' : 'Přetáhněte obrázky nebo klikněte pro výběr'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Podporované formáty: JPEG, PNG, WebP (max. 10 MB)
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            Můžete nahrát až {maxFiles} obrázků
            {existingImages.length > 0 && ` (${existingImages.length} již nahráno)`}
          </Typography>

          {!canUploadMore && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Dosáhli jste maximálního počtu obrázků ({maxFiles})
            </Alert>
          )}
        </Box>
      </Paper>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
        disabled={disabled || !canUploadMore}
      />

      {/* Preview Section */}
      {previews.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Náhled obrázků ({previews.length})
            </Typography>
            <Box>
              <Button
                variant="outlined"
                onClick={clearPreviews}
                sx={{ mr: 1 }}
              >
                Vymazat vše
              </Button>
              <Button
                variant="contained"
                onClick={handleUploadPreviews}
                disabled={isUploading}
              >
                Nahrát obrázky
              </Button>
            </Box>
          </Box>

          <Grid container spacing={2}>
            {previews.map((preview, index) => (
              <Grid item key={index}>
                <ImagePreview
                  file={preview.file}
                  url={preview.url}
                  onRemove={() => removePreview(preview.file)}
                  onEdit={() => handleEditImage(preview.file, preview.url)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Průběh nahrávání
          </Typography>

          {/* Overall Progress */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                Celkový průběh ({successCount}/{totalFiles})
              </Typography>
              <Typography variant="body2">
                {Math.round(overallProgress)}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={overallProgress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {/* Individual File Progress */}
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {uploadProgress.map((item, index) => (
              <Box key={index} sx={{ mb: 2, p: 2, border: 1, borderColor: 'grey.200', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" noWrap sx={{ flex: 1, mr: 2 }}>
                    {item.file.name}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={item.status}
                      size="small"
                      color={
                        item.status === 'success' ? 'success' :
                        item.status === 'error' ? 'error' :
                        item.status === 'uploading' ? 'primary' : 'default'
                      }
                    />
                    
                    {item.status === 'error' && (
                      <IconButton size="small" onClick={() => retryUpload(item.file)}>
                        <RefreshIcon />
                      </IconButton>
                    )}
                    
                    {item.status !== 'success' && (
                      <IconButton size="small" onClick={() => cancelUpload(item.file)}>
                        <CloseIcon />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {item.status === 'uploading' && (
                  <LinearProgress 
                    variant="determinate" 
                    value={item.progress}
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                )}

                {item.error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {item.error}
                  </Alert>
                )}
              </Box>
            ))}
          </Box>

          {/* Action Buttons */}
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={clearUploads}
              disabled={isUploading}
            >
              Vymazat seznam
            </Button>
            
            {hasErrors && (
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  const failedFiles = uploadProgress
                    .filter(item => item.status === 'error')
                    .map(item => item.file);
                  uploadFiles(failedFiles);
                }}
              >
                Opakovat chybné
              </Button>
            )}
          </Box>
        </Box>
      )}

      {/* Existing Images */}
      {existingImages.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Nahrané obrázky ({existingImages.length})
          </Typography>
          
          <Grid container spacing={2}>
            {existingImages.map((image) => (
              <Grid item key={image.id}>
                <Card sx={{ maxWidth: 200 }}>
                  <CardMedia
                    component="img"
                    height="140"
                    image={image.image_path}
                    alt={image.description || 'Coin image'}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ p: 1 }}>
                    <Typography variant="caption">
                      {IMAGE_TYPE_LABELS[image.image_type as keyof typeof IMAGE_TYPE_LABELS]}
                    </Typography>
                    {image.description && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {image.description}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Image Edit Dialog */}
      <ImageEditDialog
        open={!!editingImage}
        file={editingImage?.file || null}
        imageUrl={editingImage?.url || ''}
        onClose={() => setEditingImage(null)}
        onSave={handleSaveImageEdit}
      />
    </Box>
  );
};

export default ImageUpload;