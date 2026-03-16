import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from './constants';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validace emailu
 */
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('Email je povinný');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Neplatný formát emailu');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace hesla
 */
export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Heslo je povinné');
  } else {
    if (password.length < 8) {
      errors.push('Heslo musí mít alespoň 8 znaků');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Heslo musí obsahovat alespoň jedno malé písmeno');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Heslo musí obsahovat alespoň jedno velké písmeno');
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Heslo musí obsahovat alespoň jednu číslici');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace názvu mince
 */
export const validateCoinName = (name: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!name || name.trim() === '') {
    errors.push('Název mince je povinný');
  } else if (name.trim().length < 2) {
    errors.push('Název mince musí mít alespoň 2 znaky');
  } else if (name.trim().length > 200) {
    errors.push('Název mince může mít maximálně 200 znaků');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace roku
 */
export const validateYear = (year: number | null | undefined): ValidationResult => {
  const errors: string[] = [];
  const currentYear = new Date().getFullYear();
  
  if (year !== null && year !== undefined) {
    if (year < -3000) {
      errors.push('Rok nemůže být starší než 3000 př. n. l.');
    } else if (year > currentYear + 10) {
      errors.push(`Rok nemůže být větší než ${currentYear + 10}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace rozmezí let
 */
export const validateYearRange = (
  yearFrom: number | null | undefined,
  yearTo: number | null | undefined
): ValidationResult => {
  const errors: string[] = [];
  
  if (yearFrom !== null && yearFrom !== undefined) {
    const fromValidation = validateYear(yearFrom);
    if (!fromValidation.isValid) {
      errors.push(...fromValidation.errors.map(err => `Rok od: ${err}`));
    }
  }
  
  if (yearTo !== null && yearTo !== undefined) {
    const toValidation = validateYear(yearTo);
    if (!toValidation.isValid) {
      errors.push(...toValidation.errors.map(err => `Rok do: ${err}`));
    }
  }
  
  if (
    yearFrom !== null && yearFrom !== undefined &&
    yearTo !== null && yearTo !== undefined &&
    yearFrom > yearTo
  ) {
    errors.push('Rok od nemůže být větší než rok do');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace ceny
 */
export const validatePrice = (price: number | null | undefined): ValidationResult => {
  const errors: string[] = [];
  
  if (price !== null && price !== undefined) {
    if (price < 0) {
      errors.push('Cena nemůže být záporná');
    } else if (price > 999999999) {
      errors.push('Cena je příliš vysoká');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace rozměrů mince
 */
export const validateDimensions = (
  diameter?: number | null,
  thickness?: number | null,
  weight?: number | null
): ValidationResult => {
  const errors: string[] = [];
  
  if (diameter !== null && diameter !== undefined) {
    if (diameter <= 0) {
      errors.push('Průměr musí být větší než 0');
    } else if (diameter > 1000) {
      errors.push('Průměr je příliš velký');
    }
  }
  
  if (thickness !== null && thickness !== undefined) {
    if (thickness <= 0) {
      errors.push('Tloušťka musí být větší než 0');
    } else if (thickness > 100) {
      errors.push('Tloušťka je příliš velká');
    }
  }
  
  if (weight !== null && weight !== undefined) {
    if (weight <= 0) {
      errors.push('Hmotnost musí být větší než 0');
    } else if (weight > 10000) {
      errors.push('Hmotnost je příliš velká');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace nákladu (mintage)
 */
export const validateMintage = (mintage: number | null | undefined): ValidationResult => {
  const errors: string[] = [];
  
  if (mintage !== null && mintage !== undefined) {
    if (mintage < 0) {
      errors.push('Náklad nemůže být záporný');
    } else if (mintage > 999999999999) {
      errors.push('Náklad je příliš velký');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace obrázku
 */
export const validateImage = (file: File): ValidationResult => {
  const errors: string[] = [];
  
  // Kontrola typu souboru
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    errors.push(`Nepodporovaný typ souboru. Povolené typy: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
  }
  
  // Kontrola velikosti souboru
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`Soubor je příliš velký. Maximální velikost: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB`);
  }
  
  // Kontrola názvu souboru
  if (file.name.length > 255) {
    errors.push('Název souboru je příliš dlouhý');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace více obrázků
 */
export const validateImages = (files: File[]): ValidationResult => {
  const errors: string[] = [];
  
  if (files.length > 10) {
    errors.push('Můžete nahrát maximálně 10 obrázků najednou');
  }
  
  files.forEach((file, index) => {
    const validation = validateImage(file);
    if (!validation.isValid) {
      errors.push(`Soubor ${index + 1} (${file.name}): ${validation.errors.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace URL
 */
export const validateUrl = (url: string): ValidationResult => {
  const errors: string[] = [];
  
  if (url && url.trim() !== '') {
    try {
      new URL(url);
    } catch {
      errors.push('Neplatná URL adresa');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace telefonního čísla
 */
export const validatePhone = (phone: string): ValidationResult => {
  const errors: string[] = [];
  
  if (phone && phone.trim() !== '') {
    // Základní validace pro české telefonní čísla
    const phoneRegex = /^(\+420)?[0-9]{9}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
      errors.push('Neplatné telefonní číslo');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace PSČ
 */
export const validatePostalCode = (postalCode: string): ValidationResult => {
  const errors: string[] = [];
  
  if (postalCode && postalCode.trim() !== '') {
    // České PSČ
    const czechPostalCodeRegex = /^[0-9]{3}\s?[0-9]{2}$/;
    if (!czechPostalCodeRegex.test(postalCode)) {
      errors.push('Neplatné PSČ (formát: 12345 nebo 123 45)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validace celého formuláře mince
 */
export const validateCoinForm = (data: any): ValidationResult => {
  const errors: string[] = [];
  
  // Povinná pole
  const nameValidation = validateCoinName(data.name);
  if (!nameValidation.isValid) {
    errors.push(...nameValidation.errors);
  }
  
  if (!data.country || data.country.trim() === '') {
    errors.push('Země je povinná');
  }
  
  if (!data.currency || data.currency.trim() === '') {
    errors.push('Měna je povinná');
  }
  
  // Volitelná pole s validací
  const yearValidation = validateYear(data.year);
  if (!yearValidation.isValid) {
    errors.push(...yearValidation.errors);
  }
  
  const priceValidation = validatePrice(data.current_value);
  if (!priceValidation.isValid) {
    errors.push(...priceValidation.errors);
  }
  
  const dimensionsValidation = validateDimensions(
    data.diameter,
    data.thickness,
    data.weight
  );
  if (!dimensionsValidation.isValid) {
    errors.push(...dimensionsValidation.errors);
  }
  
  const mintageValidation = validateMintage(data.mintage);
  if (!mintageValidation.isValid) {
    errors.push(...mintageValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Sanitizace HTML
 */
export const sanitizeHtml = (html: string): string => {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
};

/**
 * Validace a sanitizace textu
 */
export const validateAndSanitizeText = (
  text: string,
  maxLength: number = 1000
): ValidationResult & { sanitizedText: string } => {
  const errors: string[] = [];
  
  if (text.length > maxLength) {
    errors.push(`Text může mít maximálně ${maxLength} znaků`);
  }
  
  const sanitizedText = sanitizeHtml(text);

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedText,
  };
};