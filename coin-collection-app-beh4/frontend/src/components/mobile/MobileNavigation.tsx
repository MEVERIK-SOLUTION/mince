import React, { useState, useEffect } from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Box,
  Badge,
  Avatar,
  useTheme,
  useMediaQuery,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Backdrop,
} from '@mui/material';
import {
  Home as HomeIcon,
  Search as SearchIcon,
  Collections as CollectionsIcon,
  Assessment as StatsIcon,
  Menu as MenuIcon,
  Add as AddIcon,
  PhotoCamera as CameraIcon,
  QrCodeScanner as ScannerIcon,
  Upload as ImportIcon,
  Person as ProfileIcon,
  Settings as SettingsIcon,
  Backup as BackupIcon,
  Share as ShareIcon,
  Notifications as NotificationsIcon,
  Help as HelpIcon,
  Logout as LogoutIcon,
  Close as CloseIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface MobileNavigationProps {
  user?: {
    id: number;
    email: string;
    full_name: string;
    avatar_url?: string;
  };
  notificationCount?: number;
  onLogout?: () => void;
}

const BOTTOM_NAV_ITEMS = [
  { label: 'Domů', value: '/', icon: HomeIcon },
  { label: 'Hledat', value: '/search', icon: SearchIcon },
  { label: 'Kolekce', value: '/collections', icon: CollectionsIcon },
  { label: 'Statistiky', value: '/dashboard', icon: StatsIcon },
];

const SPEED_DIAL_ACTIONS = [
  { icon: <CameraIcon />, name: 'Vyfotit minci', action: 'camera' },
  { icon: <ScannerIcon />, name: 'Skenovat QR', action: 'scanner' },
  { icon: <EditIcon />, name: 'Přidat ručně', action: 'manual' },
  { icon: <ImportIcon />, name: 'Importovat', action: 'import' },
];

const DRAWER_MENU_ITEMS = [
  { label: 'Profil', icon: ProfileIcon, path: '/profile' },
  { label: 'Nastavení', icon: SettingsIcon, path: '/settings' },
  { label: 'Zálohy', icon: BackupIcon, path: '/backup' },
  { label: 'Sdílení', icon: ShareIcon, path: '/sharing' },
  { label: 'Nápověda', icon: HelpIcon, path: '/help' },
];

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  user,
  notificationCount = 0,
  onLogout,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const [bottomNavValue, setBottomNavValue] = useState(location.pathname);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  useEffect(() => {
    setBottomNavValue(location.pathname);
  }, [location.pathname]);

  const handleBottomNavChange = (event: React.SyntheticEvent, newValue: string) => {
    setBottomNavValue(newValue);
    navigate(newValue);
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleMenuItemClick = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const handleSpeedDialAction = (action: string) => {
    setSpeedDialOpen(false);
    
    switch (action) {
      case 'camera':
        navigate('/coins/add?mode=camera');
        break;
      case 'scanner':
        navigate('/coins/add?mode=scanner');
        break;
      case 'manual':
        navigate('/coins/add');
        break;
      case 'import':
        navigate('/import');
        break;
    }
  };

  const handleLogout = () => {
    setDrawerOpen(false);
    onLogout?.();
  };

  if (!isMobile) {
    return null; // Zobrazit pouze na mobilních zařízeních
  }

  return (
    <>
      {/* Top App Bar */}
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Coin Manager
          </Typography>

          <IconButton color="inherit" onClick={() => navigate('/notifications')}>
            <Badge badgeContent={notificationCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          {user && (
            <IconButton color="inherit" onClick={() => navigate('/profile')}>
              <Avatar
                src={user.avatar_url}
                alt={user.full_name}
                sx={{ width: 32, height: 32 }}
              >
                {user.full_name.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      {/* Side Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 280,
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          {/* User Info */}
          {user && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Avatar
                src={user.avatar_url}
                alt={user.full_name}
                sx={{ width: 64, height: 64, mx: 'auto', mb: 1 }}
              >
                {user.full_name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="h6" noWrap>
                {user.full_name}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {user.email}
              </Typography>
            </Box>
          )}

          <Divider />

          {/* Menu Items */}
          <List>
            {DRAWER_MENU_ITEMS.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton onClick={() => handleMenuItemClick(item.path)}>
                  <ListItemIcon>
                    <item.icon />
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>

          <Divider />

          {/* Logout */}
          <List>
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Odhlásit se" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Bottom Navigation */}
      <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
        <BottomNavigation
          value={bottomNavValue}
          onChange={handleBottomNavChange}
          showLabels
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              paddingTop: 1,
            },
          }}
        >
          {BOTTOM_NAV_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.value}
              label={item.label}
              value={item.value}
              icon={<item.icon />}
            />
          ))}
        </BottomNavigation>
      </Box>

      {/* Speed Dial for Quick Actions */}
      <Backdrop
        open={speedDialOpen}
        sx={{ zIndex: theme.zIndex.speedDial - 1 }}
        onClick={() => setSpeedDialOpen(false)}
      />
      
      <SpeedDial
        ariaLabel="Quick actions"
        sx={{
          position: 'fixed',
          bottom: 80, // Above bottom navigation
          right: 16,
          zIndex: theme.zIndex.speedDial,
        }}
        icon={<SpeedDialIcon />}
        open={speedDialOpen}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        direction="up"
      >
        {SPEED_DIAL_ACTIONS.map((action) => (
          <SpeedDialAction
            key={action.action}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => handleSpeedDialAction(action.action)}
            sx={{
              '& .MuiSpeedDialAction-fab': {
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
              },
            }}
          />
        ))}
      </SpeedDial>

      {/* Spacer for bottom navigation */}
      <Box sx={{ height: 56 }} />
    </>
  );
};

export default MobileNavigation;