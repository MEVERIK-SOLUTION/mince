import React from 'react'
import { Typography, Box } from '@mui/material'

const AddCoin: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Přidat minci
      </Typography>
      
      <Typography variant="body1" color="text.secondary">
        Formulář pro přidání nové mince bude implementován v dalším běhu.
      </Typography>
    </Box>
  )
}

export default AddCoin