import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Divider,
  Chip,
  Autocomplete,
  InputAdornment,
  Switch,
  FormControlLabel,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  PhotoCamera as PhotoCameraIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { cs } from 'date-fns/locale';
import { CoinFormData, Coin } from '../types/coin';
import { 
  COUNTRIES, 
  CURRENCIES, 
  COIN_TYPES, 
  MATERIALS, 
  CONDITION_GRADES 
} from '../utils/constants';
import { validateCoinForm } from '../utils/validators';
import { ImageUpload } from './ImageUpload';
import { useToast } from './ToastProvider';
import { LoadingOverlay } from './LoadingSpinner';

interface CoinFormProps {
  coin?: Coin;
  onSubmit: (data: CoinFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  showStepper?: boolean;
}

const steps = [
  'Základní informace',
  'Detaily a rozměry',
  'Hodnota a stav',
  'Obrázky',
];

export const CoinForm: React.FC<CoinFormProps> = ({
  coin,
  onSubmit,
  onCancel,
  isLoading = false,
  showStepper = false,
}) => {
  const toast = useToast();
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<CoinFormData>({
    name: coin?.name || '',
    country: coin?.country || '',
    year: coin?.year || undefined,
    currency: coin?.currency || '',
    denomination: coin?.denomination || undefined,
    coin_type: coin?.coin_type || '',
    material: coin?.material || '',
    diameter: coin?.diameter || undefined,
    thickness: coin?.thickness || undefined,
    weight: coin?.weight || undefined,
    edge_type: coin?.edge_type || '',
    mintage: coin?.mintage || undefined,
    mint_mark: coin?.mint_mark || '',
    designer: coin?.designer || '',
    current_value: coin?.current_value || undefined,
    condition: coin?.condition || '',
    rarity_score: coin?.rarity_score || undefined,
    historical_significance: coin?.historical_significance || '',
    description: coin?.description || '',
    acquisition_date: coin?.acquisition_date || '',
    acquisition_price: coin?.acquisition_price || undefined,
    acquisition_source: coin?.acquisition_source || '',
    storage_location: coin?.storage_location || '',
    insurance_value: coin?.insurance_value || undefined,
    is_for_sale: coin?.is_for_sale || false,
    asking_price: coin?.asking_price || undefined,
    notes: coin?.notes || '',
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [customTags, setCustomTags] = useState<string[]>([]);

  useEffect(() => {
    if (coin) {
      setFormData({
        name: coin.name || '',
        country: coin.country || '',
        year: coin.year || undefined,
        currency: coin.currency || '',
        denomination: coin.denomination || undefined,
        coin_type: coin.coin_type || '',
        material: coin.material || '',
        diameter: coin.diameter || undefined,
        thickness: coin.thickness || undefined,
        weight: coin.weight || undefined,
        edge_type: coin.edge_type || '',
        mintage: coin.mintage || undefined,
        mint_mark: coin.mint_mark || '',
        designer: coin.designer || '',
        current_value: coin.current_value || undefined,
        condition: coin.condition || '',
        rarity_score: coin.rarity_score || undefined,
        historical_significance: coin.historical_significance || '',
        description: coin.description || '',
        acquisition_date: coin.acquisition_date || '',
        acquisition_price: coin.acquisition_price || undefined,
        acquisition_source: coin.acquisition_source || '',
        storage_location: coin.storage_location || '',
        insurance_value: coin.insurance_value || undefined,
        is_for_sale: coin.is_for_sale || false,
        asking_price: coin.asking_price || undefined,
        notes: coin.notes || '',
      });
    }
  }, [coin]);

  const updateField = (field: keyof CoinFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSubmit = async () => {
    const validation = validateCoinForm(formData);
    
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.warning('Zkontrolujte vyplněné údaje');
      return;
    }

    try {
      await onSubmit(formData);
      toast.success(coin ? 'Mince byla aktualizována' : 'Mince byla vytvořena');
    } catch (error: any) {
      toast.error(error.message || 'Došlo k chybě při ukládání');
    }
  };

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const renderBasicInfo = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Název mince *"
          value={formData.name}
          onChange={(e) => updateField('name', e.target.value)}
          placeholder="např. 10 Kč 2023 - Česká republika"
          required
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <Autocomplete
          options={COUNTRIES}
          value={formData.country}
          onChange={(_, value) => updateField('country', value || '')}
          renderInput={(params) => (
            <TextField {...params} label="Země *" required />
          )}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Rok vydání"
          type="number"
          value={formData.year || ''}
          onChange={(e) => updateField('year', e.target.value ? parseInt(e.target.value) : undefined)}
          inputProps={{ min: -3000, max: new Date().getFullYear() + 10 }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth required>
          <InputLabel>Měna</InputLabel>
          <Select
            value={formData.currency}
            label="Měna"
            onChange={(e) => updateField('currency', e.target.value)}
          >
            {CURRENCIES.map((currency) => (
              <MenuItem key={currency} value={currency}>
                {currency}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Nominální hodnota"
          type="number"
          value={formData.denomination || ''}
          onChange={(e) => updateField('denomination', e.target.value ? parseFloat(e.target.value) : undefined)}
          InputProps={{
            endAdornment: <InputAdornment position="end">{formData.currency}</InputAdornment>,
          }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Typ mince</InputLabel>
          <Select
            value={formData.coin_type}
            label="Typ mince"
            onChange={(e) => updateField('coin_type', e.target.value)}
          >
            {COIN_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Materiál</InputLabel>
          <Select
            value={formData.material}
            label="Materiál"
            onChange={(e) => updateField('material', e.target.value)}
          >
            {MATERIALS.map((material) => (
              <MenuItem key={material} value={material}>
                {material}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );

  const renderDetails = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Rozměry a specifikace
        </Typography>
      </Grid>

      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Průměr"
          type="number"
          value={formData.diameter || ''}
          onChange={(e) => updateField('diameter', e.target.value ? parseFloat(e.target.value) : undefined)}
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.1 }}
        />
      </Grid>

      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Tloušťka"
          type="number"
          value={formData.thickness || ''}
          onChange={(e) => updateField('thickness', e.target.value ? parseFloat(e.target.value) : undefined)}
          InputProps={{
            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.1 }}
        />
      </Grid>

      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          label="Hmotnost"
          type="number"
          value={formData.weight || ''}
          onChange={(e) => updateField('weight', e.target.value ? parseFloat(e.target.value) : undefined)}
          InputProps={{
            endAdornment: <InputAdornment position="end">g</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.01 }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Typ hrany"
          value={formData.edge_type}
          onChange={(e) => updateField('edge_type', e.target.value)}
          placeholder="např. hladká, rýhovaná, nápis"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Náklad"
          type="number"
          value={formData.mintage || ''}
          onChange={(e) => updateField('mintage', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="Počet vyražených kusů"
          inputProps={{ min: 0 }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Mincovní značka"
          value={formData.mint_mark}
          onChange={(e) => updateField('mint_mark', e.target.value)}
          placeholder="např. KB, HM"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Návrhář"
          value={formData.designer}
          onChange={(e) => updateField('designer', e.target.value)}
          placeholder="Jméno návrháře"
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Historický význam"
          value={formData.historical_significance}
          onChange={(e) => updateField('historical_significance', e.target.value)}
          multiline
          rows={3}
          placeholder="Popis historického významu mince..."
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Popis"
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
          multiline
          rows={4}
          placeholder="Detailní popis mince, motivů, symbolů..."
        />
      </Grid>
    </Grid>
  );

  const renderValueAndCondition = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Hodnota a stav
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Současná hodnota"
          type="number"
          value={formData.current_value || ''}
          onChange={(e) => updateField('current_value', e.target.value ? parseFloat(e.target.value) : undefined)}
          InputProps={{
            endAdornment: <InputAdornment position="end">{formData.currency}</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.01 }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Stav</InputLabel>
          <Select
            value={formData.condition}
            label="Stav"
            onChange={(e) => updateField('condition', e.target.value)}
          >
            {CONDITION_GRADES.map((grade) => (
              <MenuItem key={grade.value} value={grade.value}>
                {grade.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Skóre vzácnosti"
          type="number"
          value={formData.rarity_score || ''}
          onChange={(e) => updateField('rarity_score', e.target.value ? parseInt(e.target.value) : undefined)}
          inputProps={{ min: 1, max: 10 }}
          helperText="1 = běžná, 10 = extrémně vzácná"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Pojistná hodnota"
          type="number"
          value={formData.insurance_value || ''}
          onChange={(e) => updateField('insurance_value', e.target.value ? parseFloat(e.target.value) : undefined)}
          InputProps={{
            endAdornment: <InputAdornment position="end">{formData.currency}</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.01 }}
        />
      </Grid>

      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>
          Akvizice
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={cs}>
          <DatePicker
            label="Datum akvizice"
            value={formData.acquisition_date ? new Date(formData.acquisition_date) : null}
            onChange={(date) => updateField('acquisition_date', date?.toISOString().split('T')[0] || '')}
            renderInput={(params) => <TextField {...params} fullWidth />}
          />
        </LocalizationProvider>
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Nákupní cena"
          type="number"
          value={formData.acquisition_price || ''}
          onChange={(e) => updateField('acquisition_price', e.target.value ? parseFloat(e.target.value) : undefined)}
          InputProps={{
            endAdornment: <InputAdornment position="end">{formData.currency}</InputAdornment>,
          }}
          inputProps={{ min: 0, step: 0.01 }}
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Zdroj akvizice"
          value={formData.acquisition_source}
          onChange={(e) => updateField('acquisition_source', e.target.value)}
          placeholder="např. aukce, obchod, dědictví"
        />
      </Grid>

      <Grid item xs={12} sm={6}>
        <TextField
          fullWidth
          label="Místo uložení"
          value={formData.storage_location}
          onChange={(e) => updateField('storage_location', e.target.value)}
          placeholder="např. trezor, album, box"
        />
      </Grid>

      <Grid item xs={12}>
        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" gutterBottom>
          Prodej
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={formData.is_for_sale}
              onChange={(e) => updateField('is_for_sale', e.target.checked)}
            />
          }
          label="Mince je na prodej"
        />
      </Grid>

      {formData.is_for_sale && (
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label="Požadovaná cena"
            type="number"
            value={formData.asking_price || ''}
            onChange={(e) => updateField('asking_price', e.target.value ? parseFloat(e.target.value) : undefined)}
            InputProps={{
              endAdornment: <InputAdornment position="end">{formData.currency}</InputAdornment>,
            }}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
      )}

      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Poznámky"
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          multiline
          rows={4}
          placeholder="Další poznámky, zajímavosti..."
        />
      </Grid>
    </Grid>
  );

  const renderImages = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Obrázky mince
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Nahrajte obrázky líce, rubu a dalších detailů mince.
      </Typography>
      
      <ImageUpload
        coinId={coin?.id}
        existingImages={coin?.images || []}
        onSuccess={(images) => {
          toast.success(`Nahráno ${images.length} obrázků`);
        }}
        onError={(error) => {
          toast.error(error);
        }}
      />
    </Box>
  );

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderBasicInfo();
      case 1:
        return renderDetails();
      case 2:
        return renderValueAndCondition();
      case 3:
        return renderImages();
      default:
        return null;
    }
  };

  if (showStepper) {
    return (
      <LoadingOverlay loading={isLoading}>
        <Card>
          <CardHeader
            title={coin ? 'Upravit minci' : 'Nová mince'}
            subheader="Vyplňte informace o minci"
          />
          
          <CardContent>
            {errors.length > 0 && (
              <Alert severity="error" sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Opravte následující chyby:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((label, index) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                  <StepContent>
                    <Box sx={{ mb: 2 }}>
                      {renderStepContent(index)}
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {index === steps.length - 1 ? (
                        <Button
                          variant="contained"
                          onClick={handleSubmit}
                          startIcon={<SaveIcon />}
                          disabled={isLoading}
                        >
                          {coin ? 'Uložit změny' : 'Vytvořit minci'}
                        </Button>
                      ) : (
                        <Button variant="contained" onClick={handleNext}>
                          Pokračovat
                        </Button>
                      )}
                      
                      {index > 0 && (
                        <Button onClick={handleBack}>
                          Zpět
                        </Button>
                      )}
                      
                      <Button onClick={onCancel} startIcon={<CancelIcon />}>
                        Zrušit
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      </LoadingOverlay>
    );
  }

  return (
    <LoadingOverlay loading={isLoading}>
      <Card>
        <CardHeader
          title={coin ? 'Upravit minci' : 'Nová mince'}
          subheader="Vyplňte informace o minci"
        />
        
        <CardContent>
          {errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Opravte následující chyby:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Základní informace
            </Typography>
            {renderBasicInfo()}
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mb: 4 }}>
            {renderDetails()}
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mb: 4 }}>
            {renderValueAndCondition()}
          </Box>

          <Divider sx={{ my: 4 }} />

          <Box sx={{ mb: 4 }}>
            {renderImages()}
          </Box>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', pt: 3 }}>
            <Button
              onClick={onCancel}
              startIcon={<CancelIcon />}
              disabled={isLoading}
            >
              Zrušit
            </Button>
            
            <Button
              onClick={handleSubmit}
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={isLoading}
            >
              {coin ? 'Uložit změny' : 'Vytvořit minci'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </LoadingOverlay>
  );
};

export default CoinForm;