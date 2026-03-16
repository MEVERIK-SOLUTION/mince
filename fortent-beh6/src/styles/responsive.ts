import { Dimensions, PixelRatio } from 'react-native';

// Získání rozměrů obrazovky
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Základní rozměry pro design (iPhone 12 Pro jako reference)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// Breakpointy pro responzivní design
export const BREAKPOINTS = {
  SMALL_PHONE: 320,
  PHONE: 375,
  LARGE_PHONE: 414,
  SMALL_TABLET: 768,
  TABLET: 1024,
  LARGE_TABLET: 1366,
  DESKTOP: 1920,
};

// Detekce typu zařízení
export const DEVICE_TYPE = {
  isSmallPhone: SCREEN_WIDTH <= BREAKPOINTS.SMALL_PHONE,
  isPhone: SCREEN_WIDTH <= BREAKPOINTS.LARGE_PHONE,
  isTablet: SCREEN_WIDTH >= BREAKPOINTS.SMALL_TABLET && SCREEN_WIDTH < BREAKPOINTS.LARGE_TABLET,
  isLargeTablet: SCREEN_WIDTH >= BREAKPOINTS.LARGE_TABLET,
  isLandscape: SCREEN_WIDTH > SCREEN_HEIGHT,
  isPortrait: SCREEN_WIDTH <= SCREEN_HEIGHT,
};

// Funkce pro škálování rozměrů
export const scale = (size: number): number => {
  const scaleRatio = SCREEN_WIDTH / BASE_WIDTH;
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleRatio));
};

export const verticalScale = (size: number): number => {
  const scaleRatio = SCREEN_HEIGHT / BASE_HEIGHT;
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleRatio));
};

export const moderateScale = (size: number, factor: number = 0.5): number => {
  return Math.round(PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor));
};

// Responzivní velikosti písma
export const FONT_SIZES = {
  xs: moderateScale(10),
  sm: moderateScale(12),
  md: moderateScale(14),
  lg: moderateScale(16),
  xl: moderateScale(18),
  xxl: moderateScale(20),
  xxxl: moderateScale(24),
  h4: moderateScale(20),
  h3: moderateScale(24),
  h2: moderateScale(28),
  h1: moderateScale(32),
};

// Responzivní spacing
export const SPACING = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
  xxxl: scale(64),
};

// Responzivní border radius
export const BORDER_RADIUS = {
  xs: scale(2),
  sm: scale(4),
  md: scale(8),
  lg: scale(12),
  xl: scale(16),
  xxl: scale(24),
  round: scale(50),
};

// Responzivní rozměry ikon
export const ICON_SIZES = {
  xs: scale(12),
  sm: scale(16),
  md: scale(20),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(40),
  xxxl: scale(48),
};

// Responzivní rozměry tlačítek
export const BUTTON_SIZES = {
  small: {
    height: verticalScale(32),
    paddingHorizontal: scale(12),
    fontSize: FONT_SIZES.sm,
  },
  medium: {
    height: verticalScale(40),
    paddingHorizontal: scale(16),
    fontSize: FONT_SIZES.md,
  },
  large: {
    height: verticalScale(48),
    paddingHorizontal: scale(20),
    fontSize: FONT_SIZES.lg,
  },
  xlarge: {
    height: verticalScale(56),
    paddingHorizontal: scale(24),
    fontSize: FONT_SIZES.xl,
  },
};

// Responzivní rozměry karet
export const CARD_SIZES = {
  small: {
    width: scale(150),
    height: verticalScale(200),
    padding: scale(12),
  },
  medium: {
    width: scale(180),
    height: verticalScale(240),
    padding: scale(16),
  },
  large: {
    width: scale(220),
    height: verticalScale(280),
    padding: scale(20),
  },
  full: {
    width: SCREEN_WIDTH - scale(32),
    padding: scale(16),
  },
};

// Grid systém
export const GRID = {
  columns: DEVICE_TYPE.isTablet ? 12 : 6,
  gutter: scale(16),
  margin: scale(16),
};

export const getColumnWidth = (columns: number): number => {
  const totalGutters = (GRID.columns - 1) * GRID.gutter;
  const availableWidth = SCREEN_WIDTH - (GRID.margin * 2) - totalGutters;
  return (availableWidth / GRID.columns) * columns + (columns - 1) * GRID.gutter;
};

// Utility funkce pro responzivní hodnoty
export const responsiveValue = <T>(
  phoneValue: T,
  tabletValue?: T,
  desktopValue?: T
): T => {
  if (DEVICE_TYPE.isLargeTablet && desktopValue !== undefined) {
    return desktopValue;
  }
  if (DEVICE_TYPE.isTablet && tabletValue !== undefined) {
    return tabletValue;
  }
  return phoneValue;
};

// Funkce pro adaptivní layout
export const getAdaptiveLayout = () => {
  if (DEVICE_TYPE.isSmallPhone) {
    return {
      containerPadding: scale(12),
      cardMargin: scale(8),
      fontSize: FONT_SIZES.sm,
      iconSize: ICON_SIZES.sm,
    };
  }
  
  if (DEVICE_TYPE.isTablet) {
    return {
      containerPadding: scale(24),
      cardMargin: scale(16),
      fontSize: FONT_SIZES.lg,
      iconSize: ICON_SIZES.lg,
    };
  }
  
  return {
    containerPadding: scale(16),
    cardMargin: scale(12),
    fontSize: FONT_SIZES.md,
    iconSize: ICON_SIZES.md,
  };
};

// Funkce pro výpočet počtu sloupců v gridu
export const getGridColumns = (itemWidth: number, spacing: number = SPACING.md): number => {
  const availableWidth = SCREEN_WIDTH - (SPACING.md * 2);
  const itemWithSpacing = itemWidth + spacing;
  return Math.floor(availableWidth / itemWithSpacing);
};

// Funkce pro výpočet rozměrů obrázků
export const getImageDimensions = (aspectRatio: number = 1) => {
  const maxWidth = SCREEN_WIDTH - (SPACING.md * 2);
  const maxHeight = SCREEN_HEIGHT * 0.4; // Maximálně 40% výšky obrazovky
  
  let width = maxWidth;
  let height = width / aspectRatio;
  
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }
  
  return { width: Math.round(width), height: Math.round(height) };
};

// Funkce pro safe area
export const getSafeAreaInsets = () => {
  // Základní hodnoty pro safe area (lze rozšířit o react-native-safe-area-context)
  return {
    top: DEVICE_TYPE.isPhone ? verticalScale(44) : verticalScale(20),
    bottom: DEVICE_TYPE.isPhone ? verticalScale(34) : verticalScale(0),
    left: scale(0),
    right: scale(0),
  };
};

// Konstanty pro animace založené na velikosti obrazovky
export const ANIMATION_DISTANCES = {
  slideDistance: SCREEN_WIDTH,
  swipeThreshold: SCREEN_WIDTH * 0.3,
  parallaxDistance: SCREEN_HEIGHT * 0.5,
};

// Responzivní styly pro seznamy
export const LIST_STYLES = {
  itemHeight: responsiveValue(
    verticalScale(60),
    verticalScale(70),
    verticalScale(80)
  ),
  itemPadding: responsiveValue(
    scale(12),
    scale(16),
    scale(20)
  ),
  separatorHeight: 1,
  sectionHeaderHeight: responsiveValue(
    verticalScale(40),
    verticalScale(45),
    verticalScale(50)
  ),
};

// Responzivní styly pro modály
export const MODAL_STYLES = {
  maxWidth: responsiveValue(
    SCREEN_WIDTH - scale(32),
    scale(500),
    scale(600)
  ),
  maxHeight: SCREEN_HEIGHT * 0.8,
  borderRadius: BORDER_RADIUS.lg,
  padding: responsiveValue(
    scale(16),
    scale(24),
    scale(32)
  ),
};

// Utility pro detekci orientace
export const isLandscape = () => SCREEN_WIDTH > SCREEN_HEIGHT;
export const isPortrait = () => SCREEN_WIDTH <= SCREEN_HEIGHT;

// Funkce pro výpočet optimální velikosti textu
export const getOptimalFontSize = (
  text: string,
  maxWidth: number,
  baseFontSize: number = FONT_SIZES.md
): number => {
  const textLength = text.length;
  const charWidth = baseFontSize * 0.6; // Přibližná šířka znaku
  const estimatedWidth = textLength * charWidth;
  
  if (estimatedWidth <= maxWidth) {
    return baseFontSize;
  }
  
  const scaleFactor = maxWidth / estimatedWidth;
  return Math.max(baseFontSize * scaleFactor, FONT_SIZES.xs);
};

// Export všech utility funkcí
export default {
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  BREAKPOINTS,
  DEVICE_TYPE,
  scale,
  verticalScale,
  moderateScale,
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  ICON_SIZES,
  BUTTON_SIZES,
  CARD_SIZES,
  GRID,
  getColumnWidth,
  responsiveValue,
  getAdaptiveLayout,
  getGridColumns,
  getImageDimensions,
  getSafeAreaInsets,
  ANIMATION_DISTANCES,
  LIST_STYLES,
  MODAL_STYLES,
  isLandscape,
  isPortrait,
  getOptimalFontSize,
};