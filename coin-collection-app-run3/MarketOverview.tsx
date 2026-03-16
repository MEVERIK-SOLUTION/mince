import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Alert,
  Skeleton,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as AttachMoneyIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  Star as StarIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

interface MarketStatistics {
  total_coins: number;
  coins_with_prices: number;
  price_coverage_percent: number;
  average_price_change_24h: number;
  total_price_updates_24h: number;
}

interface CoinSummary {
  id: number;
  name: string;
  country?: string;
  year?: number;
  current_value: number;
  currency: string;
  last_update?: string;
}

interface PriceChange {
  coin_id: number;
  change_percent: number;
  change_absolute: number;
}

interface PreciousMetalPrice {
  usd: number;
  eur: number;
  czk: number;
  last_updated_at: number;
}

interface MarketData {
  statistics: MarketStatistics;
  most_expensive: CoinSummary[];
  recently_updated: CoinSummary[];
  top_gainers: PriceChange[];
  top_losers: PriceChange[];
  precious_metals: {
    success: boolean;
    prices: {
      gold?: PreciousMetalPrice;
      silver?: PreciousMetalPrice;
      platinum?: PreciousMetalPrice;
      palladium?: PreciousMetalPrice;
    };
  };
}

interface MarketOverviewProps {
  data?: MarketData;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`market-tabpanel-${index}`}
      aria-labelledby={`market-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  data,
  loading = false,
  error,
  onRefresh,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatPrice = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatMetalPrice = (price: number, unit: string = 'USD/oz') => {
    return `${formatPrice(price)} ${unit}`;
  };

  if (loading) {
    return (
      <Box>
        <Grid container spacing={3}>
          {[...Array(6)].map((_, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert 
        severity="error" 
        action={
          onRefresh && (
            <IconButton color="inherit" size="small" onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
          )
        }
      >
        {error}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert severity="info">
        Žádná data o trhu nejsou k dispozici
      </Alert>
    );
  }

  const { statistics, most_expensive, recently_updated, top_gainers, top_losers, precious_metals } = data;

  return (
    <Box>
      {/* Hlavní statistiky */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
            <AssessmentIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" color="primary">
              {statistics.total_coins.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Celkem mincí
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
            <AttachMoneyIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
            <Typography variant="h4" color="success.main">
              {statistics.price_coverage_percent.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pokrytí cenami
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={statistics.price_coverage_percent} 
              sx={{ mt: 1 }}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
            <TimelineIcon sx={{ 
              fontSize: 40, 
              color: statistics.average_price_change_24h >= 0 ? 'success.main' : 'error.main',
              mb: 1 
            }} />
            <Typography 
              variant="h4" 
              color={statistics.average_price_change_24h >= 0 ? 'success.main' : 'error.main'}
            >
              {formatPercent(statistics.average_price_change_24h)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Průměrná změna 24h
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center', height: '100%' }}>
            <ScheduleIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
            <Typography variant="h4" color="info.main">
              {statistics.total_price_updates_24h}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Aktualizací za 24h
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Drahé kovy */}
      {precious_metals.success && (
        <Card sx={{ mb: 3 }}>
          <CardHeader 
            title="Ceny drahých kovů"
            action={
              <Tooltip title="Aktualizovat">
                <IconButton onClick={onRefresh}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            }
          />
          <CardContent>
            <Grid container spacing={2}>
              {Object.entries(precious_metals.prices).map(([metal, price]) => {
                if (!price) return null;
                
                const metalNames = {
                  gold: 'Zlato',
                  silver: 'Stříbro', 
                  platinum: 'Platina',
                  palladium: 'Palladium'
                };

                return (
                  <Grid item xs={6} sm={3} key={metal}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {metalNames[metal as keyof typeof metalNames]}
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {formatPrice(price.usd)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        za unci
                      </Typography>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Tabulkové zobrazení */}
      <Card>
        <CardHeader title="Přehled trhu" />
        <CardContent>
          <Tabs value={tabValue} onChange={handleTabChange} variant={isMobile ? "scrollable" : "standard"}>
            <Tab label="Nejdražší" />
            <Tab label="Nedávno aktualizované" />
            <Tab label="Největší růst" />
            <Tab label="Největší pokles" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <List>
              {most_expensive.map((coin, index) => (
                <ListItem key={coin.id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      {index + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={coin.name}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {coin.country} • {coin.year}
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {formatPrice(coin.current_value, coin.currency)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <List>
              {recently_updated.map((coin) => (
                <ListItem key={coin.id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'info.main' }}>
                      <ScheduleIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={coin.name}
                    secondary={
                      <Box>
                        <Typography variant="h6" color="primary">
                          {formatPrice(coin.current_value, coin.currency)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Aktualizováno: {coin.last_update ? format(new Date(coin.last_update), 'dd.MM.yyyy HH:mm', { locale: cs }) : 'Neznámo'}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <List>
              {top_gainers.map((change, index) => (
                <ListItem key={change.coin_id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'success.main' }}>
                      <TrendingUpIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`Mince #${change.coin_id}`}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={formatPercent(change.change_percent)}
                          color="success"
                          size="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                          {formatPrice(change.change_absolute)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <List>
              {top_losers.map((change, index) => (
                <ListItem key={change.coin_id} divider>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'error.main' }}>
                      <TrendingDownIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`Mince #${change.coin_id}`}
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={formatPercent(change.change_percent)}
                          color="error"
                          size="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                          {formatPrice(change.change_absolute)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MarketOverview;