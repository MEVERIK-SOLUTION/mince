import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Divider,
  Tooltip,
  Badge,
  useTheme,
  useMediaQuery,
  Skeleton,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  GetApp as DownloadIcon,
  Preview as PreviewIcon,
  Schedule as ScheduleIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  PictureAsPdf as PdfIcon,
  TableChart as ExcelIcon,
  Code as JsonIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  Inventory as InventoryIcon,
  Analytics as AnalyticsIcon,
  Compare as CompareIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { cs } from 'date-fns/locale';

interface Collection {
  id: number;
  name: string;
  description: string;
  coin_count: number;
  total_value: number;
}

interface ReportTemplate {
  name: string;
  description: string;
  sections: string[];
  formats: string[];
  estimated_time: string;
}

interface ReportStatistics {
  collection_info: {
    name: string;
    description: string;
    created_at: string;
  };
  basic_stats: {
    total_coins: number;
    coins_with_values: number;
    total_value: number;
    total_investment: number;
    profit_loss: number;
    data_completeness_percent: number;
  };
  diversity_stats: {
    unique_countries: number;
    unique_materials: number;
    unique_conditions: number;
    unique_rarities: number;
    year_range: [number, number] | [null, null];
  };
  report_recommendations: Array<{
    type: string;
    reason: string;
    priority: string;
  }>;
}

interface ReportHistory {
  id: number;
  collection_id: number;
  collection_name: string;
  report_type: string;
  format: string;
  generated_at: string;
  file_size_mb: number;
  status: string;
}

interface ScheduledReport {
  schedule_id: number;
  collection_id: number;
  collection_name: string;
  report_type: string;
  schedule_type: string;
  format_type: string;
  email_recipients: string[];
  next_execution: string;
  last_execution?: string;
  status: string;
  created_at: string;
}

interface ReportGeneratorProps {
  collections: Collection[];
  selectedCollectionId?: number;
  onCollectionChange?: (collectionId: number) => void;
}

const REPORT_TYPE_ICONS = {
  comprehensive: AnalyticsIcon,
  financial: MoneyIcon,
  inventory: InventoryIcon,
  market_analysis: TrendingUpIcon,
};

