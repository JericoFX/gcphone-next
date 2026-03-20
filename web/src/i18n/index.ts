import esES from '../locales/es_ES.json';
import enUS from '../locales/en_US.json';
import ptBR from '../locales/pt_BR.json';
import frFR from '../locales/fr_FR.json';
import deDE from '../locales/de_DE.json';
import itIT from '../locales/it_IT.json';
import plPL from '../locales/pl_PL.json';
import ruRU from '../locales/ru_RU.json';
import { normalizeAppLanguage } from '../utils/misc';

export type AppLanguage = 'es' | 'en' | 'pt' | 'fr' | 'de' | 'it' | 'pl' | 'ru';
export type LocaleCode = 'es_ES' | 'en_US' | 'pt_BR' | 'fr_FR' | 'de_DE' | 'it_IT' | 'pl_PL' | 'ru_RU';

type LocaleDictionary = {
  lang: LocaleCode;
  name: string;
  strings: Record<string, string>;
};

const LOCALES: Record<LocaleCode, LocaleDictionary> = {
  es_ES: esES as LocaleDictionary,
  en_US: enUS as LocaleDictionary,
  pt_BR: ptBR as LocaleDictionary,
  fr_FR: frFR as LocaleDictionary,
  de_DE: deDE as LocaleDictionary,
  it_IT: itIT as LocaleDictionary,
  pl_PL: plPL as LocaleDictionary,
  ru_RU: ruRU as LocaleDictionary,
};

const LANGUAGE_TO_LOCALE: Record<AppLanguage, LocaleCode> = {
  es: 'es_ES',
  en: 'en_US',
  pt: 'pt_BR',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  pl: 'pl_PL',
  ru: 'ru_RU',
};

const LOCALE_TO_BCP47: Record<LocaleCode, string> = {
  es_ES: 'es-ES',
  en_US: 'en-US',
  pt_BR: 'pt-BR',
  fr_FR: 'fr-FR',
  de_DE: 'de-DE',
  it_IT: 'it-IT',
  pl_PL: 'pl-PL',
  ru_RU: 'ru-RU',
};

const ES_VALUE_TO_KEY = Object.entries(esES.strings || {}).reduce<Record<string, string>>((acc, [key, value]) => {
  if (typeof value === 'string' && value.trim() && !acc[value]) acc[value] = key;
  return acc;
}, {});

export function localeFromLanguage(language?: string | null): LocaleCode {
  return LANGUAGE_TO_LOCALE[normalizeAppLanguage(language)];
}

export function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'es';
  return normalizeAppLanguage(window.localStorage.getItem('gcphone:language'));
}

export function localeTagFromLanguage(language?: string | null): string {
  return LOCALE_TO_BCP47[localeFromLanguage(language)];
}

export function availableLocales() {
  return Object.values(LOCALES).map((entry) => ({ lang: entry.lang, name: entry.name }));
}

function resolveText(key: string, locale: LocaleCode): string {
  const exact = LOCALES[locale].strings[key];
  if (exact) return exact;

  const fallback = LOCALES.es_ES.strings[key];
  if (fallback) return fallback;

  return key;
}

export function t(key: string, language?: string | null, params?: Record<string, string | number>): string {
  const locale = localeFromLanguage(language);
  const source = resolveText(key, locale);

  if (!params) return source;

  return source.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = params[token];
    return value === undefined ? `{${token}}` : String(value);
  });
}

export function tl(text: string, language?: string | null): string {
  if (!text) return text;
  const maybeKey = ES_VALUE_TO_KEY[text];
  if (!maybeKey) return text;
  return t(maybeKey, language);
}

export function appName(appId: string, fallback: string, language?: string | null): string {
  const key = `app.${appId}`;
  const translated = t(key, language);
  return translated === key ? fallback : translated;
}

export function formatDate(value: Date, language?: string | null, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeTagFromLanguage(language), options).format(value);
}

export function formatTime(value: Date, language?: string | null, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeTagFromLanguage(language), options).format(value);
}

export function languageFromLocale(locale: LocaleCode): AppLanguage {
  const pair = Object.entries(LANGUAGE_TO_LOCALE).find((entry) => entry[1] === locale);
  return (pair?.[0] as AppLanguage | undefined) || 'es';
}
