export interface PersianNormalizationOptions {
  removeDiacritics?: boolean;
  normalizeDigits?: boolean;
  normalizeLetters?: boolean;
  normalizeZwnj?: boolean;
  trimWhitespace?: boolean;
}

/**
 * Normalizes Persian/Arabic characters to canonical Persian representations while preserving visual fidelity:
 * - Replaces Arabic Yeh (ي, ى) with Persian Yeh (ی)
 * - Replaces Arabic Kaf (ك) with Persian Keheh (ک)
 * - Normalizes Arabic Teh Marbuta (ة, ۀ)
 * - Normalizes Persian and Arabic digits to ASCII (0-9)
 * - Collapses repeated whitespaces and trims
 * - Standardizes Zero-Width Non-Joiner (ZWNJ / نیم‌فاصله)
 */
export function normalizePersianText(text: string, options?: PersianNormalizationOptions): string {
  if (!text) return '';

  let result = text;

  // 1. Digits: Persian (۰-۹) and Arabic (٠-٩) to ASCII (0-9)
  if (options?.normalizeDigits !== false) {
    result = result
      .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06f0 + 48))
      .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48));
  }

  // 2. Letters: Arabic letters to standard Persian
  if (options?.normalizeLetters !== false) {
    result = result
      .replace(/[\u064A\u0649\u06D0\u06D1]/g, 'ی')
      .replace(/\u0643/g, 'ک')
      .replace(/[\u0629\u06C0]/g, 'ه')
      .replace(/\u0626/g, 'ی');
  }

  // 3. Diacritics (اعراب: تنوین، فتحه، ضمه، کسره، تشدید، سکون)
  if (options?.removeDiacritics !== false) {
    result = result.replace(/[\u064B-\u065F\u0670]/g, '');
  }

  // 4. ZWNJ (نیم‌فاصله)
  if (options?.normalizeZwnj !== false) {
    result = result.replace(/\u200C+/g, '\u200C');
    result = result.replace(/(^\u200C|\u200C$|\s\u200C|\u200C\s)/g, ' ');
  }

  // 5. Whitespace normalization
  if (options?.trimWhitespace !== false) {
    result = result.replace(/[\s\t\n\r]+/g, ' ').trim();
  }

  return result;
}

/**
 * Normalizes text for strict duplicate detection / collision checking.
 * Strips ZWNJ, punctuation, and diacritics to detect semantic collisions (e.g., "قورمه‌سبزی" vs "قورمه سبزی" vs "قورمه‌ سبزي").
 */
export function normalizePersianForComparison(text: string): string {
  if (!text) return '';
  return normalizePersianText(text, {
    removeDiacritics: true,
    normalizeDigits: true,
    normalizeLetters: true,
    normalizeZwnj: false,
    trimWhitespace: false,
  })
    .replace(/\u200C/g, ' ')
    .replace(/[-_.,/\\()[\]{}:;!?"'«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
