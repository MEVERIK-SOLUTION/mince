import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Avatar,
  IconButton,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Divider,
  Tooltip,
  Badge,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  useTheme,
  useMediaQuery,
  Skeleton,
  Snackbar,
} from '@mui/material';
import {
  Backup as BackupIcon,
  Restore as RestoreIcon,
  CloudUpload as UploadIcon,
  CloudDownload as DownloadIcon,
  Delete as DeleteIcon,
  Verified as VerifiedIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  Assessment as StatsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  GetApp as GetAppIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';

interface Collection {
  id: number;
  name: string;
  description: string;
  coin_count: number;
  total_value: number;
}

interface BackupInfo {
  backup_id: string;
  file_path: string;
  file_size: number;
  s3_url?: string;
  created_at: string;
  backup_type: string;
  user_id: number;
  storage_type: string;
  collection_id?: number;
  collection_name?: string;
  coin_count?: number;
  image_count?: number;
  include_images: boolean;
}

interface BackupStatistics {
  total_backups: number;
  total_size: number;
  total_size_formatted: string;
  oldest_backup?: {
    backup_id: string;
    created_at: string;
    backup_type: string;
  };
  newest_backup?: {
    backup_id: string;
    created_at: string;
    backup_type: string;
  };
  backup_types: Record<string, { count: number; size: number }>;
  storage_usage: {
    local: { count: number; size: number };
    s3: { count: number; size: number };
  };
  average_backup_size_formatted: string;
}

interface BackupSettings {
  auto_backup_enabled: boolean;
  auto_backup_frequency: string;
  include_images_by_default: boolean;
  compression_level: number;
  retention_days: number;
  keep_minimum_backups: number;
  s3_backup_enabled: boolean;
  backup_notifications: boolean;
  max_backup_size_mb: number;
}

interface BackupManagerProps {
  collections: Collection[];
}

const BACKUP_TYPE_LABELS = {
  'full_backup': 'Kompletní záloha',
  'collection_backup': 'Záloha kolekce',
};

const FREQUENCY_LABELS = {
  'daily': 'Denně',
  'weekly': 'Týdně',
  'monthly': 'Měsíčně',
};

const RESTORE_STRATEGY_LABELS = {
  'merge': 'Sloučit s existujícími daty',
  'replace': 'Nahradit existující data',
  'new_collection': 'Vytvořit nové kolekce',
};

export const BackupManager: React.FC<BackupManagerProps> = ({ collections }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [statistics, setStatistics] = useState<BackupStatistics | null>(null);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [statisticsLoading, setStatisticsLoading] = useState(true);

  // Dialog states
  const [createBackupOpen, setCreateBackupOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statisticsOpen, setStatisticsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Form states
  const [backupType, setBackupType] = useState<'full' | 'collection'>('full');
  const [selectedCollection, setSelectedCollection] = useState<number>(0);
  const [includeImages, setIncludeImages] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState(6);

  // Restore states
  const [restoreStrategy, setRestoreStrategy] = useState('merge');
  const [restoreImages, setRestoreImages] = useState(true);
  const [collectionNameSuffix, setCollectionNameSuffix] = useState('_restored');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreFromExisting, setRestoreFromExisting] = useState(false);
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<string>('');

  // Schedule states
  const [scheduleFrequency, setScheduleFrequency] = useState('weekly');
  const [scheduleCollection, setScheduleCollection] = useState<number | null>(null);

  // Progress states
  const [activeStep, setActiveStep] = useState(0);
  const [operationProgress, setOperationProgress] = useState(0);

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  useEffect(() => {
    loadBackups();
    loadStatistics();
    loadSettings();
  }, []);

  const loadBackups = async () => {
    try {
      const response = await fetch('/api/backups/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups);
      }
    } catch (error) {
      console.error('Error loading backups:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      setStatisticsLoading(true);
      const response = await fetch('/api/backups/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setStatisticsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/backups/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setActiveStep(0);

      const endpoint = backupType === 'full' 
        ? '/api/backups/full'
        : `/api/collections/${selectedCollection}/backup`;

      const params = new URLSearchParams({
        include_images: includeImages.toString(),
        ...(backupType === 'full' && { compression_level: compressionLevel.toString() })
      });

      const response = await fetch(`${endpoint}?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setActiveStep(1);
        
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success',
        });

        setCreateBackupOpen(false);
        loadBackups();
        loadStatistics();
      } else {
        throw new Error('Chyba při vytváření zálohy');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      setSnackbar({
        open: true,
        message: 'Chyba při vytváření zálohy',
        severity: 'error',
      });
    } finally {
      setLoading(false);
      setActiveStep(0);
    }
  };

  const handleRestoreFromFile = async () => {
    if (!restoreFile) return;

    try {
      setLoading(true);
      setActiveStep(0);

      const formData = new FormData();
      formData.append('backup_file', restoreFile);

      const params = new URLSearchParams({
        strategy: restoreStrategy,
        restore_images: restoreImages.toString(),
        collection_name_suffix: collectionNameSuffix,
      });

      const response = await fetch(`/api/restore?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setActiveStep(1);
        
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success',
        });

        setRestoreOpen(false);
        setRestoreFile(null);
      } else {
        throw new Error('Chyba při obnovování ze zálohy');
      }
    } catch (error) {
      console.error('Error restoring from backup:', error);
      setSnackbar({
        open: true,
        message: 'Chyba při obnovování ze zálohy',
        severity: 'error',
      });
    } finally {
      setLoading(false);
      setActiveStep(0);
    }
  };

  const handleRestoreFromExisting = async () => {
    if (!selectedBackupForRestore) return;

    try {
      setLoading(true);

      const params = new URLSearchParams({
        strategy: restoreStrategy,
        restore_images: restoreImages.toString(),
        collection_name_suffix: collectionNameSuffix,
      });

      const response = await fetch(`/api/restore/from-backup/${selectedBackupForRestore}?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        setSnackbar({
          open: true,
          message: data.message,
          severity: 'success',
        });

        setRestoreOpen(false);
      } else {
        throw new Error('Chyba při obnovování ze zálohy');
      }
    } catch (error) {
      console.error('Error restoring from existing backup:', error);
      setSnackbar({
        open: true,
        message: 'Chyba při obnovování ze zálohy',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    try {
      const response = await fetch(`/api/backups/${backupId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backupId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading backup:', error);
      setSnackbar({
        open: true,
        message: 'Chyba při stahování zálohy',
        severity: 'error',
      });
    }
  };

  const handleVerifyBackup = async (backupId: string) => {
    try {
      const response = await fetch(`/api/backups/${backupId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        setSnackbar({
          open: true,
          message: data.valid ? 'Záloha je v pořádku' : `Záloha je poškozená: ${data.error}`,
          severity: data.valid ? 'success' : 'error',
        });
      }
    } catch (error) {
      console.error('Error verifying backup:', error);
      setSnackbar({
        open: true,
        message: 'Chyba při ověřování zálohy',
        severity: 'error',
      });
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!window.confirm('Opravdu chcete smazat tuto zálohu?')) return;

    try {
      const response = await fetch(`/api/backups/${backupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Záloha byla smazána',
          severity: 'success',
        });

        loadBackups();
        loadStatistics();
      }
    } catch (error) {
      console.error('Error deleting backup:', error);
      setSnackbar({
        open: true,
        message: 'Chyba při mazání zálohy',
        severity: 'error',
      });
    }
  };

  const handleScheduleBackup = async () => {
    try {
      const params = new URLSearchParams({
        frequency: scheduleFrequency,
        include_images: includeImages.toString(),
        ...(scheduleCollection && { collection_id: scheduleCollection.toString() })
      });

      const response = await fetch(`/api/backups/schedule?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setSnackbar({
          open: true,
          message: 'Automatické zálohování bylo naplánováno',
          severity: 'success',
        });

        setScheduleOpen(false);
      }
    } catch (error) {
      console.error('Error scheduling backup:', error);
      setSnackbar({
        open: true,
        message: 'Chyba při plánování zálohy',
        severity: 'error',
      });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.name.endsWith('.zip')) {
      setRestoreFile(file);
    } else {
      setSnackbar({
        open: true,
        message: 'Podporovány jsou pouze ZIP soubory',
        severity: 'error',
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip']
    },
    multiple: false
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatRelativeTime = (dateString: string) => {
    return formatDistanceToNow(parseISO(dateString), { 
      addSuffix: true, 
      locale: cs 
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Správa záloh
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<StatsIcon />}
            variant="outlined"
            onClick={() => setStatisticsOpen(true)}
          >
            Statistiky
          </Button>
          <Button
            startIcon={<SettingsIcon />}
            variant="outlined"
            onClick={() => setSettingsOpen(true)}
          >
            Nastavení
          </Button>
        </Box>
      </Box>

      {/* Quick Stats */}
      {statistics && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <BackupIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" color="primary">
                  {statistics.total_backups}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Celkem záloh
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <StorageIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" color="info.main">
                  {statistics.total_size_formatted}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Celková velikost
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <HistoryIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" color="success.main">
                  {statistics.newest_backup ? formatRelativeTime(statistics.newest_backup.created_at) : 'Nikdy'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Poslední záloha
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <SecurityIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" color="warning.main">
                  {statistics.average_backup_size_formatted}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Průměrná velikost
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Actions */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <BackupIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Vytvořit zálohu
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Zálohujte svá data pro bezpečné uložení
              </Typography>
              <Button
                variant="contained"
                onClick={() => setCreateBackupOpen(true)}
                fullWidth
              >
                Vytvořit zálohu
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <RestoreIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Obnovit ze zálohy
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Obnovte data z existující zálohy
              </Typography>
              <Button
                variant="contained"
                color="success"
                onClick={() => setRestoreOpen(true)}
                fullWidth
              >
                Obnovit data
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <ScheduleIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Automatické zálohy
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Naplánujte pravidelné zálohování
              </Typography>
              <Button
                variant="contained"
                color="warning"
                onClick={() => setScheduleOpen(true)}
                fullWidth
              >
                Naplánovat
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Backup List */}
      <Card>
        <CardHeader 
          title="Existující zálohy"
          action={
            <IconButton onClick={loadBackups}>
              <RefreshIcon />
            </IconButton>
          }
        />
        <CardContent>
          {backups.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <BackupIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Žádné zálohy
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Vytvořte svou první zálohu pro bezpečné uložení dat
              </Typography>
            </Box>
          ) : (
            <List>
              {backups.map((backup) => (
                <ListItem key={backup.backup_id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <BackupIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {BACKUP_TYPE_LABELS[backup.backup_type as keyof typeof BACKUP_TYPE_LABELS] || backup.backup_type}
                        </Typography>
                        {backup.collection_name && (
                          <Chip label={backup.collection_name} size="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {format(parseISO(backup.created_at), 'dd.MM.yyyy HH:mm', { locale: cs })} • 
                          {formatFileSize(backup.file_size)}
                        </Typography>
                        {backup.coin_count && (
                          <Typography variant="caption" color="text.secondary">
                            {backup.coin_count} mincí
                            {backup.image_count && ` • ${backup.image_count} obrázků`}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Stáhnout">
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadBackup(backup.backup_id)}
                        >
                          <GetAppIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Ověřit integritu">
                        <IconButton
                          size="small"
                          onClick={() => handleVerifyBackup(backup.backup_id)}
                        >
                          <VerifiedIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Smazat">
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteBackup(backup.backup_id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Create Backup Dialog */}
      <Dialog open={createBackupOpen} onClose={() => setCreateBackupOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Vytvořit zálohu</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <Typography variant="subtitle1" gutterBottom>
                  Typ zálohy
                </Typography>
                <RadioGroup
                  value={backupType}
                  onChange={(e) => setBackupType(e.target.value as 'full' | 'collection')}
                >
                  <FormControlLabel
                    value="full"
                    control={<Radio />}
                    label="Kompletní záloha (všechny kolekce)"
                  />
                  <FormControlLabel
                    value="collection"
                    control={<Radio />}
                    label="Záloha konkrétní kolekce"
                  />
                </RadioGroup>
              </FormControl>
            </Grid>

            {backupType === 'collection' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Kolekce</InputLabel>
                  <Select
                    value={selectedCollection}
                    onChange={(e) => setSelectedCollection(Number(e.target.value))}
                    label="Kolekce"
                  >
                    {collections.map((collection) => (
                      <MenuItem key={collection.id} value={collection.id}>
                        {collection.name} ({collection.coin_count} mincí)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeImages}
                    onChange={(e) => setIncludeImages(e.target.checked)}
                  />
                }
                label="Zahrnout obrázky mincí"
              />
            </Grid>

            {backupType === 'full' && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Úroveň komprese: {compressionLevel}
                </Typography>
                <Box sx={{ px: 2 }}>
                  <input
                    type="range"
                    min="1"
                    max="9"
                    value={compressionLevel}
                    onChange={(e) => setCompressionLevel(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption">Rychlé</Typography>
                    <Typography variant="caption">Vyvážené</Typography>
                    <Typography variant="caption">Malé</Typography>
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>

          {loading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Vytváření zálohy...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateBackupOpen(false)}>Zrušit</Button>
          <Button
            onClick={handleCreateBackup}
            variant="contained"
            disabled={loading || (backupType === 'collection' && !selectedCollection)}
          >
            Vytvořit zálohu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={restoreOpen} onClose={() => setRestoreOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Obnovit ze zálohy</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <Typography variant="subtitle1" gutterBottom>
                  Zdroj zálohy
                </Typography>
                <RadioGroup
                  value={restoreFromExisting ? 'existing' : 'file'}
                  onChange={(e) => setRestoreFromExisting(e.target.value === 'existing')}
                >
                  <FormControlLabel
                    value="file"
                    control={<Radio />}
                    label="Nahrát soubor zálohy"
                  />
                  <FormControlLabel
                    value="existing"
                    control={<Radio />}
                    label="Použít existující zálohu"
                  />
                </RadioGroup>
              </FormControl>
            </Grid>

            {!restoreFromExisting ? (
              <Grid item xs={12}>
                <Paper
                  {...getRootProps()}
                  sx={{
                    p: 3,
                    border: 2,
                    borderColor: isDragActive ? 'primary.main' : 'grey.300',
                    borderStyle: 'dashed',
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'action.hover'
                    }
                  }}
                >
                  <input {...getInputProps()} />
                  <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="h6" gutterBottom>
                    {isDragActive ? 'Přetáhněte soubor sem' : 'Vyberte soubor nebo přetáhněte'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Podporované formáty: ZIP
                  </Typography>
                  {restoreFile && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                      Vybraný soubor: {restoreFile.name}
                    </Alert>
                  )}
                </Paper>
              </Grid>
            ) : (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Existující záloha</InputLabel>
                  <Select
                    value={selectedBackupForRestore}
                    onChange={(e) => setSelectedBackupForRestore(e.target.value)}
                    label="Existující záloha"
                  >
                    {backups.map((backup) => (
                      <MenuItem key={backup.backup_id} value={backup.backup_id}>
                        {BACKUP_TYPE_LABELS[backup.backup_type as keyof typeof BACKUP_TYPE_LABELS]} - 
                        {format(parseISO(backup.created_at), 'dd.MM.yyyy HH:mm', { locale: cs })}
                        {backup.collection_name && ` (${backup.collection_name})`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Strategie obnovení</InputLabel>
                <Select
                  value={restoreStrategy}
                  onChange={(e) => setRestoreStrategy(e.target.value)}
                  label="Strategie obnovení"
                >
                  {Object.entries(RESTORE_STRATEGY_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={restoreImages}
                    onChange={(e) => setRestoreImages(e.target.checked)}
                  />
                }
                label="Obnovit obrázky"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Přípona pro názvy kolekcí"
                value={collectionNameSuffix}
                onChange={(e) => setCollectionNameSuffix(e.target.value)}
                size="small"
              />
            </Grid>
          </Grid>

          {loading && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Obnovování ze zálohy...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreOpen(false)}>Zrušit</Button>
          <Button
            onClick={restoreFromExisting ? handleRestoreFromExisting : handleRestoreFromFile}
            variant="contained"
            disabled={
              loading || 
              (!restoreFromExisting && !restoreFile) || 
              (restoreFromExisting && !selectedBackupForRestore)
            }
          >
            Obnovit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Naplánovat automatické zálohování</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Frekvence</InputLabel>
                <Select
                  value={scheduleFrequency}
                  onChange={(e) => setScheduleFrequency(e.target.value)}
                  label="Frekvence"
                >
                  {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Kolekce (volitelné)</InputLabel>
                <Select
                  value={scheduleCollection || ''}
                  onChange={(e) => setScheduleCollection(e.target.value ? Number(e.target.value) : null)}
                  label="Kolekce (volitelné)"
                >
                  <MenuItem value="">Všechny kolekce</MenuItem>
                  {collections.map((collection) => (
                    <MenuItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeImages}
                    onChange={(e) => setIncludeImages(e.target.checked)}
                  />
                }
                label="Zahrnout obrázky"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleOpen(false)}>Zrušit</Button>
          <Button onClick={handleScheduleBackup} variant="contained">
            Naplánovat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Statistics Dialog */}
      <Dialog open={statisticsOpen} onClose={() => setStatisticsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Statistiky zálohování</DialogTitle>
        <DialogContent>
          {statisticsLoading ? (
            <Box>
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </Box>
          ) : statistics ? (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {statistics.total_backups}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Celkem záloh
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {statistics.total_size_formatted}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Celková velikost
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Podle typu zálohy
                </Typography>
                {Object.entries(statistics.backup_types).map(([type, data]) => (
                  <Box key={type} sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        {BACKUP_TYPE_LABELS[type as keyof typeof BACKUP_TYPE_LABELS] || type}
                      </Typography>
                      <Typography variant="body2">
                        {data.count} ({formatFileSize(data.size)})
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(data.count / statistics.total_backups) * 100}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </Grid>

              {statistics.oldest_backup && statistics.newest_backup && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Časové rozmezí
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Nejstarší:</strong> {format(parseISO(statistics.oldest_backup.created_at), 'dd.MM.yyyy HH:mm', { locale: cs })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Nejnovější:</strong> {format(parseISO(statistics.newest_backup.created_at), 'dd.MM.yyyy HH:mm', { locale: cs })}
                  </Typography>
                </Grid>
              )}
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatisticsOpen(false)}>Zavřít</Button>
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

export default BackupManager;