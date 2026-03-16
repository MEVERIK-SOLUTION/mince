import React, { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export default function EditCoin() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [successSnack, setSuccessSnack] = useState(false)

  const { data: coin, isLoading } = useQuery({
    queryKey: ['coin', id],
    queryFn: () => coinService.getCoin(id!),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (data: CoinFormData) => coinService.updateCoin(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coins'] })
      queryClient.invalidateQueries({ queryKey: ['coin', id] })
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] })
      setSuccessSnack(true)
      setTimeout(() => navigate(`/coins/${id}`), 1200)
    },
  })

  const handleSubmit = useCallback(
    async (data: CoinFormData) => {
      await updateMutation.mutateAsync(data)
    },
    [updateMutation]
  )

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!coin) {
    return (
      <Alert severity="error">Mince nenalezena.</Alert>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/coins/${id}`)}>
          Zpět
        </Button>
        <Typography variant="h4" fontWeight="bold">
          Upravit minci
        </Typography>
      </Box>

      {updateMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Chyba při ukládání. Zkuste to prosím znovu.
        </Alert>
      )}

      <CoinForm
        coin={coin}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/coins/${id}`)}
        isLoading={updateMutation.isPending}
      />

      <Snackbar
        open={successSnack}
        autoHideDuration={3000}
        onClose={() => setSuccessSnack(false)}
        message="Mince byla úspěšně aktualizována"
      />
    </Box>
  )
}
