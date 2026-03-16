import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  alpha,
  Skeleton,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ViewListIcon from '@mui/icons-material/ViewList'
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark'
import PublicIcon from '@mui/icons-material/Public'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import DiamondIcon from '@mui/icons-material/Diamond'
import { coinService } from '../services/coinService'

interface StatCardProps {
  label: string
  value: React.ReactNode
  accent: string
  icon: React.ReactNode
  isLoading: boolean
}

function StatCard({ label, value, accent, icon, isLoading }: StatCardProps) {
  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              backgroundColor: alpha(accent, 0.12),
              border: `1px solid ${alpha(accent, 0.2)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accent,
            }}
          >
            {icon}
          </Box>
        </Box>
        {isLoading ? (
          <Skeleton variant="text" width="60%" height={40} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
        ) : (
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: '#e8eaf6',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              mb: 0.5,
            }}
          >
            {value}
          </Typography>
        )}
        <Typography variant="body2" sx={{ color: 'rgba(232,234,246,0.5)', fontSize: '0.8rem' }}>
          {label}
        </Typography>
      </CardContent>
    </Card>
  )
}

interface QuickActionProps {
  label: string
  description: string
  icon: React.ReactNode
  accent: string
  onClick: () => void
}

function QuickAction({ label, description, icon, accent, onClick }: QuickActionProps) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: alpha(accent, 0.35),
          boxShadow: `0 8px 32px ${alpha(accent, 0.12)}`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            backgroundColor: alpha(accent, 0.1),
            border: `1px solid ${alpha(accent, 0.2)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            mb: 2,
            fontSize: '1.5rem',
          }}
        >
          {icon}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e8eaf6', mb: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(232,234,246,0.45)', fontSize: '0.8rem' }}>
          {description}
        </Typography>
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: stats, isLoading } = useQuery({
    queryKey: ['coin-stats'],
    queryFn: () => coinService.getStats(),
  })

  const statCards = [
    {
      label: 'Mincí celkem',
      value: stats?.total_coins ?? 0,
      accent: '#d4a847',
      icon: <DiamondIcon fontSize="small" />,
    },
    {
      label: 'Celková hodnota',
      value: stats ? `${stats.total_value.toLocaleString('cs-CZ')} Kč` : '—',
      accent: '#00c896',
      icon: <TrendingUpIcon fontSize="small" />,
    },
    {
      label: 'Zemí původu',
      value: stats?.by_country.length ?? 0,
      accent: '#29b6f6',
      icon: <PublicIcon fontSize="small" />,
    },
    {
      label: 'Typů mincí',
      value: stats?.by_type.length ?? 0,
      accent: '#7c4dff',
      icon: <CollectionsBookmarkIcon fontSize="small" />,
    },
  ]

  return (
    <Box>
      {/* Page header */}
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
            Dashboard
          </Typography>
          <Typography sx={{ color: 'rgba(232,234,246,0.5)', fontSize: '0.9rem' }}>
            Přehled vaší numismatické sbírky
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/coins/new')}
          sx={{ flexShrink: 0 }}
        >
          Přidat minci
        </Button>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.label}>
            <StatCard {...card} isLoading={isLoading} />
          </Grid>
        ))}
      </Grid>

      {/* Quick actions */}
      <Typography
        variant="overline"
        sx={{
          color: 'rgba(232,234,246,0.3)',
          fontWeight: 700,
          letterSpacing: '0.1em',
          mb: 1.5,
          display: 'block',
        }}
      >
        Rychlé akce
      </Typography>
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <QuickAction
            label="Přidat minci"
            description="Zaznamenat novou minci do katalogu"
            icon={<AddIcon />}
            accent="#d4a847"
            onClick={() => navigate('/coins/new')}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <QuickAction
            label="Katalog mincí"
            description="Procházet a filtrovat sbírku"
            icon={<ViewListIcon />}
            accent="#29b6f6"
            onClick={() => navigate('/coins')}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <QuickAction
            label="Kolekce"
            description="Spravovat vlastní kolekce"
            icon={<CollectionsBookmarkIcon />}
            accent="#7c4dff"
            onClick={() => navigate('/collections')}
          />
        </Grid>
      </Grid>

      {/* Top countries */}
      {stats && stats.by_country.length > 0 && (
        <Box>
          <Typography
            variant="overline"
            sx={{
              color: 'rgba(232,234,246,0.3)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              mb: 1.5,
              display: 'block',
            }}
          >
            Top země
          </Typography>
          <Grid container spacing={2}>
            {stats.by_country.slice(0, 6).map((item) => (
              <Grid item xs={6} sm={4} md={2} key={item.country}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', p: '16px !important' }}>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 700, color: '#d4a847', mb: 0.25 }}
                    >
                      {item.count}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: 'rgba(232,234,246,0.5)', fontSize: '0.72rem' }}
                      noWrap
                    >
                      {item.country}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  )
}
