import { DashboardMetrics } from './metrics'
import { STAGE_ORDER, STAGE_CONFIG, PipelineStage, Priority, EligibilityStatus } from './types'

const GOLD = '#C4956A'
const DARK = '#1A1A1A'
const MUTED = '#6B6B6B'

const PRIORITY_LABELS: Record<Priority, { label: string; color: string }> = {
  high: { label: 'High', color: '#ef4444' },
  medium: { label: 'Medium', color: '#f59e0b' },
  low: { label: 'Low', color: '#10b981' },
}
const ELIGIBILITY_LABELS: Record<EligibilityStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#9ca3af' },
  eligible: { label: 'Eligible', color: '#10b981' },
  ineligible: { label: 'Ineligible', color: '#ef4444' },
  requires_more_info: { label: 'Needs More Info', color: '#f59e0b' },
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function bar(count: number, total: number, color: string): string {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return `<div style="background:#f1f1f1;border-radius:9999px;height:8px;width:100%;overflow:hidden">
    <div style="background:${color};height:8px;border-radius:9999px;width:${pct}%"></div>
  </div>`
}

function statCell(label: string, value: number): string {
  return `<td width="25%" style="padding:6px" valign="top">
    <div style="background:#ffffff;border:1px solid #eeeeee;border-radius:14px;padding:16px">
      <div style="font-size:26px;font-weight:600;color:${DARK};line-height:1">${value}</div>
      <div style="font-size:12px;color:${MUTED};margin-top:6px">${esc(label)}</div>
    </div>
  </td>`
}

function breakdownRow(label: string, count: number, total: number, color: string): string {
  return `<tr>
    <td style="font-size:13px;color:${DARK};padding:5px 10px 5px 0;white-space:nowrap" valign="middle">${esc(label)}</td>
    <td style="padding:5px 8px" valign="middle">${bar(count, total, color)}</td>
    <td style="font-size:13px;font-weight:600;color:${DARK};text-align:right;padding:5px 0" valign="middle">${count}</td>
  </tr>`
}

export function renderDigestEmail(m: DashboardMetrics, dateStr: string): string {
  const kpis: [string, number][] = [
    ['Total Leads', m.total],
    ['New This Week', m.newThisWeek],
    ['Follow Up Today', m.followUpToday],
    ['Overdue Follow-Ups', m.followUpOverdue],
    ['Procedures Scheduled', m.proceduresScheduled],
    ['Procedures Completed', m.proceduresCompleted],
    ['Virtual Consults Scheduled', m.virtualConsultsScheduled],
    ['Unassigned', m.unassigned],
  ]

  const kpiRows: string[] = []
  for (let i = 0; i < kpis.length; i += 4) {
    const cells = kpis.slice(i, i + 4).map(([l, v]) => statCell(l, v)).join('')
    kpiRows.push(`<tr>${cells}</tr>`)
  }

  const pipelineRows = STAGE_ORDER.map((s: PipelineStage) =>
    breakdownRow(STAGE_CONFIG[s].label, m.byStage[s] || 0, m.total, GOLD)
  ).join('')

  const priorityRows = (['high', 'medium', 'low'] as Priority[])
    .map((p) => breakdownRow(PRIORITY_LABELS[p].label, m.byPriority[p] || 0, m.total, PRIORITY_LABELS[p].color))
    .join('')

  const eligibilityRows = (['pending', 'eligible', 'ineligible', 'requires_more_info'] as EligibilityStatus[])
    .map((e) => breakdownRow(ELIGIBILITY_LABELS[e].label, m.byEligibility[e] || 0, m.total, ELIGIBILITY_LABELS[e].color))
    .join('')

  const sourceRows = m.bySource.length
    ? m.bySource
        .map((s) => breakdownRow(s.source.charAt(0).toUpperCase() + s.source.slice(1), s.count, m.total, GOLD))
        .join('')
    : `<tr><td style="font-size:13px;color:${MUTED};padding:5px 0">No leads yet</td></tr>`

  const card = (title: string, inner: string) => `
    <div style="background:#ffffff;border:1px solid #eeeeee;border-radius:14px;padding:18px;margin-top:16px">
      <div style="font-size:14px;font-weight:600;color:${DARK};border-bottom:1px solid #f0f0f0;padding-bottom:10px;margin-bottom:12px">${esc(title)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${inner}</table>
    </div>`

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#FAFAF8">
  <div style="max-width:640px;margin:0 auto;padding:28px 20px;font-family:Inter,Arial,Helvetica,sans-serif">
    <div style="margin-bottom:6px">
      <span style="font-size:18px;letter-spacing:4px;text-transform:uppercase;color:${DARK};font-weight:300">Tuli</span>
      <span style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${GOLD};margin-left:8px">CRM</span>
    </div>
    <div style="font-size:20px;font-weight:600;color:${DARK}">Daily Dashboard</div>
    <div style="font-size:13px;color:${MUTED};margin-top:2px">${esc(dateStr)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:14px">
      ${kpiRows.join('')}
    </table>

    ${card('Pipeline — Leads by Stage', pipelineRows)}
    ${card('Priority', priorityRows)}
    ${card('Eligibility', eligibilityRows)}
    ${card('Lead Sources', sourceRows)}

    <div style="font-size:11px;color:${MUTED};margin-top:22px;text-align:center">
      Tuli Body Contouring — automated daily summary. Aggregate figures only; no patient information is included.
    </div>
  </div>
</body>
</html>`
}

// Sender for everything a prospect receives (consult acknowledgment, call
// confirmations, reminders). Staff notices keep using RESEND_FROM. The domain
// must be verified in Resend for this address to send.
export const PROSPECT_FROM = process.env.CONSULT_FROM || 'TuLi <consults@tumescentlipolysis.com>'
// Where replies to prospect emails go. Resend receives this address and posts
// each reply to /api/webhooks/resend-inbound, which files it under Replies.
export const PROSPECT_REPLY_TO = process.env.CONSULT_REPLY_TO || 'consults@tumescentlipolysis.com'

// Sends an email via the Resend HTTP API. Returns { ok, id?, error? } — never throws.
// `scheduledAt` asks Resend to hold the email and deliver it at that time; it
// can be cancelled until then with cancelScheduledEmail(id).
export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  from: fromOverride,
  scheduledAt,
}: {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
  from?: string
  scheduledAt?: Date
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = fromOverride || process.env.RESEND_FROM
  if (!apiKey || !from) {
    return { ok: false, error: 'RESEND_API_KEY or RESEND_FROM is not set' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(scheduledAt ? { scheduled_at: scheduledAt.toISOString() } : {}),
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Resend ${res.status}: ${text}` }
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { ok: true, id: data.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'send failed' }
  }
}

