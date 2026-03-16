import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Container, AppBar, Toolbar, Typography, Box } from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { cs } from 'date-fns/locale'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ToastProvider'
import Dashboard from './pages/Dashboard'
import CoinList from './pages/CoinList'
import CoinDetail from './pages/CoinDetail'
import AddCoin from './pages/AddCoin'
import Collection from './pages/Collection'

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={cs}>
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
              </Routes>
            </Container>
          </Box>
        </LocalizationProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App