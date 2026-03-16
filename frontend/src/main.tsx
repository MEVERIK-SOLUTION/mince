import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

// Dark glassmorphism theme — Meverik Studio®
const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#070b12',
      paper: '#0d1421',
    },
    primary: {
      main: '#d4a847',
      light: '#e8c06a',
      dark: '#a07c2e',
      contrastText: '#070b12',
    },
    secondary: {
      main: '#7c4dff',
      light: '#a47dff',
      dark: '#5227cc',
      contrastText: '#ffffff',
    },
    success: {
      main: '#00c896',
      light: '#33d4ab',
      dark: '#009971',
    },
    error: {
      main: '#ff5370',
      light: '#ff7a90',
      dark: '#cc2f4f',
    },
    warning: {
      main: '#ffaa2c',
      light: '#ffbb55',
      dark: '#cc8200',
    },
    info: {
      main: '#29b6f6',
      light: '#4fc3f7',
      dark: '#0288d1',
    },
    text: {
      primary: '#e8eaf6',
      secondary: 'rgba(232,234,246,0.6)',
      disabled: 'rgba(232,234,246,0.3)',
    },
    divider: 'rgba(255,255,255,0.08)',
  },
  typography: {
    fontFamily: '"Inter", "system-ui", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, letterSpacing: '-0.015em' },
    h3: { fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, letterSpacing: '0.02em' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: 'linear-gradient(135deg, #070b12 0%, #0a0f1e 50%, #070b12 100%)',
          minHeight: '100vh',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(212,168,71,0.3) transparent',
        },
        '::-webkit-scrollbar': { width: '6px' },
        '::-webkit-scrollbar-track': { background: 'transparent' },
        '::-webkit-scrollbar-thumb': {
          background: 'rgba(212,168,71,0.3)',
          borderRadius: '3px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          '&:hover': {
            borderColor: 'rgba(212,168,71,0.25)',
            boxShadow: '0 4px 32px rgba(212,168,71,0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(13,20,33,0.9)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #d4a847 0%, #e8c06a 100%)',
          color: '#070b12',
          boxShadow: '0 4px 16px rgba(212,168,71,0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #e8c06a 0%, #d4a847 100%)',
            boxShadow: '0 6px 24px rgba(212,168,71,0.4)',
          },
        },
        outlinedPrimary: {
          borderColor: 'rgba(212,168,71,0.4)',
          '&:hover': {
            borderColor: '#d4a847',
            background: 'rgba(212,168,71,0.08)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
            '&:hover fieldset': { borderColor: 'rgba(212,168,71,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#d4a847' },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottomColor: 'rgba(255,255,255,0.06)',
        },
        head: {
          color: 'rgba(232,234,246,0.5)',
          fontWeight: 600,
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(13,20,33,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          fontSize: '0.75rem',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: alpha('#d4a847', 0.08),
          },
          '&.Mui-selected': {
            backgroundColor: alpha('#d4a847', 0.12),
            '&:hover': {
              backgroundColor: alpha('#d4a847', 0.18),
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0d1421',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a2236',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