// Cancels an email that was sent with `scheduledAt` and hasn't gone out yet.
// Fails (harmlessly) once the email has already been delivered.
export async function cancelScheduledEmail(id: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set' }
  try {
    const res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'cancel failed' }
  }
}

// ─── Scheduling emails ───────────────────────────────────────────────────────
const PRACTICE_PHONE = '(201) 225-1101'

// Prospect-facing emails pass `automated: true` to carry the do-not-reply notice.
const NO_REPLY_NOTE = 'This is an automated email. Please do not reply to it.'
function shell(title: string, bodyHtml: string, footer: string, automated = false): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#FAFAF8">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Inter,Arial,Helvetica,sans-serif">
    <div style="margin-bottom:18px">
      <span style="font-size:22px;color:${DARK};font-weight:400">Tu</span><span style="font-size:22px;color:${GOLD};font-weight:500">Li</span>
      <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};margin-top:2px">Tumescent Lipolysis</div>
    </div>
    <div style="background:#ffffff;border:1px solid #eeeeee;border-radius:14px;padding:22px">
      <div style="font-size:18px;font-weight:600;color:${DARK};margin-bottom:12px">${esc(title)}</div>
      ${bodyHtml}
    </div>
    ${automated ? `<div style="font-size:12px;color:${MUTED};margin-top:14px;text-align:center;line-height:1.5"><strong>${NO_REPLY_NOTE}</strong></div>` : ''}
    <div style="font-size:11px;color:${MUTED};margin-top:${automated ? 6 : 18}px;text-align:center;line-height:1.5">${footer}</div>
  </div>
