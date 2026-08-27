import { ExpiryCalculation, ExpiryStatus } from '../types';

export function formatDuration(totalDays: number, lang: 'ar' | 'en' = 'ar'): string {
  const days = Math.abs(Math.round(totalDays));
  if (days === 0) return lang === 'en' ? 'Today' : 'اليوم';

  const months = Math.floor(days / 30);
  const remainderDays = days % 30;

  if (lang === 'en') {
    if (months === 0) {
      return days === 1 ? '1 day' : `${days} days`;
    }
    const monthsPart = months === 1 ? '1 month' : `${months} months`;
    if (remainderDays === 0) return monthsPart;
    const daysPart = remainderDays === 1 ? '1 day' : `${remainderDays} days`;
    return `${monthsPart} & ${daysPart}`;
  }

  // Arabic formatting
  if (months === 0) {
    if (days === 1) return 'يوم واحد';
    if (days === 2) return 'يومان';
    if (days >= 3 && days <= 10) return `${days} أيام`;
    return `${days} يوماً`;
  }

  let monthsPart = '';
  if (months === 1) {
    monthsPart = 'شهر';
  } else if (months === 2) {
    monthsPart = 'شهران';
  } else if (months >= 3 && months <= 10) {
    monthsPart = `${months} أشهر`;
  } else {
    monthsPart = `${months} شهراً`;
  }

  if (remainderDays === 0) {
    return monthsPart;
  }

  let daysPart = '';
  if (remainderDays === 1) {
    daysPart = 'يوم واحد';
  } else if (remainderDays === 2) {
    daysPart = 'يومان';
  } else if (remainderDays >= 3 && remainderDays <= 10) {
    daysPart = `${remainderDays} أيام`;
  } else {
    daysPart = `${remainderDays} يوماً`;
  }

  return `${monthsPart} و ${daysPart}`;
}

export const formatDurationArabic = (days: number) => formatDuration(days, 'ar');

/**
 * Calculates remaining days and visual badges based on FEFO requirements & custom settings:
 * - Expired: < 0 days (Red)
 * - Critical: <= criticalThreshold (Default 7 days) (Red)
 * - Warning: <= warningThreshold (Default 30 days or user custom settings) (Amber/Orange)
 * - Safe: > warningThreshold (Green)
 */
export function calculateExpiry(
  expiryDateStr: string, 
  referenceDateStr?: string, 
  lang: 'ar' | 'en' = 'ar',
  warningThresholdDays: number = 30,
  criticalThresholdDays: number = 7
): ExpiryCalculation {
  try {
    const today = referenceDateStr ? new Date(referenceDateStr) : new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDateStr);
    expiry.setHours(0, 0, 0, 0);

    if (isNaN(expiry.getTime())) {
      return {
        daysRemaining: 0,
        status: 'warning',
        statusText: lang === 'en' ? 'Invalid Date' : 'تاريخ غير صالح',
        colorHex: '#9E9E9E',
        bgHex: '#F5F5F5',
        textColor: '#616161',
        percentRemaining: 0
      };
    }

    const diffTime = expiry.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      const absDays = Math.abs(daysRemaining);
      const durationText = formatDuration(absDays, lang);
      return {
        daysRemaining,
        status: 'expired',
        statusText: lang === 'en' ? `Expired (${durationText} ago)` : `منتهي منذ ${durationText}`,
        colorHex: '#D32F2F', // Red
        bgHex: '#FFEBEE',
        textColor: '#C62828',
        percentRemaining: 0
      };
    }

    if (daysRemaining === 0) {
      return {
        daysRemaining: 0,
        status: 'critical',
        statusText: lang === 'en' ? 'Expires Today!' : 'ينتهي اليوم!',
        colorHex: '#D32F2F',
        bgHex: '#FFEBEE',
        textColor: '#C62828',
        percentRemaining: 5
      };
    }

    const durationText = formatDuration(daysRemaining, lang);

    if (daysRemaining <= criticalThresholdDays) {
      return {
        daysRemaining,
        status: 'critical',
        statusText: lang === 'en' ? `Critical: ${durationText} left` : `حرج: متبقي ${durationText}`,
        colorHex: '#D32F2F',
        bgHex: '#FFEBEE',
        textColor: '#B71C1C',
        percentRemaining: Math.max(5, Math.round((daysRemaining / (warningThresholdDays || 30)) * 100))
      };
    }

    if (daysRemaining <= warningThresholdDays) {
      return {
        daysRemaining,
        status: 'warning',
        statusText: lang === 'en' ? `Warning: ${durationText} left` : `متبقي ${durationText}`,
        colorHex: '#FFA000',
        bgHex: '#FFF8E1',
        textColor: '#E65100',
        percentRemaining: Math.round((daysRemaining / (warningThresholdDays || 30)) * 100)
      };
    }

    // Safe
    return {
      daysRemaining,
      status: 'safe',
      statusText: lang === 'en' ? `Safe: ${durationText} left` : `سليم: متبقي ${durationText}`,
      colorHex: '#2E7D32',
      bgHex: '#E8F5E9',
      textColor: '#1B5E20',
      percentRemaining: 100
    };
  } catch (e) {
    return {
      daysRemaining: 0,
      status: 'warning',
      statusText: lang === 'en' ? 'Invalid Date' : 'تاريخ غير صالح',
      colorHex: '#9E9E9E',
      bgHex: '#F5F5F5',
      textColor: '#616161',
      percentRemaining: 0
    };
  }
}

export function formatDateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(baseDate: Date, days: number): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return formatDateToISO(d);
}
