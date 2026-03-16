import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  Paper,
  Stack,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Home as HomeIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails,
    }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            p: 3,
          }}
        >
          <Card sx={{ maxWidth: 600, width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ErrorIcon color="error" sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h5" component="h1" gutterBottom>
                    Něco se pokazilo
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Aplikace narazila na neočekávanou chybu. Omlouváme se za nepříjemnosti.
                  </Typography>
                </Box>
              </Box>

              <Alert severity="error" sx={{ mb: 2 }}>
                <AlertTitle>Chyba aplikace</AlertTitle>
                {this.state.error?.message || 'Neznámá chyba'}
              </Alert>

              <Box sx={{ mb: 2 }}>
                <Button
                  onClick={this.toggleDetails}
                  startIcon={this.state.showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  size="small"
                >
                  {this.state.showDetails ? 'Skrýt' : 'Zobrazit'} technické detaily
                </Button>
              </Box>

              <Collapse in={this.state.showDetails}>
                <Paper sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Chybová zpráva:
                  </Typography>
                  <Typography variant="body2" component="pre" sx={{ 
                    fontFamily: 'monospace', 
                    fontSize: '0.8rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    mb: 2,
                  }}>
                    {this.state.error?.stack}
                  </Typography>

                  {this.state.errorInfo && (
                    <>
                      <Typography variant="subtitle2" gutterBottom>
                        Component Stack:
                      </Typography>
                      <Typography variant="body2" component="pre" sx={{ 
                        fontFamily: 'monospace', 
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        {this.state.errorInfo.componentStack}
                      </Typography>
                    </>
                  )}
                </Paper>
              </Collapse>
            </CardContent>

            <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
              <Stack direction="row" spacing={1}>
                <Button
                  onClick={this.handleRetry}
                  startIcon={<RefreshIcon />}
                  variant="contained"
                >
                  Zkusit znovu
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  startIcon={<HomeIcon />}
                  variant="outlined"
                >
                  Domů
                </Button>
              </Stack>

              <Button
                onClick={() => {
                  // In a real app, this would open a bug report form or email
                  const subject = encodeURIComponent('Chyba v aplikaci Coin Collection');
                  const body = encodeURIComponent(
                    `Popis chyby:\n${this.state.error?.message}\n\n` +
                    `Stack trace:\n${this.state.error?.stack}\n\n` +
                    `URL: ${window.location.href}\n` +
                    `User Agent: ${navigator.userAgent}\n` +
                    `Timestamp: ${new Date().toISOString()}`
                  );
                  window.open(`mailto:support@coinapp.com?subject=${subject}&body=${body}`);
                }}
                startIcon={<BugReportIcon />}
                size="small"
                color="inherit"
              >
                Nahlásit chybu
              </Button>
            </CardActions>
          </Card>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to handle errors
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    
    // In a real app, you might want to:
    // 1. Send error to logging service
    // 2. Show user-friendly error message
    // 3. Trigger error boundary
    
    throw error; // Re-throw to trigger error boundary
  };
};

// Simple error display component
interface ErrorDisplayProps {
  error: string | Error;
  onRetry?: () => void;
  onDismiss?: () => void;
  severity?: 'error' | 'warning' | 'info';
  title?: string;
  showStack?: boolean;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  severity = 'error',
  title,
  showStack = false,
}) => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorStack = typeof error === 'object' ? error.stack : undefined;

  return (
    <Alert 
      severity={severity}
      action={
        <Stack direction="row" spacing={1}>
          {onRetry && (
            <Button color="inherit" size="small" onClick={onRetry}>
              Zkusit znovu
            </Button>
          )}
          {onDismiss && (
            <IconButton color="inherit" size="small" onClick={onDismiss}>
              <CloseIcon />
            </IconButton>
          )}
        </Stack>
      }
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {errorMessage}
      
      {showStack && errorStack && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" component="pre" sx={{ 
            fontFamily: 'monospace', 
            fontSize: '0.75rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            opacity: 0.8,
          }}>
            {errorStack}
          </Typography>
        </Box>
      )}
    </Alert>
  );
};

// Network error component
interface NetworkErrorProps {
  onRetry?: () => void;
  message?: string;
}

export const NetworkError: React.FC<NetworkErrorProps> = ({
  onRetry,
  message = 'Nepodařilo se připojit k serveru. Zkontrolujte připojení k internetu.',
}) => {
  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Problém s připojením
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {message}
      </Typography>
      {onRetry && (
        <Button
          onClick={onRetry}
          startIcon={<RefreshIcon />}
          variant="contained"
          sx={{ mt: 2 }}
        >
          Zkusit znovu
        </Button>
      )}
    </Box>
  );
};

// 404 Not Found component
export const NotFound: React.FC<{
  title?: string;
  message?: string;
  onGoHome?: () => void;
}> = ({
  title = 'Stránka nenalezena',
  message = 'Požadovaná stránka neexistuje nebo byla přesunuta.',
  onGoHome,
}) => {
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography variant="h1" component="h1" sx={{ fontSize: '6rem', fontWeight: 'bold', color: 'text.secondary' }}>
        404
      </Typography>
      <Typography variant="h4" component="h2" gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        {message}
      </Typography>
      <Button
        onClick={onGoHome || (() => window.location.href = '/')}
        startIcon={<HomeIcon />}
        variant="contained"
        sx={{ mt: 3 }}
      >
        Zpět na hlavní stránku
      </Button>
    </Box>
  );
};

// Unauthorized access component
export const Unauthorized: React.FC<{
  message?: string;
  onLogin?: () => void;
}> = ({
  message = 'Pro přístup k této stránce se musíte přihlásit.',
  onLogin,
}) => {
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Typography variant="h1" component="h1" sx={{ fontSize: '6rem', fontWeight: 'bold', color: 'text.secondary' }}>
        401
      </Typography>
      <Typography variant="h4" component="h2" gutterBottom>
        Neautorizovaný přístup
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        {message}
      </Typography>
      <Button
        onClick={onLogin || (() => window.location.href = '/login')}
        variant="contained"
        sx={{ mt: 3 }}
      >
        Přihlásit se
      </Button>
    </Box>
  );
};

export default ErrorBoundary;