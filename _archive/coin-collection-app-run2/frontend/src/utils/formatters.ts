import { format, parseISO, isValid } from 'date-fns';
import { cs } from 'date-fns/locale';

/**
 * Formátování měny
 */
export const formatCurrency = (
  amount: number | null | undefined,
  currency: string = 'CZK',
  locale: string = 'cs-CZ'
): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback pro neznámé měny
    return `${amount.toLocaleString(locale)} ${currency}`;
  }
};

/**
 * Formátování čísla
 */
export const formatNumber = (
  value: number | null | undefined,
  locale: string = 'cs-CZ',
  options: Intl.NumberFormatOptions = {}
): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  return new Intl.NumberFormat(locale, options).format(value);
};

/**
 * Formátování data
 */
export const formatDate = (
  date: string | Date | null | undefined,
  formatString: string = 'dd.MM.yyyy'
): string => {
  if (!date) return '—';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      return '—';
    }

    return format(dateObj, formatString, { locale: cs });
  } catch (error) {
    return '—';
  }
};

/**
 * Formátování relativního času
 */
export const formatRelativeTime = (
  date: string | Date | null | undefined
): string => {
  if (!date) return '—';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      return '—';
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'právě teď';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `před ${minutes} min`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `před ${hours} h`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `před ${days} dny`;
    } else {
      return formatDate(dateObj, 'dd.MM.yyyy');
    }
  } catch (error) {
    return '—';
  }
};

/**
 * Formátování velikosti souboru
 */
export const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Formátování rozměrů mince
 */
export const formatDimensions = (
  diameter?: number | null,
  thickness?: number | null,
  weight?: number | null
): string => {
  const parts: string[] = [];

  if (diameter) {
    parts.push(`⌀ ${diameter} mm`);
  }

  if (thickness) {
    parts.push(`tl. ${thickness} mm`);
  }

  if (weight) {
    parts.push(`${weight} g`);
  }

  return parts.length > 0 ? parts.join(' • ') : '—';
};

/**
 * Formátování roku nebo rozmezí let
 */
export const formatYear = (
  year?: number | null,
  yearTo?: number | null
): string => {
  if (!year) return '—';

  if (yearTo && yearTo !== year) {
    return `${year}–${yearTo}`;
  }

  return year.toString();
};

/**
 * Formátování nákladu (mintage)
 */
export const formatMintage = (mintage: number | null | undefined): string => {
  if (!mintage) return '—';

  if (mintage >= 1000000) {
    return `${(mintage / 1000000).toFixed(1)}M`;
  } else if (mintage >= 1000) {
    return `${(mintage / 1000).toFixed(1)}K`;
  }

  return formatNumber(mintage);
};

/**
 * Formátování procent
 */
export const formatPercentage = (
  value: number | null | undefined,
  decimals: number = 1
): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }

  return `${value.toFixed(decimals)}%`;
};

/**
 * Formátování změny hodnoty (s barvou)
 */
export const formatValueChange = (
  currentValue: number | null | undefined,
  previousValue: number | null | undefined
): {
  text: string;
  percentage: string;
  isPositive: boolean | null;
  isNegative: boolean | null;
} => {
  if (!currentValue || !previousValue) {
    return {
      text: '—',
      percentage: '—',
      isPositive: null,
      isNegative: null,
    };
  }

  const change = currentValue - previousValue;
  const percentageChange = (change / previousValue) * 100;

  return {
    text: change >= 0 ? `+${formatCurrency(change)}` : formatCurrency(change),
    percentage: change >= 0 ? `+${formatPercentage(percentageChange)}` : formatPercentage(percentageChange),
    isPositive: change > 0,
    isNegative: change < 0,
  };
};

/**
 * Zkrácení textu s třemi tečkami
 */
export const truncateText = (
  text: string | null | undefined,
  maxLength: number = 100
): string => {
  if (!text) return '';

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.substring(0, maxLength)}...`;
};

/**
 * Formátování katalogového čísla
 */
export const formatCatalogId = (catalogId: string | null | undefined): string => {
  if (!catalogId) return '—';

  // Pokud je to UUID, zkrátíme ho
  if (catalogId.length === 36 && catalogId.includes('-')) {
    return catalogId.substring(0, 8).toUpperCase();
  }

  return catalogId.toUpperCase();
};

/**
 * Formátování stavu mince (condition)
 */
export const formatCondition = (condition: string | null | undefined): string => {
  if (!condition) return '—';

  // Pokud obsahuje pomlčku, je to pravděpodobně grade (např. MS-65)
  if (condition.includes('-')) {
    return condition.toUpperCase();
  }

  // Jinak vrátíme jak je
  return condition;
};

/**
 * Formátování seznamu hodnot
 */
export const formatList = (
  items: (string | null | undefined)[],
  separator: string = ', ',
  emptyText: string = '—'
): string => {
  const validItems = items.filter(item => item && item.trim() !== '');
  
  if (validItems.length === 0) {
    return emptyText;
  }

  return validItems.join(separator);
};

/**
 * Formátování URL pro obrázek
 */
export const formatImageUrl = (
  imagePath: string | null | undefined,
  baseUrl: string = ''
): string => {
  if (!imagePath) return '';

  // Pokud už je to plná URL, vrátíme jak je
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Pokud začíná lomítkem, přidáme jen baseUrl
  if (imagePath.startsWith('/')) {
    return `${baseUrl}${imagePath}`;
  }

  // Jinak přidáme baseUrl a lomítko
  return `${baseUrl}/${imagePath}`;
};

/**
 * Formátování vyhledávacího dotazu pro zvýraznění
 */
export const highlightSearchTerm = (
  text: string,
  searchTerm: string,
  className: string = 'highlight'
): string => {
  if (!searchTerm || !text) return text;

  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, `<span class="${className}">$1</span>`);
};