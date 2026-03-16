import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  LinearProgress,
  Fab,
  Backdrop,
  CircularProgress,
  Grid,
  Paper,
  useTheme,
  useMediaQuery,
  Snackbar,
} from '@mui/material';
import {
  PhotoCamera as CameraIcon,
  FlipCameraIos as FlipIcon,
  Flash as FlashIcon,
  FlashOff as FlashOffIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as FocusIcon,
  GridOn as GridIcon,
  GridOff as GridOffIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface CoinData {
  country: string;
  denomination: string;
  year: number;
  material: string;
  condition: string;
  description: string;
  estimated_value: number;
}

interface MobileCoinCaptureProps {
  onCoinAdded?: (coin: CoinData & { images: string[] }) => void;
  collections: Array<{ id: number; name: string }>;
  selectedCollectionId?: number;
}

interface CameraConstraints {
  video: {
    facingMode: 'user' | 'environment';
    width?: { ideal: number };
    height?: { ideal: number };
  };
}

export const MobileCoinCapture: React.FC<MobileCoinCaptureProps> = ({
  onCoinAdded,
  collections,
  selectedCollectionId,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // State
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<Partial<CoinData> | null>(null);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [collectionId, setCollectionId] = useState(selectedCollectionId || 0);
  const [coinData, setCoinData] = useState<CoinData>({
    country: '',
    denomination: '',
    year: new Date().getFullYear(),
    material: '',
    condition: '',
    description: '',
    estimated_value: 0,
  });

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Inicializace kamery
  const initCamera = useCallback(async () => {
    try {
      setLoading(true);

      const constraints: CameraConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setSnackbar({
        open: true,
        message: 'Nepodařilo se spustit kameru. Zkontrolujte oprávnění.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [facingMode]);

  // Zastavení kamery
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Přepnutí kamery
  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopCamera]);

  // Zachycení fotografie
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Nastavení velikosti canvas podle videa
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Kreslení videa na canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Konverze na base64
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    
    setCapturedImages(prev => [...prev, imageData]);
    setCurrentImageIndex(capturedImages.length);

    setSnackbar({
      open: true,
      message: 'Fotografie zachycena!',
      severity: 'success',
    });

    // Automatická analýza první fotografie
    if (capturedImages.length === 0) {
      analyzeImage(imageData);
    }
  }, [capturedImages.length]);

  // Analýza obrázku pomocí AI
  const analyzeImage = useCallback(async (imageData: string) => {
    try {
      setAnalyzing(true);

      const response = await fetch('/api/coins/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          image_data: imageData,
          analysis_type: 'comprehensive',
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysisResult(result.analysis);
        
        // Předvyplnění formuláře
        setCoinData(prev => ({
          ...prev,
          ...result.analysis,
        }));

        setSnackbar({
          open: true,
          message: 'Mince byla automaticky rozpoznána!',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      setSnackbar({
        open: true,
        message: 'Nepodařilo se analyzovat obrázek',
        severity: 'warning',
      });
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // Smazání fotografie
  const deleteImage = useCallback((index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
    if (currentImageIndex >= index && currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  }, [currentImageIndex]);

  // Uložení mince
  const saveCoin = useCallback(async () => {
    if (!collectionId || capturedImages.length === 0) {
      setSnackbar({
        open: true,
        message: 'Vyberte kolekci a pořiďte alespoň jednu fotografii',
        severity: 'error',
      });
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      
      // Přidání dat mince
      Object.entries(coinData).forEach(([key, value]) => {
        formData.append(key, value.toString());
      });
      
      formData.append('collection_id', collectionId.toString());

      // Přidání obrázků
      capturedImages.forEach((imageData, index) => {
        const blob = dataURLtoBlob(imageData);
        formData.append(`image_${index}`, blob, `coin_${index}.jpg`);
      });

      const response = await fetch('/api/coins', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        
        setSnackbar({
          open: true,
          message: 'Mince byla úspěšně přidána!',
          severity: 'success',
        });

        onCoinAdded?.({
          ...coinData,
          images: capturedImages,
        });

        // Reset formuláře
        setCapturedImages([]);
        setCurrentImageIndex(0);
        setCoinData({
          country: '',
          denomination: '',
          year: new Date().getFullYear(),
          material: '',
          condition: '',
          description: '',
          estimated_value: 0,
        });
        setFormOpen(false);

        // Návrat na seznam kolekcí
        setTimeout(() => {
          navigate('/collections');
        }, 2000);
      }
    } catch (error) {
      console.error('Error saving coin:', error);
      setSnackbar({
        open: true,
        message: 'Chyba při ukládání mince',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [collectionId, capturedImages, coinData, onCoinAdded, navigate]);

  // Utility funkce pro konverzi dataURL na Blob
  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  // Spuštění kamery při načtení komponenty
  useEffect(() => {
    if (isMobile) {
      initCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isMobile, initCamera, stopCamera]);

  // Aktualizace kamery při změně facingMode
  useEffect(() => {
    if (cameraActive) {
      initCamera();
    }
  }, [facingMode, cameraActive, initCamera]);

  if (!isMobile) {
    return (
      <Alert severity="info">
        Tato funkce je dostupná pouze na mobilních zařízeních.
      </Alert>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Camera View */}
      <Box sx={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {loading && (
          <Backdrop open sx={{ zIndex: 1000 }}>
            <CircularProgress color="inherit" />
          </Backdrop>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          }}
        />

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Grid Overlay */}
        {gridEnabled && cameraActive && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              background: `
                linear-gradient(to right, transparent 32%, rgba(255,255,255,0.3) 33%, rgba(255,255,255,0.3) 34%, transparent 35%),
                linear-gradient(to right, transparent 65%, rgba(255,255,255,0.3) 66%, rgba(255,255,255,0.3) 67%, transparent 68%),
                linear-gradient(to bottom, transparent 32%, rgba(255,255,255,0.3) 33%, rgba(255,255,255,0.3) 34%, transparent 35%),
                linear-gradient(to bottom, transparent 65%, rgba(255,255,255,0.3) 66%, rgba(255,255,255,0.3) 67%, transparent 68%)
              `,
            }}
          />
        )}

        {/* Focus Circle */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 200,
            height: 200,
            border: '2px solid rgba(255,255,255,0.8)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />

        {/* Camera Controls */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <IconButton
            onClick={() => navigate(-1)}
            sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
          >
            <CloseIcon />
          </IconButton>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={() => setGridEnabled(!gridEnabled)}
              sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              {gridEnabled ? <GridOffIcon /> : <GridIcon />}
            </IconButton>

            <IconButton
              onClick={switchCamera}
              sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              <FlipIcon />
            </IconButton>

            <IconButton
              onClick={() => setFlashEnabled(!flashEnabled)}
              sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              {flashEnabled ? <FlashOffIcon /> : <FlashIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Analysis Indicator */}
        {analyzing && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              bgcolor: 'rgba(0,0,0,0.8)',
              color: 'white',
              p: 2,
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <CircularProgress size={24} sx={{ mb: 1, color: 'white' }} />
            <Typography variant="body2">Analyzuji minci...</Typography>
          </Box>
        )}
      </Box>

      {/* Bottom Controls */}
      <Box
        sx={{
          bgcolor: 'black',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Captured Images Preview */}
        <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
          {capturedImages.slice(-3).map((image, index) => (
            <Box
              key={index}
              sx={{
                width: 60,
                height: 60,
                borderRadius: 1,
                overflow: 'hidden',
                border: '2px solid white',
                cursor: 'pointer',
              }}
              onClick={() => setCurrentImageIndex(capturedImages.length - 3 + index)}
            >
              <img
                src={image}
                alt={`Captured ${index}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </Box>
          ))}
        </Box>

        {/* Capture Button */}
        <Fab
          color="primary"
          onClick={capturePhoto}
          disabled={!cameraActive}
          sx={{
            mx: 2,
            bgcolor: 'white',
            color: 'black',
            '&:hover': {
              bgcolor: 'grey.200',
            },
          }}
        >
          <CameraIcon />
        </Fab>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, flex: 1, justifyContent: 'flex-end' }}>
          {capturedImages.length > 0 && (
            <IconButton
              onClick={() => setFormOpen(true)}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              <CheckIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Coin Data Form Dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Údaje o minci</Typography>
            <IconButton onClick={() => setFormOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {analysisResult && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Mince byla automaticky rozpoznána. Zkontrolujte a upravte údaje podle potřeby.
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Kolekce</InputLabel>
                <Select
                  value={collectionId}
                  onChange={(e) => setCollectionId(Number(e.target.value))}
                  label="Kolekce"
                >
                  {collections.map((collection) => (
                    <MenuItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Země"
                value={coinData.country}
                onChange={(e) => setCoinData(prev => ({ ...prev, country: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nominální hodnota"
                value={coinData.denomination}
                onChange={(e) => setCoinData(prev => ({ ...prev, denomination: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Rok"
                type="number"
                value={coinData.year}
                onChange={(e) => setCoinData(prev => ({ ...prev, year: Number(e.target.value) }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Materiál"
                value={coinData.material}
                onChange={(e) => setCoinData(prev => ({ ...prev, material: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Stav"
                value={coinData.condition}
                onChange={(e) => setCoinData(prev => ({ ...prev, condition: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Odhadovaná hodnota (CZK)"
                type="number"
                value={coinData.estimated_value}
                onChange={(e) => setCoinData(prev => ({ ...prev, estimated_value: Number(e.target.value) }))}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Popis"
                multiline
                rows={3}
                value={coinData.description}
                onChange={(e) => setCoinData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>

            {/* Captured Images */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Zachycené fotografie ({capturedImages.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {capturedImages.map((image, index) => (
                  <Box
                    key={index}
                    sx={{
                      position: 'relative',
                      width: 80,
                      height: 80,
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <img
                      src={image}
                      alt={`Captured ${index}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => deleteImage(index)}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bgcolor: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'rgba(0,0,0,0.9)',
                        },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>

          {loading && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Zrušit</Button>
          <Button
            onClick={saveCoin}
            variant="contained"
            disabled={loading || !collectionId || capturedImages.length === 0}
          >
            Uložit minci
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MobileCoinCapture;