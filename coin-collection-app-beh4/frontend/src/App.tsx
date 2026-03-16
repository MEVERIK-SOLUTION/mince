import React, { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Container, AppBar, Toolbar, Typography, Box, useMediaQuery, createTheme, ThemeProvider } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { cs } from 'date-fns/locale'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ToastProvider'

// Import existing pages
import Dashboard from './pages/Dashboard'
import CoinList from './pages/CoinList'
import CoinDetail from './pages/CoinDetail'
import AddCoin from './pages/AddCoin'
import Collection from './pages/Collection'

// Import new components
import ReportGenerator from './components/ReportGenerator'
import BackupManager from './components/BackupManager'
import SharingManager from './components/SharingManager'
import NotificationCenter from './components/NotificationCenter'
import WishlistManager from './components/WishlistManager'

// Mobile components
import MobileNavigation from './components/mobile/MobileNavigation'
import MobileCoinCapture from './components/mobile/MobileCoinCapture'

// PWA components
import PWAManager from './components/PWAManager'

// Import mobile styles
import './styles/mobile.css'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 768,
      lg: 1024,
      xl: 1200,
    },
  },
  components: {
    // Mobile-first component overrides
    MuiButton: {
      styleOverrides: {
        root: {
          '@media (max-width: 768px)': {
            minHeight: 44,
            fontSize: '14px',
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '@media (max-width: 768px)': {
            minHeight: 44,
            minWidth: 44,
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          '@media (max-width: 768px)': {
            minHeight: 56,
            minWidth: 56,
          },
        },
      },
    },
  },
})

interface User {
  id: number
  email: string
  full_name: string
  avatar_url?: string
}

interface CollectionType {
  id: number
  name: string
  description: string
  coin_count: number
  total_value: number
}

function App() {
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  
  // State
  const [user, setUser] = useState<User | null>(null)
  const [collections, setCollections] = useState<CollectionType[]>([])
  const [notificationCount, setNotificationCount] = useState(0)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load user data and collections
  useEffect(() => {
    const loadAppData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          setLoading(false)
          return
        }

        // Mock user data for development
        setUser({
          id: 1,
          email: 'user@example.com',
          full_name: 'Test User',
        })
        setIsAuthenticated(true)

        // Mock collections data
        setCollections([
          { id: 1, name: 'Evropské mince', description: 'Kolekce evropských mincí', coin_count: 45, total_value: 1250 },
          { id: 2, name: 'Americké mince', description: 'Kolekce amerických mincí', coin_count: 32, total_value: 890 },
          { id: 3, name: 'Historické mince', description: 'Vzácné historické mince', coin_count: 18, total_value: 3200 },
        ])

        setNotificationCount(3)
      } catch (error) {
        console.error('Error loading app data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAppData()
  }, [])

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setIsAuthenticated(false)
    setCollections([])
    setNotificationCount(0)
  }

  // Handle coin added (for mobile capture)
  const handleCoinAdded = (coinData: any) => {
    console.log('Coin added:', coinData)
  }

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
          }}
        >
          Loading...
        </Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <ErrorBoundary>
        <ToastProvider>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={cs}>
            <Box className={isMobile ? 'mobile-app' : 'desktop-app'}>
              {/* PWA Manager */}
              <PWAManager />

              {/* Mobile Navigation */}
              {isMobile && (
                <MobileNavigation
                  user={user || undefined}
                  notificationCount={notificationCount}
                  onLogout={handleLogout}
                />
              )}

              {/* Main Layout */}
              {isMobile ? (
                // Mobile layout
                <Box sx={{ pt: 8, pb: 7 }}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/coins" element={<CoinList />} />
                    <Route path="/coins/:id" element={<CoinDetail />} />
                    <Route path="/add-coin" element={
                      <MobileCoinCapture
                        collections={collections}
                        onCoinAdded={handleCoinAdded}
                      />
                    } />
                    <Route path="/collection" element={<Collection />} />
                    <Route path="/collections" element={<Collection />} />
                    <Route path="/wishlist" element={<WishlistManager />} />
                    <Route path="/notifications" element={<NotificationCenter />} />
                    <Route path="/reports" element={
                      <ReportGenerator collections={collections} />
                    } />
                    <Route path="/backup" element={
                      <BackupManager collections={collections} />
                    } />
                    <Route path="/sharing" element={
                      <SharingManager collections={collections} />
                    } />
                    <Route path="/search" element={<CoinList />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                  </Routes>
                </Box>
              ) : (
                // Desktop layout
                <Box sx={{ flexGrow: 1 }}>
                  <AppBar position="static">
                    <Toolbar>
                      <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        🪙 Coin Collection Manager
                      </Typography>
                    </Toolbar>
                  </AppBar>
                  
                  <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/coins" element={<CoinList />} />
                      <Route path="/coins/:id" element={<CoinDetail />} />
                      <Route path="/add-coin" element={<AddCoin />} />
                      <Route path="/collection" element={<Collection />} />
                      <Route path="/collections" element={<Collection />} />
                      <Route path="/wishlist" element={<WishlistManager />} />
                      <Route path="/notifications" element={<NotificationCenter />} />
                      <Route path="/reports" element={
                        <ReportGenerator collections={collections} />
                      } />
                      <Route path="/backup" element={
                        <BackupManager collections={collections} />
                      } />
                      <Route path="/sharing" element={
                        <SharingManager collections={collections} />
                      } />
                      <Route path="/search" element={<CoinList />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                    </Routes>
                  </Container>
                </Box>
              )}
            </Box>
          </LocalizationProvider>
        </ToastProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App