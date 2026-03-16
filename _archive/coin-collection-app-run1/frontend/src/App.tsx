import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Container, AppBar, Toolbar, Typography, Box } from '@mui/material'
import Dashboard from './pages/Dashboard'
import CoinList from './pages/CoinList'
import CoinDetail from './pages/CoinDetail'
import AddCoin from './pages/AddCoin'
import Collection from './pages/Collection'

function App() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            🪙 Coin Collection
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
  )
}

export default App