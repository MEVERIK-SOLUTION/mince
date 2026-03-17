import React from 'react'
import { Typography, Box } from '@mui/material'

const CoinList: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Katalog mincí
      </Typography>
      
      <Typography variant="body1" color="text.secondary">
        Seznam všech mincí v databázi bude implementován v dalším běhu.
      </Typography>
    </Box>
  )
}

export default CoinList