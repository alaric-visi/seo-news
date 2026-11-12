/** All calendar logic runs in London time (GMT/BST). */
export const TIME_ZONE = 'Europe/London';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** YYYY-MM-DD of an instant, in London. */
export function londonDay(date: Date | string): string {
  return dayFmt.format(typeof date === 'string' ? new Date(date) : date);
}

export const todayInLondon = () => londonDay(new Date());

/** Parses the date formats feeds use (RFC 822, ISO 8601). Returns null if unusable. */
export function parseFeedDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // Some feeds use named zones Date can't read, e.g. "Wed, 11 Nov 2026 15:45:00 EST".
  const fixed = s.replace(/\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b/, (z) => ({
    EST: '-0500', EDT: '-0400', CST: '-0600', CDT: '-0500', MST: '-0700', MDT: '-0600', PST: '-0800', PDT: '-0700',
  })[z]!);
  const d2 = new Date(fixed);
  return Number.isNaN(d2.getTime()) ? null : d2;
}

/** Adds days to a YYYY-MM-DD string (calendar arithmetic, no time zone involved). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

const longFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});
const shortFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });

/** "Thursday 12 November 2026" for a YYYY-MM-DD day. */
export const formatDayLong = (day: string) => longFmt.format(new Date(`${day}T12:00:00Z`)).replace(',', '');
/** "12 Nov" */
export const formatDayShort = (day: string) => shortFmt.format(new Date(`${day}T12:00:00Z`));
/** "November 2026" for YYYY-MM */
export const formatMonth = (month: string) => monthFmt.format(new Date(`${month}-15T12:00:00Z`));
/** "14:05" London time. */
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
