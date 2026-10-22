// Calendar-date helpers. The practice runs on Eastern time, so "today",
// "this week" and every dashboard bucket are Eastern dates — never UTC dates,
// which roll over at 8 pm ET and would put evening leads on the next day.
// Dates are handled as 'YYYY-MM-DD' strings; arithmetic is done in UTC on
// those strings so it is never affected by the server's or browser's zone.

export const PRACTICE_TZ = 'America/New_York'

const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PRACTICE_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The Eastern calendar date ('YYYY-MM-DD') of an instant. */
export function easternDate(d: Date | string): string {
  return ymdFormatter.format(typeof d === 'string' ? new Date(d) : d)
}

function toUTC(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`)
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(ymd: string, n: number): string {
  const d = toUTC(ymd)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUTC(d)
}

export function addMonths(ymd: string, n: number): string {
  const d = toUTC(ymd)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  return fromUTC(d)
}

/** Monday of the week containing ymd. */
export function startOfWeek(ymd: string): string {
  const dow = toUTC(ymd).getUTCDay() // 0 = Sunday
  return addDays(ymd, -((dow + 6) % 7))
}

export function startOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

export function formatYmd(ymd: string, opts: Intl.DateTimeFormatOptions): string {
  return toUTC(ymd).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
}
