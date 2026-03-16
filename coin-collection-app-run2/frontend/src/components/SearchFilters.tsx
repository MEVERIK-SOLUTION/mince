import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  IconButton,
  Collapse,
  Grid,
  Slider,
  Typography,
  Autocomplete,
  Divider,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { cs } from 'date-fns/locale';
import { CoinQueryParams } from '../types/coin';
import { 
  COUNTRIES, 
  CURRENCIES, 
  COIN_TYPES, 
  MATERIALS, 
  CONDITION_GRADES,
  SEARCH_DEBOUNCE_MS 
} from '../utils/constants';
import { useFilterOptions } from '../hooks/useCoinData';

interface SearchFiltersProps {
  onFiltersChange: (filters: CoinQueryParams) => void;
  initialFilters?: CoinQueryParams;
  showAdvanced?: boolean;
  compact?: boolean;
}

interface FilterChipProps {
  label: string;
  value: string;
  onDelete: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, value, onDelete }) => (
  <Chip
    label={`${label}: ${value}`}
    onDelete={onDelete}
    size="small"
    variant="outlined"
    sx={{ m: 0.5 }}
  />
);

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  onFiltersChange,
  initialFilters = {},
  showAdvanced = true,
  compact = false,
}) => {
  const [filters, setFilters] = useState<CoinQueryParams>(initialFilters);
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || '');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const { data: filterOptions } = useFilterOptions();

  // Debounced search
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      updateFilter('search', searchTerm || undefined);
    }, SEARCH_DEBOUNCE_MS);

    setSearchDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [searchTerm]);

  const updateFilter = (key: keyof CoinQueryParams, value: any) => {
    const newFilters = { ...filters };
    
    if (value === undefined || value === '' || value === null) {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearchTerm('');
    onFiltersChange({});
  };

  const clearFilter = (key: keyof CoinQueryParams) => {
    updateFilter(key, undefined);
    if (key === 'search') {
      setSearchTerm('');
    }
  };

  const getActiveFiltersCount = () => {
    return Object.keys(filters).filter(key => 
      filters[key as keyof CoinQueryParams] !== undefined
    ).length;
  };

  const renderActiveFilters = () => {
    const activeFilters = [];

    if (filters.search) {
      activeFilters.push(
        <FilterChip
          key="search"
          label="Hledání"
          value={filters.search}
          onDelete={() => clearFilter('search')}
        />
      );
    }

    if (filters.country) {
      activeFilters.push(
        <FilterChip
          key="country"
          label="Země"
          value={filters.country}
          onDelete={() => clearFilter('country')}
        />
      );
    }

    if (filters.coin_type) {
      activeFilters.push(
        <FilterChip
          key="coin_type"
          label="Typ"
          value={filters.coin_type}
          onDelete={() => clearFilter('coin_type')}
        />
      );
    }

    if (filters.currency) {
      activeFilters.push(
        <FilterChip
          key="currency"
          label="Měna"
          value={filters.currency}
          onDelete={() => clearFilter('currency')}
        />
      );
    }

    if (filters.material) {
      activeFilters.push(
        <FilterChip
          key="material"
          label="Materiál"
          value={filters.material}
          onDelete={() => clearFilter('material')}
        />
      );
    }

    if (filters.year_from || filters.year_to) {
      const yearRange = `${filters.year_from || '?'} - ${filters.year_to || '?'}`;
      activeFilters.push(
        <FilterChip
          key="year_range"
          label="Rok"
          value={yearRange}
          onDelete={() => {
            clearFilter('year_from');
            clearFilter('year_to');
          }}
        />
      );
    }

    if (filters.value_from || filters.value_to) {
      const valueRange = `${filters.value_from || '0'} - ${filters.value_to || '∞'} CZK`;
      activeFilters.push(
        <FilterChip
          key="value_range"
          label="Hodnota"
          value={valueRange}
          onDelete={() => {
            clearFilter('value_from');
            clearFilter('value_to');
          }}
        />
      );
    }

    return activeFilters;
  };

  if (compact) {
    return (
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="Hledat mince..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ flex: 1 }}
            size="small"
          />
          
          <Badge badgeContent={getActiveFiltersCount()} color="primary">
            <IconButton
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              color={isAdvancedOpen ? 'primary' : 'default'}
            >
              <TuneIcon />
            </IconButton>
          </Badge>
        </Box>

        <Collapse in={isAdvancedOpen}>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Země</InputLabel>
                  <Select
                    value={filters.country || ''}
                    label="Země"
                    onChange={(e) => updateFilter('country', e.target.value)}
                  >
                    <MenuItem value="">Všechny</MenuItem>
                    {(filterOptions?.countries || COUNTRIES).map((country) => (
                      <MenuItem key={country} value={country}>
                        {country}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Typ</InputLabel>
                  <Select
                    value={filters.coin_type || ''}
                    label="Typ"
                    onChange={(e) => updateFilter('coin_type', e.target.value)}
                  >
                    <MenuItem value="">Všechny</MenuItem>
                    {(filterOptions?.coin_types || COIN_TYPES).map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Rok od"
                  type="number"
                  value={filters.year_from || ''}
                  onChange={(e) => updateFilter('year_from', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </Grid>

              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Rok do"
                  type="number"
                  value={filters.year_to || ''}
                  onChange={(e) => updateFilter('year_to', e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </Grid>
            </Grid>

            {getActiveFiltersCount() > 0 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  {renderActiveFilters()}
                </Box>
                <Button size="small" onClick={clearAllFilters}>
                  Vymazat vše
                </Button>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      {/* Search Bar */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Hledat podle názvu, země, materiálu..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            endAdornment: searchTerm && (
              <IconButton size="small" onClick={() => setSearchTerm('')}>
                <ClearIcon />
              </IconButton>
            ),
          }}
        />
      </Box>

      {/* Basic Filters */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            options={filterOptions?.countries || COUNTRIES}
            value={filters.country || null}
            onChange={(_, value) => updateFilter('country', value)}
            renderInput={(params) => (
              <TextField {...params} label="Země" fullWidth />
            )}
            size="small"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Typ mince</InputLabel>
            <Select
              value={filters.coin_type || ''}
              label="Typ mince"
              onChange={(e) => updateFilter('coin_type', e.target.value)}
            >
              <MenuItem value="">Všechny typy</MenuItem>
              {(filterOptions?.coin_types || COIN_TYPES).map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Měna</InputLabel>
            <Select
              value={filters.currency || ''}
              label="Měna"
              onChange={(e) => updateFilter('currency', e.target.value)}
            >
              <MenuItem value="">Všechny měny</MenuItem>
              {(filterOptions?.currencies || CURRENCIES).map((currency) => (
                <MenuItem key={currency} value={currency}>
                  {currency}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Materiál</InputLabel>
            <Select
              value={filters.material || ''}
              label="Materiál"
              onChange={(e) => updateFilter('material', e.target.value)}
            >
              <MenuItem value="">Všechny materiály</MenuItem>
              {(filterOptions?.materials || MATERIALS).map((material) => (
                <MenuItem key={material} value={material}>
                  {material}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Advanced Filters Toggle */}
      {showAdvanced && (
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<FilterListIcon />}
            endIcon={isAdvancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            variant="outlined"
            size="small"
          >
            Pokročilé filtry
            {getActiveFiltersCount() > 0 && (
              <Badge badgeContent={getActiveFiltersCount()} color="primary" sx={{ ml: 1 }} />
            )}
          </Button>
        </Box>
      )}

      {/* Advanced Filters */}
      <Collapse in={isAdvancedOpen}>
        <Box sx={{ pt: 2 }}>
          <Divider sx={{ mb: 3 }} />
          
          <Grid container spacing={3}>
            {/* Year Range */}
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Rok vydání</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Od roku"
                    type="number"
                    value={filters.year_from || ''}
                    onChange={(e) => updateFilter('year_from', e.target.value ? parseInt(e.target.value) : undefined)}
                    inputProps={{ min: -3000, max: new Date().getFullYear() + 10 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Do roku"
                    type="number"
                    value={filters.year_to || ''}
                    onChange={(e) => updateFilter('year_to', e.target.value ? parseInt(e.target.value) : undefined)}
                    inputProps={{ min: -3000, max: new Date().getFullYear() + 10 }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Value Range */}
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Hodnota (CZK)</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Od hodnoty"
                    type="number"
                    value={filters.value_from || ''}
                    onChange={(e) => updateFilter('value_from', e.target.value ? parseFloat(e.target.value) : undefined)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Do hodnoty"
                    type="number"
                    value={filters.value_to || ''}
                    onChange={(e) => updateFilter('value_to', e.target.value ? parseFloat(e.target.value) : undefined)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Diameter Range */}
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Průměr (mm)</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Od průměru"
                    type="number"
                    value={filters.diameter_from || ''}
                    onChange={(e) => updateFilter('diameter_from', e.target.value ? parseFloat(e.target.value) : undefined)}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Do průměru"
                    type="number"
                    value={filters.diameter_to || ''}
                    onChange={(e) => updateFilter('diameter_to', e.target.value ? parseFloat(e.target.value) : undefined)}
                    inputProps={{ min: 0, step: 0.1 }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Weight Range */}
            <Grid item xs={12} md={6}>
              <Typography gutterBottom>Hmotnost (g)</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Od hmotnosti"
                    type="number"
                    value={filters.weight_from || ''}
                    onChange={(e) => updateFilter('weight_from', e.target.value ? parseFloat(e.target.value) : undefined)}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Do hmotnosti"
                    type="number"
                    value={filters.weight_to || ''}
                    onChange={(e) => updateFilter('weight_to', e.target.value ? parseFloat(e.target.value) : undefined)}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Condition */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Stav</InputLabel>
                <Select
                  value={filters.condition || ''}
                  label="Stav"
                  onChange={(e) => updateFilter('condition', e.target.value)}
                >
                  <MenuItem value="">Všechny stavy</MenuItem>
                  {CONDITION_GRADES.map((grade) => (
                    <MenuItem key={grade.value} value={grade.value}>
                      {grade.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Has Images */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Obrázky</InputLabel>
                <Select
                  value={filters.has_images || ''}
                  label="Obrázky"
                  onChange={(e) => updateFilter('has_images', e.target.value)}
                >
                  <MenuItem value="">Všechny</MenuItem>
                  <MenuItem value="true">S obrázky</MenuItem>
                  <MenuItem value="false">Bez obrázků</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      </Collapse>

      {/* Active Filters */}
      {getActiveFiltersCount() > 0 && (
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">
              Aktivní filtry ({getActiveFiltersCount()})
            </Typography>
            <Button size="small" onClick={clearAllFilters} startIcon={<ClearIcon />}>
              Vymazat vše
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {renderActiveFilters()}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default SearchFilters;