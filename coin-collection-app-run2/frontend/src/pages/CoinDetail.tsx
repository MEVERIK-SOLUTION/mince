import React from 'react'
import { Typography, Box } from '@mui/material'

const CoinDetail: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Detail mince
      </Typography>
      
      <Typography variant="body1" color="text.secondary">
        Detailní zobrazení mince bude implementováno v dalším běhu.
      </Typography>
    </Box>
  )
}

export default CoinDetail