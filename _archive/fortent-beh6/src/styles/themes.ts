import { Theme } from '../hooks/useTheme';

// Rozšířené téma s více variantami
export const createTheme = (isDark: boolean): Theme => {
  const baseTheme = {
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      xxl: 48,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
    },
    typography: {
      h1: { fontSize: 32, fontWeight: 'bold' as const, lineHeight: 40 },
      h2: { fontSize: 28, fontWeight: 'bold' as const, lineHeight: 36 },
      h3: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
      h4: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
      body1: { fontSize: 16, fontWeight: 'normal' as const, lineHeight: 24 },
      body2: { fontSize: 14, fontWeight: 'normal' as const, lineHeight: 20 },
      caption: { fontSize: 12, fontWeight: 'normal' as const, lineHeight: 16 },
      button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
    },
    shadows: {
      small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 2,
        elevation: 2,
      },
      medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.4 : 0.15,
        shadowRadius: 4,
        elevation: 4,
      },
      large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.5 : 0.2,
        shadowRadius: 8,
        elevation: 8,
      },
    },
  };

  if (isDark) {
    return {
      ...baseTheme,
      colors: {
        primary: '#0A84FF',
        primaryDark: '#0056CC',
        secondary: '#5E5CE6',
        background: '#000000',
        surface: '#1C1C1E',
        card: '#2C2C2E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
        notification: '#FF453A',
        error: '#FF453A',
        warning: '#FF9F0A',
        success: '#30D158',
        info: '#64D2FF',
        disabled: '#48484A',
        placeholder: '#8E8E93',
        backdrop: 'rgba(0, 0, 0, 0.7)',
      },
    };
  }

  return {
    ...baseTheme,
    colors: {
      primary: '#007AFF',
      primaryDark: '#0056CC',
      secondary: '#5856D6',
      background: '#FFFFFF',
      surface: '#F8F9FA',
      card: '#FFFFFF',
      text: '#000000',
      textSecondary: '#6C757D',
      border: '#E9ECEF',
      notification: '#FF3B30',
      error: '#FF3B30',
      warning: '#FF9500',
      success: '#34C759',
      info: '#007AFF',
      disabled: '#ADB5BD',
      placeholder: '#6C757D',
      backdrop: 'rgba(0, 0, 0, 0.5)',
    },
  };
};

// Speciální témata pro různé účely
export const coinTheme = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  copper: '#B87333',
  bronze: '#CD7F32',
  platinum: '#E5E4E2',
  nickel: '#727472',
};

export const rarityColors = {
  common: '#6C757D',
  uncommon: '#28A745',
  rare: '#007BFF',
  very_rare: '#6F42C1',
  extremely_rare: '#FD7E14',
  unique: '#DC3545',
};

export const conditionColors = {
  'MS-70': '#28A745',
  'MS-69': '#20C997',
  'MS-65': '#17A2B8',
  'MS-60': '#007BFF',
  'AU-50': '#6610F2',
  'VF-20': '#6F42C1',
  'F-12': '#E83E8C',
  'G-4': '#FD7E14',
  'damaged': '#DC3545',
};

// Gradient definice
export const gradients = {
  primary: ['#007AFF', '#0056CC'],
  secondary: ['#5856D6', '#4A4AE8'],
  success: ['#34C759', '#28A745'],
  warning: ['#FF9500', '#FD7E14'],
  error: ['#FF3B30', '#DC3545'],
  gold: ['#FFD700', '#FFA500'],
  silver: ['#C0C0C0', '#A8A8A8'],
  copper: ['#B87333', '#8B4513'],
};

// Animační konstanty
export const animations = {
  timing: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
};

// Responzivní breakpointy
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1440,
};

// Utility funkce pro témata
export const getColorWithOpacity = (color: string, opacity: number): string => {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

export const getMaterialColor = (material: string): string => {
  switch (material.toLowerCase()) {
    case 'gold':
      return coinTheme.gold;
    case 'silver':
      return coinTheme.silver;
    case 'copper':
      return coinTheme.copper;
    case 'bronze':
      return coinTheme.bronze;
    case 'platinum':
      return coinTheme.platinum;
    case 'nickel':
      return coinTheme.nickel;
    default:
      return '#6C757D';
  }
};

export const getRarityColor = (rarity: string): string => {
  return rarityColors[rarity as keyof typeof rarityColors] || rarityColors.common;
};

export const getConditionColor = (condition: string): string => {
  return conditionColors[condition as keyof typeof conditionColors] || conditionColors['G-4'];
};

// Předdefinované styly komponent
export const componentStyles = {
  button: {
    primary: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    secondary: {
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 6,
      borderWidth: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    small: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
  },
  card: {
    default: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    elevated: {
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  },
  input: {
    default: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
    },
    large: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 18,
    },
  },
};

export default createTheme;