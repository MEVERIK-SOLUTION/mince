import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Snackbar,
  Switch,
  FormControlLabel,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  GetApp as InstallIcon,
  Update as UpdateIcon,
  Wifi as OnlineIcon,
  WifiOff as OfflineIcon,
  Storage as StorageIcon,
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CloudDownload as CloudIcon,
  PhoneAndroid as MobileIcon,
  Computer as DesktopIcon,
} from '@mui/icons-material';
import { usePWA, useOfflineStorage, usePushNotifications } from '../hooks/usePWA';

interface PWAManagerProps {
  onInstallPromptDismissed?: () => void;
}

export const PWAManager: React.FC<PWAManagerProps> = ({
  onInstallPromptDismissed,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    isInstallable,
    isInstalled,
    isOnline,
    isStandalone,
    updateAvailable,
    cacheSize,
    installApp,
    updateApp,
    clearCache,
    getCacheSize,
    showInstallPrompt,
    dismissInstallPrompt,
  } = usePWA();

  const {
    isSupported: offlineSupported,
    saveOfflineData,
    getOfflineData,
    removeOfflineData,
  } = useOfflineStorage();

  const {
    isSupported: notificationsSupported,
    permission: notificationPermission,
    subscription: pushSubscription,
    requestPermission,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  // State
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [offlineDataSize, setOfflineDataSize] = useState(0);

  // Settings
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [offlineMode, setOfflineMode] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

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

  // Automatické zobrazení install promptu
  useEffect(() => {
    if (isInstallable && !isInstalled && isMobile) {
      const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen');
      if (!hasSeenPrompt) {
        setInstallDialogOpen(true);
      }
    }
  }, [isInstallable, isInstalled, isMobile]);

  // Automatické zobrazení update promptu
  useEffect(() => {
    if (updateAvailable && autoUpdate) {
      setUpdateDialogOpen(true);
    }
  }, [updateAvailable, autoUpdate]);

  // Načtení nastavení
  useEffect(() => {
    const loadSettings = () => {
      const savedAutoUpdate = localStorage.getItem('pwa-auto-update');
      const savedOfflineMode = localStorage.getItem('pwa-offline-mode');
      const savedPushNotifications = localStorage.getItem('pwa-push-notifications');

      if (savedAutoUpdate !== null) setAutoUpdate(JSON.parse(savedAutoUpdate));
      if (savedOfflineMode !== null) setOfflineMode(JSON.parse(savedOfflineMode));
      if (savedPushNotifications !== null) setPushNotifications(JSON.parse(savedPushNotifications));
    };

    loadSettings();
  }, []);

  // Uložení nastavení
  const saveSettings = (key: string, value: boolean) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  // Instalace aplikace
  const handleInstall = async () => {
    try {
      setInstalling(true);
      const success = await installApp();
      
      if (success) {
        setSnackbar({
          open: true,
          message: 'Aplikace byla úspěšně nainstalována!',
          severity: 'success',
        });
        setInstallDialogOpen(false);
        localStorage.setItem('pwa-install-prompt-seen', 'true');
      } else {
        setSnackbar({
          open: true,
          message: 'Instalace byla zrušena',
          severity: 'info',
        });
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Chyba při instalaci aplikace',
        severity: 'error',
      });
    } finally {
      setInstalling(false);
    }
  };

  // Aktualizace aplikace
  const handleUpdate = async () => {
    try {
      setUpdating(true);
      await updateApp();
      
      setSnackbar({
        open: true,
        message: 'Aplikace byla aktualizována!',
        severity: 'success',
      });
      setUpdateDialogOpen(false);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Chyba při aktualizaci aplikace',
        severity: 'error',
      });
    } finally {
      setUpdating(false);
    }
  };

  // Vyčištění cache
  const handleClearCache = async () => {
    try {
      setClearingCache(true);
      await clearCache();
      
      setSnackbar({
        open: true,
        message: 'Cache byla vyčištěna',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Chyba při čištění cache',
        severity: 'error',
      });
    } finally {
      setClearingCache(false);
    }
  };

  // Zapnutí/vypnutí push notifikací
  const handlePushNotifications = async (enabled: boolean) => {
    if (enabled) {
      const hasPermission = await requestPermission();
      if (hasPermission) {
        // Zde by se měl získat VAPID klíč ze serveru
        const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || '';
        const subscription = await subscribe(vapidKey);
        
        if (subscription) {
          // Odeslání subscription na server
          try {
            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify(subscription),
            });
            
            setPushNotifications(true);
            saveSettings('pwa-push-notifications', true);
            
            setSnackbar({
              open: true,
              message: 'Push notifikace byly zapnuty',
              severity: 'success',
            });
          } catch (error) {
            setSnackbar({
              open: true,
              message: 'Chyba při registraci push notifikací',
              severity: 'error',
            });
          }
        }
      } else {
        setSnackbar({
          open: true,
          message: 'Oprávnění pro notifikace bylo zamítnuto',
          severity: 'warning',
        });
      }
    } else {
      const success = await unsubscribe();
      if (success) {
        setPushNotifications(false);
        saveSettings('pwa-push-notifications', false);
        
        setSnackbar({
          open: true,
          message: 'Push notifikace byly vypnuty',
          severity: 'info',
        });
      }
    }
  };

  // Skrytí install promptu
  const handleDismissInstall = () => {
    dismissInstallPrompt();
    setInstallDialogOpen(false);
    localStorage.setItem('pwa-install-prompt-seen', 'true');
    onInstallPromptDismissed?.();
  };

  // Formátování velikosti
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      {/* Install Prompt Dialog */}
      <Dialog
        open={installDialogOpen}
        onClose={handleDismissInstall}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MobileIcon color="primary" />
            <Typography variant="h6">Nainstalovat aplikaci</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Nainstalujte si Coin Collection Manager na své zařízení pro lepší zážitek!
          </Typography>
          
          <List>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" />
              </ListItemIcon>
              <ListItemText primary="Rychlejší spuštění" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" />
              </ListItemIcon>
              <ListItemText primary="Offline funkcionalita" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" />
              </ListItemIcon>
              <ListItemText primary="Push notifikace" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" />
              </ListItemIcon>
              <ListItemText primary="Nativní vzhled a chování" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDismissInstall}>Možná později</Button>
          <Button
            onClick={handleInstall}
            variant="contained"
            disabled={installing}
            startIcon={installing ? <RefreshIcon /> : <InstallIcon />}
          >
            {installing ? 'Instaluji...' : 'Nainstalovat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Dialog */}
      <Dialog
        open={updateDialogOpen}
        onClose={() => setUpdateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UpdateIcon color="primary" />
            <Typography variant="h6">Aktualizace dostupná</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Je dostupná nová verze aplikace s vylepšeními a opravami chyb.
          </Typography>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            Aktualizace bude nainstalována na pozadí a aplikace se restartuje.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialogOpen(false)}>Později</Button>
          <Button
            onClick={handleUpdate}
            variant="contained"
            disabled={updating}
            startIcon={updating ? <RefreshIcon /> : <UpdateIcon />}
          >
            {updating ? 'Aktualizuji...' : 'Aktualizovat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">PWA Nastavení</Typography>
            <IconButton onClick={() => setSettingsDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {/* Status Information */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Stav aplikace
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isOnline ? <OnlineIcon color="success" /> : <OfflineIcon color="error" />}
                  <Typography variant="body2">
                    {isOnline ? 'Online' : 'Offline'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isInstalled ? <CheckIcon color="success" /> : <WarningIcon color="warning" />}
                  <Typography variant="body2">
                    {isInstalled ? 'Nainstalováno' : 'Nenainstalováno'}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StorageIcon color="info" />
                  <Typography variant="body2">
                    Cache: {formatBytes(cacheSize)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Settings */}
          <List>
            <ListItem>
              <ListItemText
                primary="Automatické aktualizace"
                secondary="Automaticky instalovat dostupné aktualizace"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={autoUpdate}
                    onChange={(e) => {
                      setAutoUpdate(e.target.checked);
                      saveSettings('pwa-auto-update', e.target.checked);
                    }}
                  />
                }
                label=""
              />
            </ListItem>

            <Divider />

            <ListItem>
              <ListItemText
                primary="Offline režim"
                secondary="Ukládat data pro offline použití"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={offlineMode}
                    onChange={(e) => {
                      setOfflineMode(e.target.checked);
                      saveSettings('pwa-offline-mode', e.target.checked);
                    }}
                    disabled={!offlineSupported}
                  />
                }
                label=""
              />
            </ListItem>

            <Divider />

            <ListItem>
              <ListItemText
                primary="Push notifikace"
                secondary="Přijímat notifikace o nových funkcích a aktualizacích"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={pushNotifications}
                    onChange={(e) => handlePushNotifications(e.target.checked)}
                    disabled={!notificationsSupported}
                  />
                }
                label=""
              />
            </ListItem>
          </List>

          {/* Actions */}
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {!isInstalled && isInstallable && (
              <Button
                variant="outlined"
                startIcon={<InstallIcon />}
                onClick={handleInstall}
                disabled={installing}
              >
                {installing ? 'Instaluji...' : 'Nainstalovat aplikaci'}
              </Button>
            )}

            {updateAvailable && (
              <Button
                variant="outlined"
                startIcon={<UpdateIcon />}
                onClick={handleUpdate}
                disabled={updating}
              >
                {updating ? 'Aktualizuji...' : 'Aktualizovat nyní'}
              </Button>
            )}

            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={handleClearCache}
              disabled={clearingCache}
              color="warning"
            >
              {clearingCache ? 'Čistím...' : 'Vyčistit cache'}
            </Button>
          </Box>

          {clearingCache && <LinearProgress sx={{ mt: 1 }} />}
        </DialogContent>
      </Dialog>

      {/* PWA Status Bar (for development/debugging) */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'fixed',
            bottom: isMobile ? 70 : 10,
            right: 10,
            zIndex: 1300,
          }}
        >
          <Card sx={{ minWidth: 200 }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <Typography variant="caption" display="block">
                PWA Status
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip
                  size="small"
                  label={isOnline ? 'Online' : 'Offline'}
                  color={isOnline ? 'success' : 'error'}
                />
                <Chip
                  size="small"
                  label={isInstalled ? 'Installed' : 'Not Installed'}
                  color={isInstalled ? 'success' : 'default'}
                />
                {updateAvailable && (
                  <Chip size="small" label="Update" color="warning" />
                )}
              </Box>
              <Button
                size="small"
                onClick={() => setSettingsDialogOpen(true)}
                sx={{ mt: 0.5 }}
              >
                Settings
              </Button>
            </CardContent>
          </Card>
        </Box>
      )}

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
    </>
  );
};

export default PWAManager;