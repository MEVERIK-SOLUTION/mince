import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import CancelIcon from '@mui/icons-material/Cancel'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import type { Coin, CoinFormData } from '../types/coin'
import {
  COIN_TYPES,
  EDGE_TYPES,
  CONDITION_GRADES,
  CURRENCIES,
  MATERIALS,
  COUNTRIES,
} from '../types/coin'
import { identifyCoin, fileToBase64 } from '../services/groqService'

interface CoinFormProps {
  coin?: Coin
  onSubmit: (data: CoinFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export default function CoinForm({ coin, onSubmit, onCancel, isLoading }: CoinFormProps) {
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiSuccess, setAiSuccess] = useState('')

  const { control, handleSubmit, formState: { errors }, reset, getValues } = useForm<CoinFormData>({
    defaultValues: {
      name: coin?.name ?? '',
      country: coin?.country ?? '',
      year_minted: coin?.year_minted ?? undefined,
      year_range: coin?.year_range ?? '',
      denomination: coin?.denomination ?? undefined,
      currency: coin?.currency ?? 'CZK',
      material: coin?.material ?? '',
      weight_grams: coin?.weight_grams ?? undefined,
      diameter_mm: coin?.diameter_mm ?? undefined,
      thickness_mm: coin?.thickness_mm ?? undefined,
      edge_type: coin?.edge_type ?? '',
      coin_type: coin?.coin_type ?? '',
      series: coin?.series ?? '',
      condition: coin?.condition ?? '',
      rarity_level: coin?.rarity_level ?? undefined,
      current_value: coin?.current_value ?? undefined,
      acquisition_price: coin?.acquisition_price ?? undefined,
      acquisition_date: coin?.acquisition_date ?? '',
      acquisition_source: coin?.acquisition_source ?? '',
      storage_location: coin?.storage_location ?? '',
      description: coin?.description ?? '',
    },
  })

  const num = (val: string | number | undefined) =>
    val === '' || val === undefined ? undefined : Number(val)

  const handleAiIdentify = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setAiError('Obrázek je příliš velký (max 4 MB)')
      return
    }
    setAiLoading(true)
    setAiError('')
    setAiSuccess('')
    try {
      const base64 = await fileToBase64(file)
      const result = await identifyCoin(base64)
      const current = getValues()
      reset({
        ...current,
        name: result.name ?? current.name,
        country: result.country && COUNTRIES.includes(result.country as typeof COUNTRIES[number]) ? result.country : current.country,
        year_minted: result.year_minted ?? current.year_minted,
        denomination: result.denomination ?? current.denomination,
        currency: result.currency ?? current.currency,
        material: result.material && MATERIALS.includes(result.material as typeof MATERIALS[number]) ? result.material : current.material,
        weight_grams: result.weight_grams ?? current.weight_grams,
        diameter_mm: result.diameter_mm ?? current.diameter_mm,
        coin_type: result.coin_type ?? current.coin_type,
        condition: result.condition ?? current.condition,
        rarity_level: result.rarity_level ?? current.rarity_level,
        series: result.series ?? current.series,
        description: result.description ?? current.description,
      })
      setAiSuccess(`Identifikováno s jistotou ${Math.round((result.confidence ?? 0) * 100)} %`)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Chyba AI identifikace')
    } finally {
      setAiLoading(false)
      e.target.value = ''
    }
  }

  const handleFormSubmit = async (raw: CoinFormData) => {
    const data: CoinFormData = {
      ...raw,
      year_minted: num(raw.year_minted),
      denomination: num(raw.denomination),
      weight_grams: num(raw.weight_grams),
      diameter_mm: num(raw.diameter_mm),
      thickness_mm: num(raw.thickness_mm),
      rarity_level: num(raw.rarity_level),
      current_value: num(raw.current_value),
      acquisition_price: num(raw.acquisition_price),
    }
    await onSubmit(data)
  }

  const section = (title: string) => (
    <Box sx={{ mt: 3, mb: 1 }}>
      <Typography variant="subtitle1" fontWeight="bold" color="primary">{title}</Typography>
      <Divider />
    </Box>
  )

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>

          {/* AI Identification */}
          <Box sx={{ mb: 3, p: 2, borderRadius: 2, background: 'linear-gradient(135deg, rgba(124,77,255,0.08), rgba(212,168,71,0.08))', border: '1px solid rgba(124,77,255,0.2)' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>🤖 AI Identifikace mince</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <label htmlFor="ai-identify-input">
                <input id="ai-identify-input" type="file" accept="image/*" hidden onChange={handleAiIdentify} disabled={aiLoading} />
                <Button variant="outlined" component="span" startIcon={aiLoading ? <CircularProgress size={18} /> : <AutoFixHighIcon />} disabled={aiLoading}>
                  {aiLoading ? 'Analyzuji…' : 'Identifikovat z fotky'}
                </Button>
              </label>
              <Typography variant="caption" color="text.secondary">
                Nahrajte fotografii mince – AI vyplní formulář
              </Typography>
            </Box>
            {aiError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setAiError('')}>{aiError}</Alert>}
            {aiSuccess && <Alert severity="success" sx={{ mt: 1 }} onClose={() => setAiSuccess('')}>{aiSuccess}</Alert>}
          </Box>

          {section('Základní informace')}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Název je povinný' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Název mince *"
                    fullWidth
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="country"
                control={control}
                rules={{ required: 'Země je povinná' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    select
                    label="Země původu *"
                    fullWidth
                    error={!!errors.country}
                    helperText={errors.country?.message}
                  >
                    {COUNTRIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="year_minted"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Rok ražby"
                    type="number"
                    fullWidth
                    inputProps={{ min: 1, max: new Date().getFullYear() }}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="year_range"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Rozsah let (např. 1993–2000)" fullWidth value={field.value ?? ''} />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="coin_type"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Typ mince" fullWidth value={field.value ?? ''}>
                    <MenuItem value="">—</MenuItem>
                    {COIN_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="series"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Série / edice" fullWidth value={field.value ?? ''} />
                )}
              />
            </Grid>
          </Grid>

          {section('Fyzické vlastnosti')}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Controller
                name="material"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Materiál" fullWidth value={field.value ?? ''}>
                    <MenuItem value="">—</MenuItem>
                    {MATERIALS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="weight_grams"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Hmotnost (g)"
                    type="number"
                    fullWidth
                    inputProps={{ step: 0.001, min: 0 }}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="diameter_mm"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Průměr (mm)"
                    type="number"
                    fullWidth
                    inputProps={{ step: 0.01, min: 0 }}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="thickness_mm"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Tloušťka (mm)"
                    type="number"
                    fullWidth
                    inputProps={{ step: 0.01, min: 0 }}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="edge_type"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Hrana" fullWidth value={field.value ?? ''}>
                    <MenuItem value="">—</MenuItem>
                    {EDGE_TYPES.map((e) => <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>
          </Grid>

          {section('Hodnota a stav')}
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Controller
                name="denomination"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Nominální hodnota"
                    type="number"
                    fullWidth
                    inputProps={{ step: 0.01, min: 0 }}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Měna" fullWidth value={field.value ?? 'CZK'}>
                    {CURRENCIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="current_value"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Aktuální hodnota"
                    type="number"
                    fullWidth
                    inputProps={{ step: 0.01, min: 0 }}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Controller
                name="rarity_level"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Vzácnost (1–10)"
                    type="number"
                    fullWidth
                    inputProps={{ min: 1, max: 10, step: 1 }}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="condition"
                control={control}
                render={({ field }) => (
                  <TextField {...field} select label="Stav" fullWidth value={field.value ?? ''}>
                    <MenuItem value="">—</MenuItem>
                    {CONDITION_GRADES.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                  </TextField>
                )}
              />
            </Grid>
          </Grid>

          {section('Pořízení a skladování')}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Controller
                name="acquisition_price"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Pořizovací cena"
                    type="number"
                    fullWidth
                    inputProps={{ step: 0.01, min: 0 }}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    value={field.value ?? ''}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="acquisition_date"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Datum pořízení" type="date" fullWidth InputLabelProps={{ shrink: true }} value={field.value ?? ''} />
                )}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Controller
                name="acquisition_source"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Zdroj pořízení" fullWidth value={field.value ?? ''} />
                )}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Controller
                name="storage_location"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Umístění / uložení" fullWidth value={field.value ?? ''} />
                )}
              />
            </Grid>
          </Grid>

          {section('Popis')}
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Popis mince" fullWidth multiline rows={4} value={field.value ?? ''} />
            )}
          />

          {/* Actions */}
          <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              startIcon={<CancelIcon />}
              onClick={onCancel}
              disabled={isLoading}
            >
              Zrušit
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={isLoading}
            >
              {isLoading ? 'Ukládání…' : 'Uložit'}
            </Button>
          </Box>
        </form>
      </CardContent>
    </Card>
  )
}
