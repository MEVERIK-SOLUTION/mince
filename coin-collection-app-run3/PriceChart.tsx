import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Alert,
  Skeleton,
  Grid,
  Paper,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  MoreVert as MoreVertIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Fullscreen as FullscreenIcon,
  Timeline as TimelineIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
} from '@mui/icons-material';
import { format, parseISO, subDays, subMonths, subYears } from 'date-fns';
import { cs } from 'date-fns/locale';

interface PriceData {
  date: string;
  price: number;
  currency: string;
  source: string;
  confidence: number;
}

interface PriceStatistics {
  current_price: number;
  min_price: number;
  max_price: number;
  avg_price: number;
  price_change: number;
  price_change_percent: number;
  data_points: number;
}

interface PriceChartProps {
  coinId: number;
  coinName: string;
  data?: PriceData[];
  statistics?: PriceStatistics;
  loading?: boolean;
  error?: string;
  height?: number;
  showControls?: boolean;
  showStatistics?: boolean;
  currency?: string;
}

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';
type ChartType = 'line' | 'area' | 'bar';

const TIME_RANGES: Record<TimeRange, { label: string; days?: number }> = {
  '7d': { label: '7 dní', days: 7 },
  '30d': { label: '30 dní', days: 30 },
  '90d': { label: '3 měsíce', days: 90 },
  '1y': { label: '1 rok', days: 365 },
  'all': { label: 'Vše' },
};

const CHART_COLORS = {
  primary: '#1976d2',
  success: '#2e7d32',
  error: '#d32f2f',
  warning: '#ed6c02',
  gradient: ['#1976d2', '#42a5f5'],
};

export const PriceChart: React.FC<PriceChartProps> = ({
  coinId,
  coinName,
  data = [],
  statistics,
  loading = false,
  error,
  height = 400,
  showControls = true,
  showStatistics = true,
  currency = 'USD',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // Filtrování dat podle časového rozsahu
  const filteredData = useMemo(() => {
    if (!data.length) return [];
    
    const range = TIME_RANGES[timeRange];
    if (!range.days) return data; // 'all'
    
    const cutoffDate = subDays(new Date(), range.days);
    return data.filter(item => parseISO(item.date) >= cutoffDate);
  }, [data, timeRange]);

  // Formátování dat pro grafy
  const chartData = useMemo(() => {
    return filteredData.map(item => ({
      ...item,
      date: format(parseISO(item.date), 'dd.MM', { locale: cs }),
      fullDate: format(parseISO(item.date), 'dd.MM.yyyy HH:mm', { locale: cs }),
      price: Number(item.price.toFixed(2)),
    }));
  }, [filteredData]);

  // Výpočet trendu
  const trend = useMemo(() => {
    if (!statistics) return null;
    
    const { price_change_percent } = statistics;
    
    if (Math.abs(price_change_percent) < 0.1) {
      return { direction: 'flat', icon: TrendingFlatIcon, color: 'text.secondary' };
    } else if (price_change_percent > 0) {
      return { direction: 'up', icon: TrendingUpIcon, color: 'success.main' };
    } else {
      return { direction: 'down', icon: TrendingDownIcon, color: 'error.main' };
    }
  }, [statistics]);

  const handleTimeRangeChange = (event: React.MouseEvent<HTMLElement>, newRange: TimeRange) => {
    if (newRange !== null) {
      setTimeRange(newRange);
    }
  };

  const handleChartTypeChange = (event: React.MouseEvent<HTMLElement>, newType: ChartType) => {
    if (newType !== null) {
      setChartType(newType);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const formatPrice = (value: number) => {
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Paper sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            {data.fullDate}
          </Typography>
          <Typography variant="h6" color="primary">
            {formatPrice(data.price)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Zdroj: {data.source}
          </Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            Spolehlivost: {(data.confidence * 100).toFixed(0)}%
          </Typography>
        </Paper>
      );
    }
    return null;
  };

  const renderChart = () => {
    if (loading) {
      return <Skeleton variant="rectangular" width="100%" height={height} />;
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      );
    }

    if (!chartData.length) {
      return (
        <Box
          sx={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary',
          }}
        >
          <Typography variant="body1">
            Žádná cenová data pro vybraný časový rozsah
          </Typography>
        </Box>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    switch (chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={formatPrice} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke={CHART_COLORS.primary}
                fillOpacity={1}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={formatPrice} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Bar dataKey="price" fill={CHART_COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        );

      default: // line
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={formatPrice} />
              <RechartsTooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="price"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">
              Cenový vývoj - {coinName}
            </Typography>
            {trend && (
              <Chip
                icon={<trend.icon />}
                label={statistics ? formatPercent(statistics.price_change_percent) : ''}
                size="small"
                sx={{ color: trend.color }}
                variant="outlined"
              />
            )}
          </Box>
        }
        action={
          showControls && (
            <IconButton onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          )
        }
      />

      <CardContent>
        {/* Statistiky */}
        {showStatistics && statistics && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Aktuální cena
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatPrice(statistics.current_price)}
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Změna
                </Typography>
                <Typography 
                  variant="h6" 
                  color={statistics.price_change >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatPercent(statistics.price_change_percent)}
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Minimum
                </Typography>
                <Typography variant="h6">
                  {formatPrice(statistics.min_price)}
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  Maximum
                </Typography>
                <Typography variant="h6">
                  {formatPrice(statistics.max_price)}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* Ovládací prvky */}
        {showControls && (
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              size="small"
            >
              {Object.entries(TIME_RANGES).map(([key, { label }]) => (
                <ToggleButton key={key} value={key}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {!isMobile && (
              <ToggleButtonGroup
                value={chartType}
                exclusive
                onChange={handleChartTypeChange}
                size="small"
              >
                <ToggleButton value="line">
                  <Tooltip title="Čárový graf">
                    <TimelineIcon />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="area">
                  <Tooltip title="Plošný graf">
                    <AreaChart />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="bar">
                  <Tooltip title="Sloupcový graf">
                    <BarChartIcon />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>
        )}

        {/* Graf */}
        {renderChart()}

        {/* Informace o datech */}
        {chartData.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              {chartData.length} datových bodů
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Poslední aktualizace: {format(parseISO(data[0]?.date || new Date().toISOString()), 'dd.MM.yyyy HH:mm', { locale: cs })}
            </Typography>
          </Box>
        )}
      </CardContent>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <DownloadIcon sx={{ mr: 1 }} />
          Exportovat data
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ShareIcon sx={{ mr: 1 }} />
          Sdílet graf
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <FullscreenIcon sx={{ mr: 1 }} />
          Zobrazit na celou obrazovku
        </MenuItem>
      </Menu>
    </Card>
  );
};

export default PriceChart;