const FORMAT_ICONS = {
  pdf: PdfIcon,
  excel: ExcelIcon,
  json: JsonIcon,
};

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({
  collections,
  selectedCollectionId,
  onCollectionChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [selectedCollection, setSelectedCollection] = useState<number>(selectedCollectionId || 0);
  const [reportType, setReportType] = useState('comprehensive');
  const [formatType, setFormatType] = useState('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeImages, setIncludeImages] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Dialog states
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  // Data states
  const [templates, setTemplates] = useState<Record<string, ReportTemplate>>({});
  const [statistics, setStatistics] = useState<ReportStatistics | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [statisticsLoading, setStatisticsLoading] = useState(false);

  // Schedule form state
  const [scheduleType, setScheduleType] = useState('weekly');
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');

  // Comparison state
  const [selectedCollections, setSelectedCollections] = useState<number[]>([]);

  useEffect(() => {
    loadTemplates();
    loadReportHistory();
    loadScheduledReports();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadStatistics();
    }
  }, [selectedCollection]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/reports/templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadStatistics = async () => {
    if (!selectedCollection) return;

    try {
      setStatisticsLoading(true);
      const response = await fetch(`/api/collections/${selectedCollection}/reports/statistics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setStatisticsLoading(false);
    }
  };

  const loadReportHistory = async () => {
    try {
      const response = await fetch('/api/reports/history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setReportHistory(data.history);
      }
    } catch (error) {
      console.error('Error loading report history:', error);
    }
  };

  const loadScheduledReports = async () => {
    try {
      const response = await fetch('/api/reports/schedules', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setScheduledReports(data.schedules);
      }
    } catch (error) {
      console.error('Error loading scheduled reports:', error);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedCollection) return;

    try {
      setLoading(true);

      const params = new URLSearchParams({
        report_type: reportType,
        format_type: formatType,
        include_charts: includeCharts.toString(),
        include_images: includeImages.toString(),
      });

      if (dateFrom) {
        params.append('date_from', format(dateFrom, 'yyyy-MM-dd'));
      }
      if (dateTo) {
        params.append('date_to', format(dateTo, 'yyyy-MM-dd'));
      }

      const response = await fetch(`/api/collections/${selectedCollection}/reports/generate?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        if (formatType === 'json') {
          const data = await response.json();
          console.log('Report data:', data);
          // Zobrazit JSON data v dialogu nebo stáhnout jako soubor
        } else {
          // Stáhnout binární soubor
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          const contentDisposition = response.headers.get('Content-Disposition');
          const filename = contentDisposition
            ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
            : `report.${formatType}`;
          
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }

        // Obnovit historii
        loadReportHistory();
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewReport = async () => {
    if (!selectedCollection) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/collections/${selectedCollection}/reports/preview?report_type=${reportType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
        setPreviewOpen(true);
      }
    } catch (error) {
      console.error('Error previewing report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleReport = async () => {
    if (!selectedCollection) return;

    try {
      const params = new URLSearchParams({
        schedule_type: scheduleType,
        format_type: formatType,
      });

      emailRecipients.forEach(email => {
        params.append('email_recipients', email);
      });

      const response = await fetch(`/api/reports/schedule?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          collection_id: selectedCollection,
          report_type: reportType,
        }),
      });

      if (response.ok) {
        setScheduleOpen(false);
        loadScheduledReports();
        // Zobrazit úspěšnou zprávu
      }
    } catch (error) {
      console.error('Error scheduling report:', error);
    }
  };

  const handleGenerateComparison = async () => {
    if (selectedCollections.length < 2) return;

    try {
      setLoading(true);
      const response = await fetch('/api/reports/comparison', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          collection_ids: selectedCollections,
          comparison_type: 'basic',
          format_type: formatType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Comparison data:', data);
        // Zobrazit nebo stáhnout srovnávací report
      }
    } catch (error) {
      console.error('Error generating comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEmailRecipient = () => {
    if (newEmail && !emailRecipients.includes(newEmail)) {
      setEmailRecipients([...emailRecipients, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmailRecipient = (email: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email));
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
    }).format(value);
  };

  const selectedTemplate = templates[reportType];
  const selectedCollectionData = collections.find(c => c.id === selectedCollection);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Generátor reportů
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<HistoryIcon />}
            variant="outlined"
            onClick={() => setHistoryOpen(true)}
          >
            Historie
          </Button>
          <Button
            startIcon={<CompareIcon />}
            variant="outlined"
            onClick={() => setComparisonOpen(true)}
          >
            Srovnání
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Konfigurace reportu */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Konfigurace reportu" />
            <CardContent>
              <Grid container spacing={3}>
                {/* Výběr kolekce */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Kolekce</InputLabel>
                    <Select
                      value={selectedCollection}
                      onChange={(e) => {
                        setSelectedCollection(Number(e.target.value));
                        onCollectionChange?.(Number(e.target.value));
                      }}
                      label="Kolekce"
                    >
                      {collections.map((collection) => (
                        <MenuItem key={collection.id} value={collection.id}>
                          <Box>
                            <Typography variant="body1">{collection.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {collection.coin_count} mincí • {formatPrice(collection.total_value)}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Typ reportu */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Typ reportu</InputLabel>
                    <Select
                      value={reportType}
                      onChange={(e) => setReportType(e.target.value)}
                      label="Typ reportu"
                    >
                      {Object.entries(templates).map(([key, template]) => {
                        const IconComponent = REPORT_TYPE_ICONS[key as keyof typeof REPORT_TYPE_ICONS] || ReportIcon;
                        return (
                          <MenuItem key={key} value={key}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <IconComponent fontSize="small" />
                              <Box>
                                <Typography variant="body1">{template.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {template.description}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Formát */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Formát</InputLabel>
                    <Select
                      value={formatType}
                      onChange={(e) => setFormatType(e.target.value)}
                      label="Formát"
                    >
                      {selectedTemplate?.formats.map((format) => {
                        const IconComponent = FORMAT_ICONS[format as keyof typeof FORMAT_ICONS];
                        return (
                          <MenuItem key={format} value={format}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <IconComponent fontSize="small" />
                              {format.toUpperCase()}
                            </Box>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Datumový rozsah */}
                <Grid item xs={12} sm={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={cs}>
                    <DatePicker
                      label="Datum od"
                      value={dateFrom}
                      onChange={setDateFrom}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={cs}>
                    <DatePicker
                      label="Datum do"
                      value={dateTo}
                      onChange={setDateTo}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>

                {/* Možnosti */}
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    Možnosti
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeCharts}
                        onChange={(e) => setIncludeCharts(e.target.checked)}
                      />
                    }
                    label="Zahrnout grafy a vizualizace"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeImages}
                        onChange={(e) => setIncludeImages(e.target.checked)}
                      />
                    }
                    label="Zahrnout obrázky mincí"
                  />
                </Grid>

                {/* Akce */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={handleGenerateReport}
                      disabled={!selectedCollection || loading}
                    >
                      Generovat report
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PreviewIcon />}
                      onClick={handlePreviewReport}
                      disabled={!selectedCollection || loading}
                    >
                      Náhled
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<ScheduleIcon />}
                      onClick={() => setScheduleOpen(true)}
                      disabled={!selectedCollection}
                    >
                      Naplánovat
                    </Button>
                  </Box>
                </Grid>
              </Grid>

              {loading && <LinearProgress sx={{ mt: 2 }} />}
            </CardContent>
          </Card>
        </Grid>

        {/* Informace a statistiky */}
        <Grid item xs={12} md={4}>
          {/* Informace o šabloně */}
          {selectedTemplate && (
            <Card sx={{ mb: 2 }}>
              <CardHeader title={selectedTemplate.name} />
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {selectedTemplate.description}
                </Typography>
                
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Obsahuje:
                </Typography>
                <List dense>
                  {selectedTemplate.sections.map((section, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemText primary={section} />
                    </ListItem>
                  ))}
                </List>

                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="caption">
                    Odhadovaný čas generování: {selectedTemplate.estimated_time}
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* Statistiky kolekce */}
          {selectedCollection && (
            <Card>
              <CardHeader 
                title="Statistiky kolekce"
                action={
                  <IconButton onClick={loadStatistics}>
                    <RefreshIcon />
                  </IconButton>
                }
              />
              <CardContent>
                {statisticsLoading ? (
                  <Box>
                    <Skeleton height={60} />
                    <Skeleton height={60} />
                    <Skeleton height={60} />
                  </Box>
                ) : statistics ? (
                  <Box>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="h6" color="primary">
                          {statistics.basic_stats.total_coins}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Celkem mincí
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="h6" color="success.main">
                          {formatPrice(statistics.basic_stats.total_value)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Celková hodnota
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="h6" color="info.main">
                          {statistics.diversity_stats.unique_countries}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Zemí
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="h6" color="warning.main">
                          {statistics.basic_stats.data_completeness_percent.toFixed(0)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Kompletnost dat
                        </Typography>
                      </Grid>
                    </Grid>

                    {statistics.report_recommendations.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Doporučené reporty:
                        </Typography>
                        {statistics.report_recommendations.map((rec, index) => (
                          <Chip
                            key={index}
                            label={rec.type}
                            size="small"
                            color={rec.priority === 'high' ? 'primary' : 'default'}
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Vyberte kolekci pro zobrazení statistik
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Náhled reportu</Typography>
            <IconButton onClick={() => setPreviewOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {previewData && (
            <Box>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                {JSON.stringify(previewData, null, 2)}
              </pre>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Naplánovat automatický report</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Frekvence</InputLabel>
                <Select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                  label="Frekvence"
                >
                  <MenuItem value="daily">Denně</MenuItem>
                  <MenuItem value="weekly">Týdně</MenuItem>
                  <MenuItem value="monthly">Měsíčně</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Email příjemci
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Email adresa"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addEmailRecipient()}
                />
                <Button onClick={addEmailRecipient} variant="outlined">
                  Přidat
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {emailRecipients.map((email) => (
                  <Chip
                    key={email}
                    label={email}
                    onDelete={() => removeEmailRecipient(email)}
                    size="small"
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleOpen(false)}>Zrušit</Button>
          <Button onClick={handleScheduleReport} variant="contained">
            Naplánovat
          </Button>
        </DialogActions>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Historie reportů</DialogTitle>
        <DialogContent>
          <List>
            {reportHistory.map((report) => (
              <ListItem key={report.id} divider>
                <ListItemText
                  primary={`${report.collection_name} - ${report.report_type}`}
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        {format(parseISO(report.generated_at), 'dd.MM.yyyy HH:mm', { locale: cs })}
                      </Typography>
                      <Typography variant="caption">
                        {report.format.toUpperCase()} • {report.file_size_mb} MB
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end">
                    <DownloadIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Zavřít</Button>
        </DialogActions>
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog open={comparisonOpen} onClose={() => setComparisonOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Srovnání kolekcí</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Vyberte 2-10 kolekcí pro srovnání
          </Typography>
          
          <List>
            {collections.map((collection) => (
              <ListItem key={collection.id}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedCollections.includes(collection.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCollections([...selectedCollections, collection.id]);
                        } else {
                          setSelectedCollections(selectedCollections.filter(id => id !== collection.id));
                        }
                      }}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body1">{collection.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {collection.coin_count} mincí
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComparisonOpen(false)}>Zrušit</Button>
          <Button
            onClick={handleGenerateComparison}
            variant="contained"
            disabled={selectedCollections.length < 2}
          >
            Srovnat ({selectedCollections.length})
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReportGenerator;