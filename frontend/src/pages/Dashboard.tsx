import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ViewListIcon from '@mui/icons-material/ViewList'
import EuroIcon from '@mui/icons-material/Euro'
import PublicIcon from '@mui/icons-material/Public'
import { coinService } from '../services/coinService'

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
      color: 'primary.main',
    },
    {
      label: 'Celková hodnota',
      value: stats ? `${stats.total_value.toLocaleString('cs-CZ')} Kč` : '—',
      color: 'success.main',
    },
    {
      label: 'Zemí původu',
      value: stats?.by_country.length ?? 0,
      color: 'info.main',
    },
    {
      label: 'Typů mincí',
      value: stats?.by_type.length ?? 0,
      color: 'secondary.main',
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Dashboard
          </Typography>
          <Typography color="text.secondary">
            Přehled vaší numismatické sbírky
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/coins/new')}
        >
          Přidat minci
        </Button>
      </Box>

      {/* Statistiky */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Card>
              <CardContent>
                {isLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  <Typography variant="h4" color={card.color} fontWeight="bold">
                    {card.value}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  {card.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Rychlé akce */}
      <Typography variant="h5" gutterBottom fontWeight="medium">
        Rychlé akce
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }} onClick={() => navigate('/coins/new')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <AddIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6">Přidat minci</Typography>
              <Typography variant="body2" color="text.secondary">
                Zaznamenat novou minci do katalogu
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }} onClick={() => navigate('/coins')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <ViewListIcon sx={{ fontSize: 48, color: 'info.main', mb: 1 }} />
              <Typography variant="h6">Katalog mincí</Typography>
              <Typography variant="body2" color="text.secondary">
                Procházet a filtrovat sbírku
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }} onClick={() => navigate('/collections')}>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              <EuroIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
              <Typography variant="h6">Kolekce</Typography>
              <Typography variant="body2" color="text.secondary">
                Spravovat vlastní kolekce
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Top 5 zemí */}
      {stats && stats.by_country.length > 0 && (
        <Box>
          <Typography variant="h5" gutterBottom fontWeight="medium">
            <PublicIcon sx={{ mr: 1, verticalAlign: 'bottom' }} />
            Top země
          </Typography>
          <Grid container spacing={2}>
            {stats.by_country.slice(0, 5).map((item) => (
              <Grid item xs={6} sm={4} md={2} key={item.country}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h5" color="primary.main">
                      {item.count}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
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
