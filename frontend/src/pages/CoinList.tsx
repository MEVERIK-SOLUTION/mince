import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import SearchIcon from '@mui/icons-material/Search'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { coinService } from '../services/coinService'
import type { CoinSearchFilters } from '../types/coin'

export default function CoinList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<CoinSearchFilters>({})
  const [search, setSearch] = useState('')
  const [deleteSnack, setDeleteSnack] = useState(false)

  const { data: coins, isLoading, error } = useQuery({
    queryKey: ['coins', filters],
    queryFn: () => coinService.getCoins(filters),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coinService.deleteCoin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coins'] })
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] })
      setDeleteSnack(true)
    },
  })

  const handleSearch = () => {
    setFilters((prev) => ({ ...prev, search: search || undefined }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Opravdu chcete smazat tuto minci?')) {
      deleteMutation.mutate(id)
    }
  }

  const primaryImage = (coin: { images?: { is_primary: boolean; image_url: string }[] }) =>
    coin.images?.find((i) => i.is_primary)?.image_url ??
    coin.images?.[0]?.image_url ??
    null

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Katalog mincí
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/coins/new')}
        >
          Přidat minci
        </Button>
      </Box>

      {/* Filtrování */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="Hledat"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          size="small"
          sx={{ minWidth: 240 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleSearch} size="small">
                  <SearchIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          label="Typ mince"
          value={filters.coin_type ?? ''}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, coin_type: e.target.value || undefined }))
          }
          size="small"
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Vše</MenuItem>
          <MenuItem value="oběžná">Oběžná</MenuItem>
          <MenuItem value="pamětní">Pamětní</MenuItem>
          <MenuItem value="investiční">Investiční</MenuItem>
          <MenuItem value="antická">Antická</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          onClick={() => {
            setFilters({})
            setSearch('')
          }}
        >
          Resetovat
        </Button>
      </Box>

      {/* Výsledky */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Chyba při načítání mincí. Zkontrolujte nastavení Supabase.
        </Alert>
      )}

      {!isLoading && coins && coins.length === 0 && (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Zatím zde nejsou žádné mince
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/coins/new')}
          >
            Přidat první minci
          </Button>
        </Box>
      )}

      <Grid container spacing={3}>
        {(coins ?? []).map((coin) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={coin.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardActionArea onClick={() => navigate(`/coins/${coin.id}`)}>
                {primaryImage(coin) ? (
                  <CardMedia
                    component="img"
                    height={180}
                    image={primaryImage(coin)!}
                    alt={coin.name}
                    sx={{ objectFit: 'contain', backgroundColor: 'grey.100', p: 1 }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 180,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'grey.100',
                    }}
                  >
                    <Typography variant="h2">🪙</Typography>
                  </Box>
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" noWrap title={coin.name}>
                    {coin.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {coin.country}
                    {coin.year_minted ? ` · ${coin.year_minted}` : ''}
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {coin.coin_type && (
                      <Chip label={coin.coin_type} size="small" color="primary" variant="outlined" />
                    )}
                    {coin.material && (
                      <Chip label={coin.material} size="small" variant="outlined" />
                    )}
                  </Box>
                  {coin.current_value != null && (
                    <Typography variant="body2" color="success.main" fontWeight="bold" mt={1}>
                      {coin.current_value.toLocaleString('cs-CZ')} {coin.currency || 'Kč'}
                    </Typography>
                  )}
                </CardContent>
              </CardActionArea>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1, gap: 1 }}>
                <Tooltip title="Upravit">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/coins/${coin.id}/edit`)
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Smazat">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => handleDelete(e, coin.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Snackbar
        open={deleteSnack}
        autoHideDuration={3000}
        onClose={() => setDeleteSnack(false)}
        message="Mince byla smazána"
      />
    </Box>
  )
}
