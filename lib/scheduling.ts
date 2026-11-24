// Slot engine for follow-up call scheduling.
//
// Everything is reasoned about in the practice's local time (Eastern) and
// stored as UTC instants. There are no date libraries in this project, so the
// timezone math uses Intl, which handles DST correctly for business hours.

export const TZ = 'America/New_York'
export const SLOT_MINUTES = 30
// Prospects may book from tomorrow (nothing same-day) up to 14 days out.
export const MIN_DAYS_AHEAD = 1
export const MAX_DAYS_AHEAD = 14
// Whose published calendar the website books against.
export const OWNER_EMAIL =
  process.env.BOOKING_OWNER_EMAIL || 'jfranceschi@affordableplasticsurgery.com'

export interface AvailabilityRuleLike {
  weekday: number // 0 = Sunday … 6 = Saturday
  start_time: string // 'HH:MM' or 'HH:MM:SS'
  end_time: string
}
export interface AvailabilityOverrideLike {
  date: string // 'YYYY-MM-DD' (Eastern calendar date)
  kind: 'block' | 'open'
  start_time?: string | null
  end_time?: string | null
}
export interface Slot {
  start: string // ISO UTC
  end: string // ISO UTC
  date: string // 'YYYY-MM-DD' Eastern
  label: string // '2:00 PM'
}
export interface SlotDay {
  date: string
  label: string // 'Wednesday, October 15'
  slots: Slot[]
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number) => String(n).padStart(2, '0')

// Wall-clock parts of an instant, in Eastern time.
export function etParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const p: Record<string, string> = {}
  for (const part of f.formatToParts(d)) p[part.type] = part.value
  return {
    y: +p.year,
    m: +p.month,
    d: +p.day,
    h: +p.hour % 24, // some engines render midnight as "24"
    mi: +p.minute,
    weekday: WEEKDAYS.indexOf(p.weekday),
  }
}

// 'YYYY-MM-DD' of an instant, in Eastern time.
export function etDateStr(d: Date): string {
  const p = etParts(d)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

// Add n calendar days to a 'YYYY-MM-DD' string.
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// The UTC instant for an Eastern wall-clock date + time ('HH:MM').
export function etToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  // Treat the wall time as if it were UTC, see what Eastern wall time that
  // instant actually is, and shift by the difference.
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm))
  const p = etParts(guess)
  const wallAsUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi)
  const offsetMs = wallAsUtc - guess.getTime()
  return new Date(guess.getTime() - offsetMs)
}

export function normalizeTime(t: string): string {
  // DB `time` columns come back as 'HH:MM:SS'; the engine works in 'HH:MM'.
  return t.slice(0, 5)
}

function timeToMinutes(t: string): number {
  const [h, m] = normalizeTime(t).split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

export function formatTimeLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d)
}
export function formatDateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(etToUtc(dateStr, '12:00'))
}
// 'Wednesday, October 15 at 2:00 PM ET'
export function formatFullEt(d: Date): string {
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(d)
  return `${date} at ${formatTimeLabel(d)} ET`
}

export interface GenerateSlotsInput {
  rules: AvailabilityRuleLike[]
  overrides: AvailabilityOverrideLike[]
  bookedStarts: string[] // ISO UTC strings of live bookings
  now?: Date
  slotMinutes?: number
  minDaysAhead?: number
  maxDaysAhead?: number
}

// Pure function: expands weekly rules + date overrides into concrete open
// 30-minute slots, minus anything already booked, within the booking window.
export function generateSlots({
  rules,
  overrides,
  bookedStarts,
  now = new Date(),
  slotMinutes = SLOT_MINUTES,
  minDaysAhead = MIN_DAYS_AHEAD,
  maxDaysAhead = MAX_DAYS_AHEAD,
}: GenerateSlotsInput): Slot[] {
  const booked = new Set<string>()
  for (const s of bookedStarts) booked.add(new Date(s).toISOString())

  const todayEt = etDateStr(now)
  const out: Slot[] = []

  for (let i = minDaysAhead; i <= maxDaysAhead; i++) {
    const date = addDays(todayEt, i)
    const weekday = etParts(etToUtc(date, '12:00')).weekday
    const dayOverrides = overrides.filter((o) => o.date === date)

    // A whole-day block removes the day entirely.
    if (dayOverrides.some((o) => o.kind === 'block' && !o.start_time)) continue

    const windows: [number, number][] = [
      ...rules
        .filter((r) => r.weekday === weekday)
        .map((r) => [timeToMinutes(r.start_time), timeToMinutes(r.end_time)] as [number, number]),
      ...dayOverrides
        .filter((o) => o.kind === 'open' && o.start_time && o.end_time)
        .map((o) => [timeToMinutes(o.start_time!), timeToMinutes(o.end_time!)] as [number, number]),
    ]
    const blocks: [number, number][] = dayOverrides
      .filter((o) => o.kind === 'block' && o.start_time && o.end_time)
      .map((o) => [timeToMinutes(o.start_time!), timeToMinutes(o.end_time!)] as [number, number])

    const seen = new Set<number>()
    for (const [wStart, wEnd] of windows) {
      for (let t = wStart; t + slotMinutes <= wEnd; t += slotMinutes) {
        if (seen.has(t)) continue
        seen.add(t)
        const tEnd = t + slotMinutes
        if (blocks.some(([bs, be]) => t < be && tEnd > bs)) continue
        const start = etToUtc(date, minutesToTime(t))
        if (start.getTime() <= now.getTime()) continue
        const startIso = start.toISOString()
        if (booked.has(startIso)) continue
        out.push({
          start: startIso,
          end: new Date(start.getTime() + slotMinutes * 60_000).toISOString(),
          date,
          label: formatTimeLabel(start),
        })
      }
    }
  }

  out.sort((a, b) => a.start.localeCompare(b.start))
  return out
}

export function groupSlotsByDay(slots: Slot[]): SlotDay[] {
  const days: SlotDay[] = []
  for (const s of slots) {
    let day = days[days.length - 1]
    if (!day || day.date !== s.date) {
      day = { date: s.date, label: formatDateLabel(s.date), slots: [] }
      days.push(day)
    }
    day.slots.push(s)
  }
  return days
}