</body>
</html>`
}

function whenBox(whenLabel: string): string {
  return `<div style="background:#FAFAF8;border:1px solid #EDE9E3;border-radius:10px;padding:14px 16px;margin:14px 0;font-size:16px;font-weight:600;color:${DARK}">${esc(whenLabel)}</div>`
}

// To the prospect, right after they pick a slot (or after staff reschedule them).
// `consultRequest` is the prospect's first email after requesting a consult on
// the website and booking a call on the same visit.
export function renderBookingConfirmation({
  firstName,
  whenLabel,
  rescheduled = false,
  consultRequest = false,
}: {
  firstName: string
  whenLabel: string
  rescheduled?: boolean
  consultRequest?: boolean
}): string {
  const lead = rescheduled
    ? 'Your follow-up call has been moved to:'
    : consultRequest
      ? 'Thank you for requesting a TuLi consultation. Your call with our office is scheduled for:'
      : 'Your follow-up call about TuLi is confirmed for:'
  const body = `
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:0">Hi ${esc(firstName)},</p>
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:10px 0 0">${lead}</p>
    ${whenBox(whenLabel)}
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:0">
      <strong>Reminder:</strong> our office staff will call you at that time, at the phone number you provided.
      The call takes about 10 minutes — it's a chance to talk through your goals and any questions before a consultation.
    </p>
    <p style="font-size:13px;color:${MUTED};line-height:1.6;margin:14px 0 0">
      Need to change the time? Please call our office at ${PRACTICE_PHONE}.
    </p>`
  return shell(
    rescheduled ? 'Your call has been rescheduled' : consultRequest ? 'Your call is booked' : 'Your call is confirmed',
    body,
    `TuLi — Tumescent Lipolysis · 67 NY-59, Suite 211, Spring Valley, NY 10977 · ${PRACTICE_PHONE}`,
    true
  )
}

// To the prospect after a website consult request when no call was booked.
// Follows the prospect's preferred contact method from the form (phone or email).
export function renderConsultRequestReceived({
  firstName,
  preferredContact,
}: {
  firstName: string
  preferredContact?: string | null
}): string {
  const how =
    preferredContact === 'email'
      ? 'Our office will do our best to email you the next business day.'
      : preferredContact === 'phone'
        ? 'Our office will do our best to call you the next business day, at the phone number you provided.'
        : 'Our office will do our best to contact you the next business day.'
  const body = `
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:0">Hi ${esc(firstName)},</p>
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:10px 0 0">
      Thank you for requesting a TuLi consultation. We've received your request.
    </p>
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:10px 0 0">
      ${how}
    </p>
    <p style="font-size:13px;color:${MUTED};line-height:1.6;margin:14px 0 0">
      Questions in the meantime? Call our office at ${PRACTICE_PHONE}.
    </p>`
  return shell(
    'Thank you for your consultation request',
    body,
    `TuLi — Tumescent Lipolysis · 67 NY-59, Suite 211, Spring Valley, NY 10977 · ${PRACTICE_PHONE}`,
    true
  )
}

// To the prospect, the morning of the call.
export function renderBookingReminder({ firstName, whenLabel }: { firstName: string; whenLabel: string }): string {
  const body = `
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:0">Hi ${esc(firstName)},</p>
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:10px 0 0">A quick reminder that your TuLi follow-up call is today:</p>
    ${whenBox(whenLabel)}
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:0">
      Our office staff will call you at that time, at the phone number you provided. If you can't make it, please call our office at ${PRACTICE_PHONE} and we'll find another time.
    </p>`
  return shell('Your call is today', body, `TuLi — Tumescent Lipolysis · ${PRACTICE_PHONE}`, true)
}

// To staff. Deliberately contains NO patient information — only the time and a
// link into the CRM, consistent with keeping PII out of email.
export function renderStaffBookingNotice({
  kind,
  whenLabel,
  leadUrl,
}: {
  kind: 'booked' | 'rescheduled' | 'cancelled'
  whenLabel: string
  leadUrl: string
}): string {
  const headline =
    kind === 'booked' ? 'New follow-up call booked' : kind === 'rescheduled' ? 'Follow-up call rescheduled' : 'Follow-up call cancelled'
  const body = `
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:0">
      A prospect ${kind === 'booked' ? 'booked a follow-up call for' : kind === 'rescheduled' ? 'moved their follow-up call to' : 'cancelled their follow-up call on'}:
    </p>
    ${whenBox(whenLabel)}
    <p style="font-size:14px;margin:0">
      <a href="${esc(leadUrl)}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px;font-size:13px">Open in CRM</a>
    </p>`
  return shell(headline, body, 'Tuli CRM — automated notice. No patient information is included in this email.')
}

// To staff when a prospect replies to an automated email. Deliberately contains
// NO patient information or message text — only a link to the reply in the CRM.
export function renderReplyNotice({ replyUrl, matchedLead }: { replyUrl: string; matchedLead: boolean }): string {
  const body = `
    <p style="font-size:14px;color:${DARK};line-height:1.6;margin:0">
      A prospect replied to one of the automated TuLi emails.${matchedLead ? ' The reply is linked to their lead.' : ' The sender did not match an existing lead.'}
    </p>
    <p style="font-size:14px;margin:16px 0 0">
      <a href="${esc(replyUrl)}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px;font-size:13px">Read the reply in the CRM</a>
    </p>`
  return shell('A prospect replied', body, 'Tuli CRM — automated notice. No patient information is included in this email.')
}
