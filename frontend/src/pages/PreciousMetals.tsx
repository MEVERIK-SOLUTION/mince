import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  alpha,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import RefreshIcon from '@mui/icons-material/Refresh'
import { fetchMetals, type MetalPrice } from '../services/metalsService'

type Currency = 'USD' | 'EUR' | 'CZK'

const METAL_COLORS: Record<string, string> = {
  XAU: '#d4a847',
  XAG: '#c0c0c0',
  XPT: '#8ab4f8',
  XPD: '#7c4dff',
  XRH: '#00c896',
}

const METAL_EMOJI: Record<string, string> = {
  XAU: '🥇',
  XAG: '🥈',
  XPT: '💎',
  XPD: '🔮',
  XRH: '✨',
}

function formatPrice(value: number, currency: Currency): string {
  const opts: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'CZK' ? 0 : 2,
    maximumFractionDigits: currency === 'CZK' ? 0 : 2,
  }
  return new Intl.NumberFormat('cs-CZ', opts).format(value)
}

function getPrice(metal: MetalPrice, currency: Currency): number {
  switch (currency) {
    case 'EUR': return metal.price_eur
    case 'CZK': return metal.price_czk
    default: return metal.price_usd
  }
}

interface MetalCardProps {
  metal: MetalPrice
  currency: Currency
}

function MetalCard({ metal, currency }: MetalCardProps) {
  const accent = METAL_COLORS[metal.symbol] ?? '#d4a847'
  const price = getPrice(metal, currency)
  const isUp = metal.change_24h >= 0

  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: alpha(accent, 0.35),
          boxShadow: `0 8px 32px ${alpha(accent, 0.12)}`,
          transform: 'translateY(-2px)',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent 0%, ${accent} 50%, transparent 100%)`,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                backgroundColor: alpha(accent, 0.12),
                border: `1px solid ${alpha(accent, 0.2)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              {METAL_EMOJI[metal.symbol]}
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e8eaf6', lineHeight: 1.2 }}>
                {metal.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(232,234,246,0.4)', fontSize: '0.7rem' }}>
                {metal.symbol} / {metal.unit}
              </Typography>
            </Box>
          </Box>
          <Chip
            size="small"
            icon={isUp ? <TrendingUpIcon sx={{ fontSize: 14 }} /> : <TrendingDownIcon sx={{ fontSize: 14 }} />}
            label={`${isUp ? '+' : ''}${metal.change_24h.toFixed(2)}%`}
            sx={{
              backgroundColor: alpha(isUp ? '#00c896' : '#ef5350', 0.12),
              color: isUp ? '#00c896' : '#ef5350',
              border: `1px solid ${alpha(isUp ? '#00c896' : '#ef5350', 0.25)}`,
              fontWeight: 600,
              fontSize: '0.72rem',
              height: 26,
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
        </Box>

        {/* Price */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: accent,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            mb: 1,
          }}
        >
          {formatPrice(price, currency)}
        </Typography>

        {/* Secondary prices */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          {(['USD', 'EUR', 'CZK'] as Currency[])
            .filter((c) => c !== currency)
            .map((c) => (
              <Typography key={c} variant="caption" sx={{ color: 'rgba(232,234,246,0.4)', fontSize: '0.72rem' }}>
                {formatPrice(getPrice(metal, c), c)}
              </Typography>
            ))}
        </Box>
      </CardContent>
    </Card>
  )
}

export default function PreciousMetals() {
  const [currency, setCurrency] = useState<Currency>('CZK')
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['metals'],
    queryFn: fetchMetals,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: '#e8eaf6', letterSpacing: '-0.02em', mb: 0.5 }}
          >
            Drahé kovy
          </Typography>
          <Typography sx={{ color: 'rgba(232,234,246,0.5)', fontSize: '0.9rem' }}>
            Aktuální ceny drahých kovů na světových trzích
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {lastUpdate && (
            <Typography variant="caption" sx={{ color: 'rgba(232,234,246,0.3)', fontSize: '0.72rem' }}>
              Aktualizováno {lastUpdate}
            </Typography>
          )}
          <Tooltip title="Obnovit">
            <IconButton
              onClick={() => refetch()}
              size="small"
              sx={{ color: 'rgba(232,234,246,0.5)' }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <ToggleButtonGroup
            size="small"
            value={currency}
            exclusive
            onChange={(_, v) => v && setCurrency(v)}
            sx={{
              '& .MuiToggleButton-root': {
                color: 'rgba(232,234,246,0.5)',
                borderColor: 'rgba(255,255,255,0.1)',
                px: 1.5,
                py: 0.5,
                fontSize: '0.75rem',
                fontWeight: 600,
                '&.Mui-selected': {
                  backgroundColor: alpha('#d4a847', 0.15),
                  color: '#d4a847',
                  borderColor: alpha('#d4a847', 0.3),
                },
              },
            }}
          >
            <ToggleButton value="CZK">CZK</ToggleButton>
            <ToggleButton value="EUR">EUR</ToggleButton>
            <ToggleButton value="USD">USD</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Metal cards */}
      <Grid container spacing={2.5}>
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Grid item xs={12} sm={6} lg={4} key={i}>
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Skeleton variant="rounded" width={44} height={44} sx={{ mb: 2, bgcolor: 'rgba(255,255,255,0.06)' }} />
                    <Skeleton variant="text" width="60%" height={40} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                    <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                  </CardContent>
                </Card>
              </Grid>
            ))
          : data?.metals.map((metal) => (
              <Grid item xs={12} sm={6} lg={4} key={metal.symbol}>
                <MetalCard metal={metal} currency={currency} />
              </Grid>
            ))}
      </Grid>

      {/* Info note */}
      {data && !data.success && (
        <Typography
          variant="caption"
          sx={{ color: 'rgba(232,234,246,0.25)', display: 'block', mt: 3 }}
        >
          * Zobrazeny přibližné hodnoty – nepodařilo se načíst aktuální data z API.
        </Typography>
      )}

      {data?.stale && (
        <Typography
          variant="caption"
          sx={{ color: 'rgba(232,234,246,0.25)', display: 'block', mt: 3 }}
        >
          * Data z mezipaměti – aktualizace neproběhla.
        </Typography>
      )}
    </Box>
  )
}
