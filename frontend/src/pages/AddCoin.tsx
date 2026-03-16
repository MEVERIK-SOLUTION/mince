import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { coinService } from '../services/coinService'
import type { CoinFormData } from '../types/coin'
import CoinForm from '../components/CoinForm'

export default function AddCoin() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [successSnack, setSuccessSnack] = useState(false)

  const createMutation = useMutation({
    mutationFn: (data: CoinFormData) => coinService.createCoin(data),
    onSuccess: (coin) => {
      queryClient.invalidateQueries({ queryKey: ['coins'] })
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] })
      setSuccessSnack(true)
      setTimeout(() => navigate(`/coins/${coin.id}`), 1200)
    },
  })

  const handleSubmit = useCallback(
    async (data: CoinFormData) => {
      await createMutation.mutateAsync(data)
    },
    [createMutation]
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/coins')}>
          Zpět
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Přidat minci
        </Typography>
      </Box>

      {createMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Chyba při ukládání mince. Zkuste to prosím znovu.
        </Alert>
      )}

      {createMutation.isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress />
        </Box>
      )}

      <CoinForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/coins')}
        isLoading={createMutation.isPending}
      />

      <Snackbar
        open={successSnack}
        autoHideDuration={3000}
        onClose={() => setSuccessSnack(false)}
        message="Mince byla úspěšně přidána"
      />
    </Box>
  )
}
