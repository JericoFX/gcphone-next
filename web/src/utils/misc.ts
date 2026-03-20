export const isEnvBrowser = (): boolean =>
  typeof window !== 'undefined' && !(window as any).invokeNative;

export const normalizeAppLanguage = (value?: string | null): 'es' | 'en' | 'pt' | 'fr' | 'de' | 'it' | 'pl' | 'ru' => {
  if (!value) return 'es';

  const normalized = String(value).trim().toLowerCase().replace('-', '_');

  if (normalized === 'en' || normalized === 'en_us') return 'en';
  if (normalized === 'pt' || normalized === 'pt_br') return 'pt';
  if (normalized === 'fr' || normalized === 'fr_fr') return 'fr';
  if (normalized === 'de' || normalized === 'de_de') return 'de';
  if (normalized === 'it' || normalized === 'it_it') return 'it';
  if (normalized === 'pl' || normalized === 'pl_pl') return 'pl';
  if (normalized === 'ru' || normalized === 'ru_ru') return 'ru';
  if (normalized === 'es' || normalized === 'es_es') return 'es';

  return 'es';
};

export const noop = () => {};

export const generateColorForString = (str: string): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8B500', '#FF6F61', '#6B5B95', '#88B04B', '#F7CAC9',
    '#92A8D1', '#955251', '#B565A7', '#009B77', '#DD4124'
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export const getBestFontColor = (bgColor: string): string => {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  return brightness > 128 ? '#000000' : '#FFFFFF';
};

export const formatPhoneNumber = (phone: string, framework: 'esx' | 'qbcore' | 'qbox' | 'unknown' = 'unknown'): string => {
  if (framework === 'qbcore' || framework === 'qbox') {
    return phone;
  }

  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 7) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  return phone;
};

export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const TIME_LABELS: Record<string, { ago: string; now: string; units: Array<[string, number, string]> }> = {
  es: { ago: 'hace', now: 'ahora', units: [['año', 31536000, 'años'], ['mes', 2592000, 'meses'], ['semana', 604800, 'semanas'], ['dia', 86400, 'dias'], ['hora', 3600, 'horas'], ['minuto', 60, 'minutos']] },
  en: { ago: 'ago', now: 'now', units: [['year', 31536000, 'years'], ['month', 2592000, 'months'], ['week', 604800, 'weeks'], ['day', 86400, 'days'], ['hour', 3600, 'hours'], ['minute', 60, 'minutes']] },
  pt: { ago: 'ha', now: 'agora', units: [['ano', 31536000, 'anos'], ['mes', 2592000, 'meses'], ['semana', 604800, 'semanas'], ['dia', 86400, 'dias'], ['hora', 3600, 'horas'], ['minuto', 60, 'minutos']] },
  fr: { ago: 'il y a', now: 'maintenant', units: [['an', 31536000, 'ans'], ['mois', 2592000, 'mois'], ['semaine', 604800, 'semaines'], ['jour', 86400, 'jours'], ['heure', 3600, 'heures'], ['minute', 60, 'minutes']] },
  de: { ago: 'vor', now: 'jetzt', units: [['Jahr', 31536000, 'Jahren'], ['Monat', 2592000, 'Monaten'], ['Woche', 604800, 'Wochen'], ['Tag', 86400, 'Tagen'], ['Stunde', 3600, 'Stunden'], ['Minute', 60, 'Minuten']] },
  it: { ago: 'fa', now: 'adesso', units: [['anno', 31536000, 'anni'], ['mese', 2592000, 'mesi'], ['settimana', 604800, 'settimane'], ['giorno', 86400, 'giorni'], ['ora', 3600, 'ore'], ['minuto', 60, 'minuti']] },
  pl: { ago: 'temu', now: 'teraz', units: [['rok', 31536000, 'lat'], ['miesiac', 2592000, 'miesiecy'], ['tydzien', 604800, 'tygodni'], ['dzien', 86400, 'dni'], ['godzina', 3600, 'godzin'], ['minuta', 60, 'minut']] },
  ru: { ago: 'назад', now: 'сейчас', units: [['год', 31536000, 'лет'], ['месяц', 2592000, 'месяцев'], ['неделя', 604800, 'недель'], ['день', 86400, 'дней'], ['час', 3600, 'часов'], ['минута', 60, 'минут']] },
};

export const timeAgo = (date: Date | string, language?: string | null): string => {
  const lang = normalizeAppLanguage(language);
  const labels = TIME_LABELS[lang] || TIME_LABELS.es;
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  for (const [singular, secondsInUnit, plural] of labels.units) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      const unit = interval === 1 ? singular : plural;
      return lang === 'en'
        ? `${interval} ${unit} ${labels.ago}`
        : `${labels.ago} ${interval} ${unit}`;
    }
  }

  return labels.now;
};
