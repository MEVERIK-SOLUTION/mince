import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Snackbar,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { coinService, imageService } from '../services/coinService'
import { describeCoin, estimateValue } from '../services/groqService'
import type { ValueEstimate } from '../types/coin'

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <Box sx={{ display: 'flex', py: 0.5 }}>
      <Typography color="text.secondary" sx={{ minWidth: 180 }}>{label}:</Typography>
      <Typography fontWeight="medium">{value}</Typography>
    </Box>
  )
}

export default function CoinDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState(0)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [snack, setSnack] = useState('')
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [aiDescription, setAiDescription] = useState<string | null>(null)
  const [aiDescLoading, setAiDescLoading] = useState(false)
  const [aiValue, setAiValue] = useState<ValueEstimate | null>(null)
  const [aiValueLoading, setAiValueLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const { data: coin, isLoading, error } = useQuery({
    queryKey: ['coin', id],
    queryFn: () => coinService.getCoin(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => coinService.deleteCoin(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coins'] })
      queryClient.invalidateQueries({ queryKey: ['coin-stats'] })
      navigate('/coins')
    },
  })

  const deleteImageMutation = useMutation({
    mutationFn: ({ imgId, imgUrl }: { imgId: string; imgUrl: string }) =>
      imageService.deleteImage(imgId, imgUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coin', id] })
      setSnack('Obrázek byl smazán')
    },
  })

  const setPrimaryMutation = useMutation({
    mutationFn: (imgId: string) => imageService.setPrimary(id!, imgId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coin', id] })
      setSnack('Primární obrázek nastaven')
    },
  })

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    try {
      await imageService.uploadImage(id, file, 'obverse', !coin?.images?.length)
      queryClient.invalidateQueries({ queryKey: ['coin', id] })
      setSnack('Obrázek byl nahrán')
    } catch {
      setSnack('Chyba při nahrávání obrázku')
    }
  }

  const handleAiDescribe = async () => {
    if (!coin) return
    setAiDescLoading(true)
    setAiError('')
    try {
      const text = await describeCoin({
        name: coin.name, country: coin.country, year_minted: coin.year_minted,
        denomination: coin.denomination, currency: coin.currency, material: coin.material,
        coin_type: coin.coin_type, condition: coin.condition, series: coin.series,
      })
      setAiDescription(text)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Chyba AI popisu')
    } finally {
      setAiDescLoading(false)
    }
  }

  const handleAiValue = async () => {
    if (!coin) return
    setAiValueLoading(true)
    setAiError('')
    try {
      const val = await estimateValue({
        name: coin.name, country: coin.country, year_minted: coin.year_minted,
        denomination: coin.denomination, currency: coin.currency, material: coin.material,
        coin_type: coin.coin_type, condition: coin.condition, rarity_level: coin.rarity_level,
        series: coin.series,
      })
      setAiValue(val)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Chyba AI ocenění')
    } finally {
      setAiValueLoading(false)
    }
  }

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
  if (error || !coin) return <Alert severity="error">Mince nenalezena.</Alert>

  const images = coin.images ?? []
  const primaryImg = images.find((i) => i.is_primary) ?? images[0]

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/coins')}>
          Zpět
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight="bold">{coin.name}</Typography>
          <Typography color="text.secondary">
            {coin.country}{coin.year_minted ? ` · ${coin.year_minted}` : ''}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={() => navigate(`/coins/${id}/edit`)}
        >
          Upravit
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setDeleteDialog(true)}
        >
          Smazat
        </Button>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Detaily" />
        <Tab label={`Fotografie (${images.length})`} />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          {/* Primary image */}
          <Grid item xs={12} md={4}>
            {primaryImg ? (
              <Card sx={{ cursor: 'pointer' }} onClick={() => setLightboxImg(primaryImg.image_url)}>
                <CardMedia
                  component="img"
                  height={280}
                  image={primaryImg.image_url}
                  alt={coin.name}
                  sx={{ objectFit: 'contain', backgroundColor: 'grey.100', p: 1 }}
                />
              </Card>
            ) : (
              <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'grey.100', borderRadius: 2 }}>
                <Typography variant="h1">🪙</Typography>
              </Box>
            )}
          </Grid>

          {/* Details */}
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 3 }}>
              {/* Chips */}
              <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {coin.coin_type && <Chip label={coin.coin_type} color="primary" />}
                {coin.material && <Chip label={coin.material} variant="outlined" />}
                {coin.condition && <Chip label={coin.condition} color="secondary" variant="outlined" />}
                {coin.rarity_level && <Chip label={`Vzácnost: ${coin.rarity_level}/10`} color="warning" variant="outlined" />}
              </Box>

              <Divider sx={{ mb: 2 }} />

              <DetailRow label="Katalogové číslo" value={coin.catalog_id} />
              <DetailRow label="Země" value={coin.country} />
              <DetailRow label="Rok ražby" value={coin.year_minted} />
              <DetailRow label="Rozsah let" value={coin.year_range} />
              <DetailRow label="Série" value={coin.series} />
              <DetailRow label="Nominální hodnota" value={coin.denomination != null ? `${coin.denomination} ${coin.currency ?? ''}` : undefined} />
              <DetailRow label="Materiál" value={coin.material} />
              <DetailRow label="Hmotnost" value={coin.weight_grams != null ? `${coin.weight_grams} g` : undefined} />
              <DetailRow label="Průměr" value={coin.diameter_mm != null ? `${coin.diameter_mm} mm` : undefined} />
              <DetailRow label="Tloušťka" value={coin.thickness_mm != null ? `${coin.thickness_mm} mm` : undefined} />
              <DetailRow label="Hrana" value={coin.edge_type} />
              <DetailRow label="Aktuální hodnota" value={coin.current_value != null ? `${coin.current_value.toLocaleString('cs-CZ')} ${coin.currency ?? 'Kč'}` : undefined} />
              <DetailRow label="Pořizovací cena" value={coin.acquisition_price != null ? `${coin.acquisition_price.toLocaleString('cs-CZ')} Kč` : undefined} />
              <DetailRow label="Datum pořízení" value={coin.acquisition_date} />
              <DetailRow label="Zdroj" value={coin.acquisition_source} />
              <DetailRow label="Umístění" value={coin.storage_location} />

              {coin.description && (
                <Box sx={{ mt: 2 }}>
                  <Typography color="text.secondary" gutterBottom>Popis:</Typography>
                  <Typography>{coin.description}</Typography>
                </Box>
              )}

              {/* AI Section */}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={aiDescLoading ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
                  onClick={handleAiDescribe}
                  disabled={aiDescLoading}
                >
                  {aiDescLoading ? 'Generuji…' : '✨ AI popis'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={aiValueLoading ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
                  onClick={handleAiValue}
                  disabled={aiValueLoading}
                >
                  {aiValueLoading ? 'Odhaduji…' : '💰 Odhad hodnoty'}
                </Button>
              </Box>

              {aiError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAiError('')}>{aiError}</Alert>}

              {aiDescription && (
                <Box sx={{ p: 2, borderRadius: 2, background: 'linear-gradient(135deg, rgba(124,77,255,0.06), rgba(212,168,71,0.06))', border: '1px solid rgba(124,77,255,0.15)', mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>🤖 AI Popis</Typography>
                  <Typography variant="body2">{aiDescription}</Typography>
                </Box>
              )}

              {aiValue && (
                <Box sx={{ p: 2, borderRadius: 2, background: 'linear-gradient(135deg, rgba(212,168,71,0.08), rgba(124,77,255,0.04))', border: '1px solid rgba(212,168,71,0.2)' }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>💰 AI Odhad hodnoty</Typography>
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1 }}>
                    <Box>
                      <Typography variant="h5" fontWeight="bold" color="warning.main">
                        {aiValue.estimated_value_czk?.toLocaleString('cs-CZ')} Kč
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({aiValue.estimated_value_eur?.toLocaleString('cs-CZ')} €)
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">Rozmezí:</Typography>
                      <Typography variant="body2">
                        {aiValue.value_range_czk?.min?.toLocaleString('cs-CZ')} – {aiValue.value_range_czk?.max?.toLocaleString('cs-CZ')} Kč
                      </Typography>
                    </Box>
                  </Box>
                  {aiValue.factors?.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                      {aiValue.factors.map((f, i) => <Chip key={i} label={f} size="small" variant="outlined" />)}
                    </Box>
                  )}
                  {aiValue.notes && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>{aiValue.notes}</Typography>}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Jistota: {Math.round((aiValue.confidence ?? 0) * 100)} % · Pouze orientační odhad
                  </Typography>
                </Box>
              )}
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <label htmlFor="image-upload">
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageUpload}
              />
              <Button variant="outlined" component="span" startIcon={<AddPhotoAlternateIcon />}>
                Nahrát fotografii
              </Button>
            </label>
            <Typography variant="body2" color="text.secondary">
              Podporované formáty: JPG, PNG, WebP (max 10 MB)
            </Typography>
          </Box>

          {images.length === 0 && (
            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Typography color="text.secondary">Žádné fotografie. Nahrajte první fotografii mince.</Typography>
            </Box>
          )}

          <Grid container spacing={2}>
            {images.map((img) => (
              <Grid item xs={12} sm={6} md={3} key={img.id}>
                <Card>
                  <CardMedia
                    component="img"
                    height={160}
                    image={img.image_url}
                    alt={img.image_type}
                    sx={{ objectFit: 'contain', backgroundColor: 'grey.100', p: 0.5, cursor: 'pointer' }}
                    onClick={() => setLightboxImg(img.image_url)}
                  />
                  <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip label={img.image_type} size="small" />
                    <Box>
                      <Tooltip title={img.is_primary ? 'Primární foto' : 'Nastavit jako primární'}>
                        <IconButton
                          size="small"
                          color={img.is_primary ? 'warning' : 'default'}
                          onClick={() => setPrimaryMutation.mutate(img.id)}
                        >
                          {img.is_primary ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Smazat">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => deleteImageMutation.mutate({ imgId: img.id, imgUrl: img.image_url })}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Delete dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Smazat minci</DialogTitle>
        <DialogContent>
          <Typography>Opravdu chcete smazat minci „{coin.name}"? Tato akce je nevratná.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Zrušit</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            Smazat
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightboxImg} onClose={() => setLightboxImg(null)} maxWidth="md">
        <DialogContent sx={{ p: 1 }}>
          {lightboxImg && (
            <img
              src={lightboxImg}
              alt="Náhled"
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLightboxImg(null)}>Zavřít</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack('')}
        message={snack}
      />
    </Box>
  )
}
