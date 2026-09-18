/**
 * Device Date & Time Utility
 * Reads directly from the user's mobile device or browser clock.
 */

export interface DeviceTimeContext {
  currentDate: string; // YYYY-MM-DD (local to device)
  currentTime: string; // HH:mm (local to device)
  currentTimeWithSeconds: string; // HH:mm:ss (local to device)
  timezone: string; // e.g. "America/Lima", "America/Santiago"
  timezoneOffset: string; // e.g. "-05:00", "+01:00"
  currentIso: string; // Full ISO timestamp
  weekday: string; // e.g. "Viernes"
  formattedDate: string; // e.g. "Viernes, 18 de septiembre de 2026"
  tomorrowDate: string; // YYYY-MM-DD (local tomorrow)
  yesterdayDate: string; // YYYY-MM-DD (local yesterday)
}

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Returns YYYY-MM-DD in the device's local timezone
 */
export function getDeviceLocalDate(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns HH:mm in the device's local 24h format
 */
export function getDeviceLocalTime(d = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Returns HH:mm:ss in the device's local 24h format
 */
export function getDeviceLocalTimeWithSeconds(d = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Returns the device's IANA timezone (e.g. "America/Lima")
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima';
  } catch {
    return 'America/Lima';
  }
}

/**
 * Returns the device's timezone offset formatted as +/-HH:mm (e.g. "-05:00")
 */
export function getDeviceTimezoneOffset(d = new Date()): string {
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/**
 * Returns the local day of the week in Spanish
 */
export function getDeviceDayOfWeek(d = new Date()): string {
  return WEEKDAYS[d.getDay()] || 'Lunes';
}

/**
 * Returns long human readable localized date in Spanish
 */
export function getDeviceFormattedDate(d = new Date()): string {
  const weekday = getDeviceDayOfWeek(d);
  const day = d.getDate();
  const month = MONTHS[d.getMonth()] || 'septiembre';
  const year = d.getFullYear();
  return `${weekday}, ${day} de ${month} de ${year}`;
}

/**
 * Returns tomorrow's date YYYY-MM-DD local to device
 */
export function getTomorrowLocalDate(d = new Date()): string {
  const tomorrow = new Date(d);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDeviceLocalDate(tomorrow);
}

/**
 * Returns yesterday's date YYYY-MM-DD local to device
 */
export function getYesterdayLocalDate(d = new Date()): string {
  const yesterday = new Date(d);
  yesterday.setDate(yesterday.getDate() - 1);
  return getDeviceLocalDate(yesterday);
}

/**
 * Returns complete device time context bundle
 */
export function getDeviceFullContext(): DeviceTimeContext {
  const now = new Date();
  return {
    currentDate: getDeviceLocalDate(now),
    currentTime: getDeviceLocalTime(now),
    currentTimeWithSeconds: getDeviceLocalTimeWithSeconds(now),
    timezone: getDeviceTimezone(),
    timezoneOffset: getDeviceTimezoneOffset(now),
    currentIso: now.toISOString(),
    weekday: getDeviceDayOfWeek(now),
    formattedDate: getDeviceFormattedDate(now),
    tomorrowDate: getTomorrowLocalDate(now),
    yesterdayDate: getYesterdayLocalDate(now),
  };
}

/**
 * Normalizes a scheduledTime string ensuring it has the full device timezone offset.
 * Handles:
 * - "2026-09-18T10:45:00" -> "2026-09-18T10:45:00-05:00"
 * - "2026-09-18 10:45" -> "2026-09-18T10:45:00-05:00"
 * - "10:45" -> "[currentDate]T10:45:00-05:00"
 */
export function normalizeScheduledTime(
  rawTime: string,
  tzOffset = getDeviceTimezoneOffset(),
  defaultDate = getDeviceLocalDate()
): string {
  if (!rawTime) return new Date().toISOString();

  let cleaned = rawTime.trim();

  // If only time is provided (e.g. "14:30" or "14:30:00")
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(cleaned)) {
    const parts = cleaned.split(':');
    const hh = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const ss = parts[2] ? parts[2].padStart(2, '0') : '00';
    return `${defaultDate}T${hh}:${mm}:${ss}${tzOffset}`;
  }

  // Replace space with T
  if (cleaned.includes(' ') && !cleaned.includes('T')) {
    cleaned = cleaned.replace(' ', 'T');
  }

  // Check if timezone is already present (Z or +/-HH:mm)
  const hasTimezone = /([Zz]|[+-]\d{2}:\d{2})$/.test(cleaned);

  // If no seconds provided (e.g. "2026-09-18T10:45")
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cleaned)) {
    cleaned += ':00';
  }

  if (!hasTimezone) {
    return `${cleaned}${tzOffset}`;
  }

  return cleaned;
}

/**
 * Formats an ISO or date-time string into "DD/MM/YYYY HH:mm" for display
 */
export function formatDeviceDisplayDate(isoOrDate: string): string {
  if (!isoOrDate) return '';
  try {
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoOrDate;
  }
}
