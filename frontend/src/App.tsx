import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import {
  AppBar,
  Box,
  Container,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ViewListIcon from '@mui/icons-material/ViewList'
import AddCircleIcon from '@mui/icons-material/AddCircle'
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark'

import Dashboard from './pages/Dashboard'
import CoinList from './pages/CoinList'
import CoinDetail from './pages/CoinDetail'
import AddCoin from './pages/AddCoin'
import EditCoin from './pages/EditCoin'
import Collections from './pages/Collections'

const DRAWER_WIDTH = 220

const navItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Katalog mincí', path: '/coins', icon: <ViewListIcon /> },
  { label: 'Přidat minci', path: '/coins/new', icon: <AddCircleIcon /> },
  { label: 'Kolekce', path: '/collections', icon: <CollectionsBookmarkIcon /> },
]

export default function App() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  const drawerContent = (
    <Box sx={{ width: DRAWER_WIDTH }}>
      <Toolbar>
        <Typography variant="h6" noWrap>🪙 Mince</Typography>
      </Toolbar>
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              onClick={() => setDrawerOpen(false)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      {/* AppBar */}
      <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🪙 Mince – Numismatický katalog
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Desktop sidebar */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
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
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          minHeight: '100vh',
          backgroundColor: 'grey.50',
        }}
      >
        <Container maxWidth="xl">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/coins" element={<CoinList />} />
            <Route path="/coins/new" element={<AddCoin />} />
            <Route path="/coins/:id" element={<CoinDetail />} />
            <Route path="/coins/:id/edit" element={<EditCoin />} />
            <Route path="/collections" element={<Collections />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  )
}
