import type { SupportedLocale, Direction } from '@nutriai/types';
import type { fa } from './locales/fa';

export type { SupportedLocale, Direction };

export type RecursiveRecord<T> = {
  [K in keyof T]: T[K] extends object ? RecursiveRecord<T[K]> : string;
};

export type TranslationSchema = typeof fa;
export type TranslationDictionary = RecursiveRecord<TranslationSchema>;

export type PathInto<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? `${K}.${PathInto<T[K]>}`
          : `${K}`
        : never;
    }[keyof T]
  : never;

export type TranslationKey = PathInto<TranslationSchema>;
