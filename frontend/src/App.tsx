import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  Box,
  Container,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
  useTheme,
  alpha,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ViewListIcon from '@mui/icons-material/ViewList'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark'
import DiamondIcon from '@mui/icons-material/Diamond'

import Dashboard from './pages/Dashboard'
import CoinList from './pages/CoinList'
import CoinDetail from './pages/CoinDetail'
import AddCoin from './pages/AddCoin'
import EditCoin from './pages/EditCoin'
import Collections from './pages/Collections'
import PreciousMetals from './pages/PreciousMetals'

const DRAWER_WIDTH = 240

const navItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Katalog mincí', path: '/coins', icon: <ViewListIcon fontSize="small" /> },
  { label: 'Přidat minci', path: '/coins/new', icon: <AddCircleIcon fontSize="small" /> },
  { label: 'Kolekce', path: '/collections', icon: <CollectionsBookmarkIcon fontSize="small" /> },
  { label: 'Drahé kovy', path: '/metals', icon: <DiamondIcon fontSize="small" /> },
]

export default function App() {
  const theme = useTheme()
  const location = useLocation()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const drawerContent = (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0a1020 0%, #070b12 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 3, py: 3.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #d4a847 0%, #e8c06a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 4px 12px rgba(212,168,71,0.4)',
            flexShrink: 0,
          }}
        >
          🪙
        </Box>
        <Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: '#e8eaf6', lineHeight: 1.1 }}
          >
            Mince
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'rgba(232,234,246,0.4)', fontSize: '0.65rem', letterSpacing: '0.05em' }}
          >
            Numismatický katalog
          </Typography>
        </Box>
        {isMobile && (
          <IconButton
            onClick={() => setDrawerOpen(false)}
            sx={{ ml: 'auto', color: 'rgba(232,234,246,0.5)', p: 0.5 }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Nav label */}
      <Typography
        sx={{
          px: 3,
          mb: 1,
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(232,234,246,0.3)',
        }}
      >
        Navigace
      </Typography>

      {/* Nav items */}
      <List sx={{ px: 1.5, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={() => setDrawerOpen(false)}
                sx={{
                  borderRadius: '10px',
                  py: 1,
                  px: 1.5,
                  color: isActive ? '#d4a847' : 'rgba(232,234,246,0.65)',
                  backgroundColor: isActive
                    ? alpha('#d4a847', 0.1)
                    : 'transparent',
                  border: isActive
                    ? '1px solid rgba(212,168,71,0.2)'
                    : '1px solid transparent',
                  '&:hover': {
                    backgroundColor: isActive
                      ? alpha('#d4a847', 0.14)
                      : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#d4a847' : '#e8eaf6',
                  },
                  transition: 'all 0.15s ease',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 32,
                    color: 'inherit',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
                {isActive && (
                  <Box
                    sx={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      backgroundColor: '#d4a847',
                      boxShadow: '0 0 6px #d4a847',
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>

      {/* Footer */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(232,234,246,0.25)',
            fontSize: '0.62rem',
            display: 'block',
          }}
        >
          © 2025 Meverik Studio®
        </Typography>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile top bar */}
      {isMobile && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            px: 2,
            gap: 1.5,
            backgroundColor: 'rgba(7,11,18,0.92)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{ color: 'rgba(232,234,246,0.7)' }}
            size="small"
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '1rem' }}>🪙</Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#e8eaf6' }}>
              Mince
            </Typography>
          </Box>
        </Box>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              border: 'none',
              background: 'transparent',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              border: 'none',
              background: 'transparent',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: isMobile ? 9 : 4,
          pb: 4,
          px: { xs: 2, sm: 3, md: 4 },
          minHeight: '100vh',
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="xl" disableGutters>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/coins" element={<CoinList />} />
            <Route path="/coins/new" element={<AddCoin />} />
            <Route path="/coins/:id" element={<CoinDetail />} />
            <Route path="/coins/:id/edit" element={<EditCoin />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/metals" element={<PreciousMetals />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  )
}
