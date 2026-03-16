import React from 'react'
import { Typography, Box } from '@mui/material'

const Collection: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Moje kolekce
      </Typography>
      
      <Typography variant="body1" color="text.secondary">
        Správa osobní kolekce bude implementována v dalším běhu.
      </Typography>
    </Box>
  )
}

export default Collection